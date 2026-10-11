import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import mqtt from "mqtt";
import multer from "multer";
import { isAirPlayOutput, OwnToneClient, selectOutputIds } from "./owntone-client.js";
import { evaluateMailEvent, isMailPayload } from "./schedule.js";
import { createSettingsStore, normalizeSettings } from "./settings.js";
import { ensureSilenceFile } from "./silence.js";
import { synthesizeSpeech } from "./tts.js";

const DATA_DIR = process.env.DATA_DIR || "/data";
const MEDIA_DIR = process.env.MEDIA_DIR || path.join(DATA_DIR, "media");
const WEB_PORT = Number(process.env.WEB_PORT || 8586);
const OWNTONE_URL = process.env.OWNTONE_URL || "http://127.0.0.1:3690";
const OWNTONE_MEDIA_PATH = process.env.OWNTONE_MEDIA_PATH || "/srv/media";
const MQTT_URL = process.env.MQTT_URL || "mqtt://127.0.0.1:1883";
const MQTT_USERNAME = process.env.MQTT_USERNAME || undefined;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || undefined;
const MQTT_TOPIC = process.env.MQTT_TOPIC || "postpush/events/mail";
const ANNOUNCEMENT_FILENAME = "postpush-announcement.wav";
const ANNOUNCEMENT_FILE = path.join(MEDIA_DIR, ANNOUNCEMENT_FILENAME);
const LEAD_IN_FILENAME = "postpush-lead-in.wav";
const TAIL_FILENAME = "postpush-tail.wav";
const LEAD_IN_MS = Number(process.env.PLAYBACK_LEAD_IN_MS || 1500);
const TAIL_MS = Number(process.env.PLAYBACK_TAIL_MS || 5000);
const ALLOWED_EXTENSIONS = new Set(["aac", "flac", "m4a", "mp3", "ogg", "wav"]);

fs.mkdirSync(MEDIA_DIR, { recursive: true });
const settingsStore = createSettingsStore(DATA_DIR);
let settings = settingsStore.read();
const ownTone = new OwnToneClient(OWNTONE_URL, { mediaPath: OWNTONE_MEDIA_PATH });

const state = {
  startedAt: new Date().toISOString(),
  lastError: null,
  lastEventAt: null,
  lastEventOutcome: null,
  lastPlaybackAt: null,
  mqttConnected: false,
  mqttLastMessageAt: null,
  ownToneConnected: false,
  playbackActive: false,
  ttsReady: fs.existsSync(ANNOUNCEMENT_FILE),
};

let lastAcceptedAt = 0;
let lastKnownAirPlayOutputs = [];
let lastOwnToneError = null;
let ttsGeneration = null;

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function outcomeText(reason) {
  return {
    accepted: "Announcement played",
    cooldown: "Ignored during cooldown",
    disabled: "Master switch is off",
    "quiet-hours": "Ignored during quiet hours",
    invalid: "Invalid MQTT event ignored",
    retained: "Retained MQTT event ignored",
  }[reason] ?? reason;
}

async function generateAnnouncement(text = settings.announcementText) {
  if (ttsGeneration) await ttsGeneration;
  state.ttsReady = false;
  ttsGeneration = synthesizeSpeech(text, ANNOUNCEMENT_FILE);
  try {
    await ttsGeneration;
    state.ttsReady = true;
    await ownTone.rescan();
    state.ownToneConnected = true;
  } finally {
    ttsGeneration = null;
  }
}

async function ensureAnnouncement() {
  if (fs.existsSync(ANNOUNCEMENT_FILE)) {
    state.ttsReady = true;
    return;
  }
  await generateAnnouncement();
}

async function ensurePadding() {
  const leadInWritten = ensureSilenceFile(path.join(MEDIA_DIR, LEAD_IN_FILENAME), LEAD_IN_MS);
  const tailWritten = ensureSilenceFile(path.join(MEDIA_DIR, TAIL_FILENAME), TAIL_MS);
  if (leadInWritten || tailWritten) await ownTone.rescan();
  return {
    leadIn: await ownTone.findTrack(LEAD_IN_FILENAME),
    tail: await ownTone.findTrack(TAIL_FILENAME),
  };
}

async function getOwnToneOutputs() {
  try {
    const outputs = await ownTone.getOutputs();
    state.ownToneConnected = true;
    if (lastOwnToneError && state.lastError === lastOwnToneError) state.lastError = null;
    lastOwnToneError = null;
    const airPlayOutputs = outputs.filter(isAirPlayOutput);
    if (airPlayOutputs.length) lastKnownAirPlayOutputs = airPlayOutputs;
    return outputs;
  } catch (error) {
    state.ownToneConnected = false;
    lastOwnToneError = errorMessage(error);
    throw error;
  }
}

