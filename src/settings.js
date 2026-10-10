import fs from "node:fs";
import path from "node:path";

export const DEFAULT_SETTINGS = Object.freeze({
  activeFrom: "05:00",
  activeUntil: "22:00",
  announcementText: "Du hast Post bekommen.",
  audioMode: "tts",
  cooldownSeconds: 30,
  customAudioFilename: null,
  customAudioOriginalName: null,
  enabled: true,
  scheduleEnabled: true,
  selectedOutputIds: [],
  useAllOutputs: true,
  volume: 55,
});

function numberInRange(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.min(maximum, Math.max(minimum, Math.round(parsed)))
    : fallback;
}

function normalizeTime(value, fallback) {
  return typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)
    ? value
    : fallback;
}

function normalizeText(value) {
  if (typeof value !== "string") return DEFAULT_SETTINGS.announcementText;
  const text = value.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, 240) : DEFAULT_SETTINGS.announcementText;
}

export function normalizeSettings(value = {}) {
  return {
    activeFrom: normalizeTime(value.activeFrom, DEFAULT_SETTINGS.activeFrom),
    activeUntil: normalizeTime(value.activeUntil, DEFAULT_SETTINGS.activeUntil),
    announcementText: normalizeText(value.announcementText),
    audioMode: value.audioMode === "upload" ? "upload" : "tts",
    cooldownSeconds: numberInRange(
      value.cooldownSeconds,
      DEFAULT_SETTINGS.cooldownSeconds,
      1,
      600
    ),
    customAudioFilename:
      typeof value.customAudioFilename === "string" && value.customAudioFilename
        ? path.basename(value.customAudioFilename)
        : null,
    customAudioOriginalName:
      typeof value.customAudioOriginalName === "string" && value.customAudioOriginalName
        ? path.basename(value.customAudioOriginalName).slice(0, 240)
        : null,
    enabled: typeof value.enabled === "boolean" ? value.enabled : DEFAULT_SETTINGS.enabled,
    scheduleEnabled:
      typeof value.scheduleEnabled === "boolean"
        ? value.scheduleEnabled
        : DEFAULT_SETTINGS.scheduleEnabled,
    selectedOutputIds: Array.isArray(value.selectedOutputIds)
      ? [...new Set(value.selectedOutputIds.filter((id) => typeof id === "string" && id))]
      : [],
    useAllOutputs:
      typeof value.useAllOutputs === "boolean"
        ? value.useAllOutputs
        : DEFAULT_SETTINGS.useAllOutputs,
    volume: numberInRange(value.volume, DEFAULT_SETTINGS.volume, 1, 100),
  };
}

export function createSettingsStore(dataDirectory) {
  const filename = path.join(dataDirectory, "settings.json");
  fs.mkdirSync(dataDirectory, { recursive: true });

  function read() {
    try {
      return normalizeSettings(JSON.parse(fs.readFileSync(filename, "utf8")));
    } catch (error) {
      if (error?.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
      return { ...DEFAULT_SETTINGS, selectedOutputIds: [] };
    }
  }

  function write(value) {
    const normalized = normalizeSettings(value);
    const temporary = `${filename}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(normalized, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(temporary, filename);
    return normalized;
  }

  return { read, write };
}