async function playAnnouncement() {
  if (state.playbackActive) throw new Error("An announcement is already playing.");
  state.playbackActive = true;
  try {
    if (settings.audioMode === "tts") await ensureAnnouncement();
    const activeFilename =
      settings.audioMode === "upload" ? settings.customAudioFilename : ANNOUNCEMENT_FILENAME;
    if (!activeFilename) throw new Error("No custom audio file has been uploaded yet.");
    const activeFile = path.join(MEDIA_DIR, path.basename(activeFilename));
    if (!fs.existsSync(activeFile)) throw new Error("The selected audio file could not be found.");
    const outputs = await getOwnToneOutputs();
    const outputIds = selectOutputIds(outputs, settings);
    if (!outputIds.length) {
      throw new Error("No selected, reachable HomePods were found.");
    }
    const paddingTracks = await ensurePadding();
    const track = await ownTone.findTrack(activeFilename);
    // AirPlay 2 receivers buffer several seconds before they output audio, and
    // OwnTone tears the session down once the queue runs out. Short clips were
    // therefore never audible on HomePods; surrounding them with silence keeps
    // the session alive until the announcement has actually been heard.
    await ownTone.playTracks(
      [paddingTracks.leadIn, track, paddingTracks.tail],
      outputIds,
      settings.volume
    );
    state.lastPlaybackAt = new Date().toISOString();
    console.log(`Mailbox announcement started on ${outputIds.length} AirPlay output(s).`);
    const playbackTime = Math.min(Math.max(Number(track.length_ms) || 4000, 1000), 30000);
    await new Promise((resolve) =>
      setTimeout(resolve, LEAD_IN_MS + playbackTime + TAIL_MS + 500)
    );
  } finally {
    state.playbackActive = false;
  }
}

async function handleMailEvent(source, { bypassGuards = false } = {}) {
  const now = new Date();
  state.lastEventAt = now.toISOString();
  let decision = { accepted: true, reason: "accepted" };
  if (!bypassGuards) {
    decision = evaluateMailEvent(settings, { now, lastAcceptedAt });
  }
  if (!decision.accepted) {
    state.lastEventOutcome = outcomeText(decision.reason);
    console.log(`Mailbox event (${source}) ${state.lastEventOutcome.toLowerCase()}.`);
    return decision;
  }

  lastAcceptedAt = now.getTime();
  state.lastError = null;
  try {
    await playAnnouncement();
    state.lastEventOutcome = outcomeText("accepted");
    return decision;
  } catch (error) {
    state.lastError = errorMessage(error);
    state.lastEventOutcome = "Announcement failed";
    console.error("Mailbox announcement could not be played:", error);
    return { accepted: false, reason: "playback-error", error: state.lastError };
  }
}

const mqttClient = mqtt.connect(MQTT_URL, {
  clientId: `postpush-${os.hostname().replace(/[^a-zA-Z0-9_-]/g, "-")}`,
  clean: true,
  connectTimeout: 10000,
  password: MQTT_PASSWORD,
  reconnectPeriod: 5000,
  username: MQTT_USERNAME,
});

mqttClient.on("connect", () => {
  state.mqttConnected = true;
  state.lastError = null;
  mqttClient.subscribe(MQTT_TOPIC, { qos: 0 }, (error) => {
    if (error) {
      state.lastError = `Could not subscribe to the MQTT topic: ${errorMessage(error)}`;
      return;
    }
    console.log(`MQTT connected. Waiting for "${MQTT_TOPIC}".`);
  });
});
mqttClient.on("reconnect", () => {
  state.mqttConnected = false;
});
mqttClient.on("close", () => {
  state.mqttConnected = false;
});
mqttClient.on("error", (error) => {
  state.mqttConnected = false;
  state.lastError = `MQTT: ${errorMessage(error)}`;
  console.error(state.lastError);
});
mqttClient.on("message", (_topic, payload, packet) => {
  state.mqttLastMessageAt = new Date().toISOString();
  if (packet.retain) {
    state.lastEventOutcome = outcomeText("retained");
    return;
  }
  if (!isMailPayload(payload)) {
    state.lastEventOutcome = outcomeText("invalid");
    return;
  }
  void handleMailEvent("mqtt");
});

const app = express();
app.use(express.json({ limit: "32kb" }));
app.use(express.static(fileURLToPath(new URL("public", import.meta.url))));
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
});

app.get("/api/status", async (_req, res) => {
  let outputs = [];
  try {
    outputs = await getOwnToneOutputs();
  } catch (error) {
    state.lastError = errorMessage(error);
  }
  const airPlayOutputs = outputs.filter(isAirPlayOutput);
  res.json({
    ...state,
    announcementUrl: state.ttsReady ? "/api/announcement" : null,
    customAudioUrl: settings.customAudioFilename ? "/api/custom-audio" : null,
    mqttTopic: MQTT_TOPIC,
    outputs: airPlayOutputs.length ? airPlayOutputs : lastKnownAirPlayOutputs,
    outputsStale: !airPlayOutputs.length && lastKnownAirPlayOutputs.length > 0,
    settings,
  });
});

app.put("/api/settings", async (req, res) => {
  const candidate = normalizeSettings({
    ...settings,
    ...req.body,
    customAudioFilename: settings.customAudioFilename,
    customAudioOriginalName: settings.customAudioOriginalName,
  });
  if (!candidate.useAllOutputs && !candidate.selectedOutputIds.length) {
    return res.status(400).json({ error: "Select at least one HomePod." });
  }
  if (candidate.audioMode === "upload" && !candidate.customAudioFilename) {
    return res.status(400).json({ error: "Upload a custom audio file first." });
  }
  const textChanged = candidate.announcementText !== settings.announcementText;
  try {
    if (textChanged || !fs.existsSync(ANNOUNCEMENT_FILE)) {
      await generateAnnouncement(candidate.announcementText);
    }
    settings = settingsStore.write(candidate);
    const outputs = await getOwnToneOutputs();
    const outputIds = selectOutputIds(outputs, settings);
    await ownTone.prepareOutputs(outputIds, settings.volume);
    return res.json({ ok: true, settings });
  } catch (error) {
    state.lastError = errorMessage(error);
    if (textChanged) return res.status(502).json({ error: state.lastError });
    settings = settingsStore.write(candidate);
    return res.json({
      ok: true,
      settings,
      warning: "Settings were saved, but OwnTone is currently unavailable.",
    });
  }
});

app.get("/api/announcement", (_req, res) => {
  if (!fs.existsSync(ANNOUNCEMENT_FILE)) return res.sendStatus(404);
  return res.sendFile(ANNOUNCEMENT_FILE);
});

app.post("/api/custom-audio", upload.single("audio"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No audio file received." });
  const extension = path.extname(req.file.originalname).slice(1).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return res.status(415).json({ error: "Allowed formats are MP3, WAV, M4A, AAC, FLAC, and OGG." });
  }

  const filename = `postpush-custom-${Date.now()}.${extension}`;
  const destination = path.join(MEDIA_DIR, filename);
  const temporary = `${destination}.tmp`;
  try {
    fs.writeFileSync(temporary, req.file.buffer, { mode: 0o644 });
    fs.renameSync(temporary, destination);
    await ownTone.rescan();
    await ownTone.findTrack(filename);
    const previousFilename = settings.customAudioFilename;
    settings = settingsStore.write({
      ...settings,
      audioMode: "upload",
      customAudioFilename: filename,
      customAudioOriginalName: req.file.originalname,
    });
    if (previousFilename && previousFilename !== filename) {
      fs.rmSync(path.join(MEDIA_DIR, path.basename(previousFilename)), { force: true });
      void ownTone.rescan().catch(() => null);
    }
    state.ownToneConnected = true;
    state.lastError = null;
    return res.json({
      filename,
      ok: true,
      originalName: settings.customAudioOriginalName,
      settings,
    });
  } catch (error) {
    fs.rmSync(temporary, { force: true });
    fs.rmSync(destination, { force: true });
    state.lastError = errorMessage(error);
    return res.status(502).json({ error: state.lastError });
  }
});

app.get("/api/custom-audio", (_req, res) => {
  if (!settings.customAudioFilename) return res.sendStatus(404);
  const filename = path.join(MEDIA_DIR, path.basename(settings.customAudioFilename));
  if (!fs.existsSync(filename)) return res.sendStatus(404);
  return res.sendFile(filename);
});

app.post("/api/outputs/:id/pair", async (req, res) => {
  const pin = String(req.body?.pin ?? "").trim();
  if (!/^\d{4}$/.test(pin)) {
    return res.status(400).json({ error: "The PIN must contain four digits." });
  }
  try {
    await ownTone.pairOutput(req.params.id, pin);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(502).json({ error: errorMessage(error) });
  }
});

app.post("/api/test-announcement", async (_req, res) => {
  const result = await handleMailEvent("web-test", { bypassGuards: true });
  if (!result.accepted) {
    return res.status(502).json({ error: result.error || "Test announcement failed." });
  }
  return res.json({ ok: true, completedAt: new Date().toISOString() });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, ...state });
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "The audio file must not exceed 25 MB." });
  }
  console.error("Unhandled web error:", error);
  return res.status(500).json({ error: errorMessage(error) });
});

const webServer = app.listen(WEB_PORT, "0.0.0.0", (error) => {
  if (error) {
    state.lastError = `Could not start the web server: ${errorMessage(error)}`;
    process.exitCode = 1;
    return;
  }
  console.log(`PostPush web interface is running on port ${WEB_PORT}.`);
});

void ensureAnnouncement().catch((error) => {
  state.lastError = errorMessage(error);
  console.error("Could not generate the initial announcement:", error);
});

function shutdown(signal) {
  console.log(`${signal} received; PostPush is shutting down.`);
  mqttClient.end(true);
  webServer.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
