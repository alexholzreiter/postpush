import { localizeServerMessage, resolveLanguage, translate } from "./i18n.js";

const LANGUAGE_STORAGE_KEY = "postpush-language";
const $ = (selector) => document.querySelector(selector);
const elements = {
  activeFrom: $("#active-from"),
  activeUntil: $("#active-until"),
  airplayDot: $("#airplay-dot"),
  airplayStatus: $("#airplay-status"),
  audioFile: $("#audio-file"),
  audioFileLabel: $("#audio-file-label"),
  audioMode: [...document.querySelectorAll('input[name="audio-mode"]')],
  audioUploadForm: $("#audio-upload-form"),
  announcementText: $("#announcement-text"),
  cooldown: $("#cooldown"),
  currentAudio: $("#current-audio"),
  currentAudioName: $("#current-audio-name"),
  customAudioPlayer: $("#custom-audio-player"),
  enabled: $("#enabled"),
  languageButtons: [...document.querySelectorAll("[data-language]")],
  lastError: $("#last-error"),
  lastEvent: $("#last-event"),
  lastMqtt: $("#last-mqtt"),
  lastOutcome: $("#last-outcome"),
  lastPlayback: $("#last-playback"),
  mqttDot: $("#mqtt-dot"),
  mqttStatus: $("#mqtt-status"),
  mqttTopic: $("#mqtt-topic"),
  notice: $("#notice"),
  outputCount: $("#output-count"),
  outputs: $("#outputs"),
  refresh: $("#refresh"),
  save: $("#save"),
  saveLabel: $("#save-label"),
  scheduleEnabled: $("#schedule-enabled"),
  test: $("#test-announcement"),
  textCount: $("#text-count"),
  timeGrid: $("#time-grid"),
  ttsDot: $("#tts-dot"),
  ttsStatus: $("#tts-status"),
  ttsPanel: $("#tts-panel"),
  useAll: $("#use-all"),
  uploadAudio: $("#upload-audio"),
  uploadPanel: $("#upload-panel"),
  volume: $("#volume"),
  volumeValue: $("#volume-value"),
};

let current;
let formDirty = false;
let noticeTimer;
let lastKnownOutputs = [];

function readStoredLanguage() {
  try {
    return window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    return null;
  }
}

let language = resolveLanguage(readStoredLanguage(), navigator.languages ?? [navigator.language]);
const t = (key, values) => translate(language, key, values);

function applyTranslations() {
  document.documentElement.lang = language;
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
  });
  document.querySelectorAll("[data-i18n-title]").forEach((element) => {
    element.title = t(element.dataset.i18nTitle);
  });
  elements.languageButtons.forEach((button) => {
    const active = button.dataset.language === language;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function changeLanguage(nextLanguage) {
  language = resolveLanguage(nextLanguage);
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // The choice still applies for this visit.
  }
  applyTranslations();
  if (current) renderStatus(current);
}

function formatDate(value) {
  return value
    ? new Intl.DateTimeFormat(language === "de" ? "de-AT" : "en-GB", { dateStyle: "short", timeStyle: "medium" }).format(
        new Date(value)
      )
    : "–";
}

function showNotice(message, success = false) {
  clearTimeout(noticeTimer);
  elements.notice.textContent = localizeServerMessage(language, message);
  elements.notice.className = `notice${success ? " success" : ""}`;
  noticeTimer = setTimeout(() => (elements.notice.className = "notice hidden"), 6000);
}

async function api(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
  return body;
}

function setStatus(dot, label, connected, good, bad) {
  dot.className = `status-dot ${connected ? "ok" : "bad"}`;
  label.textContent = connected ? good : bad;
}

function selectedOutputIds() {
  return [...document.querySelectorAll(".output-checkbox:checked")].map((item) => item.value);
}

function selectedAudioMode() {
  return elements.audioMode.find((input) => input.checked)?.value || "tts";
}

function showAudioMode(mode) {
  const upload = mode === "upload";
  elements.ttsPanel.classList.toggle("hidden", upload);
  elements.uploadPanel.classList.toggle("hidden", !upload);
}

function updateVolumeVisual(value) {
  const normalized = Math.min(100, Math.max(0, Number(value) || 0));
  elements.volumeValue.textContent = `${normalized} %`;
  elements.volume.style.background =
    `linear-gradient(90deg, var(--blue) 0 ${normalized}%, #e2e7ec ${normalized}% 100%)`;
}

function renderOutputs(outputs, settings) {
  elements.outputs.replaceChildren();
  if (!outputs.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = t("noHomePodsFound");
    elements.outputs.append(empty);
    return;
  }
  for (const output of outputs) {
    const requiresApproval = Boolean(output.needs_auth_key || output.requires_auth);
    const row = document.createElement("label");
    row.className = `output-row${requiresApproval ? " unavailable" : ""}`;
    const icon = document.createElement("span");
    icon.className = "speaker-icon";
    icon.innerHTML = '<svg viewBox="0 0 24 24"><rect x="7" y="3" width="10" height="18" rx="5"/><path d="M10 7h4M10 17h4"/></svg>';
    const copy = document.createElement("span");
    copy.className = "output-copy";
    const name = document.createElement("strong");
    name.textContent = output.name || t("airplaySpeaker");
    const detail = document.createElement("small");
    detail.textContent = requiresApproval
      ? t("pinRequired")
      : t("currentVolume", { volume: output.volume ?? "–" });
    copy.append(name, detail);
    const check = document.createElement("span");
    check.className = "check";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "output-checkbox";
    checkbox.value = String(output.id);
    checkbox.dataset.requiresApproval = String(requiresApproval);
    checkbox.checked = !requiresApproval && (settings.useAllOutputs || settings.selectedOutputIds.includes(String(output.id)));
    checkbox.disabled = requiresApproval || settings.useAllOutputs;
    check.append(checkbox, document.createElement("i"));
    row.append(icon, copy, check);
    elements.outputs.append(row);
  }
}

function applyForm(settings) {
  elements.enabled.checked = settings.enabled;
  elements.announcementText.value = settings.announcementText;
  elements.audioMode.forEach((input) => (input.checked = input.value === settings.audioMode));
  showAudioMode(settings.audioMode);
  elements.textCount.textContent = `${settings.announcementText.length} / 240`;
  elements.useAll.checked = settings.useAllOutputs;
  elements.volume.value = settings.volume;
  updateVolumeVisual(settings.volume);
  elements.cooldown.value = settings.cooldownSeconds;
  elements.scheduleEnabled.checked = settings.scheduleEnabled;
  elements.activeFrom.value = settings.activeFrom;
  elements.activeUntil.value = settings.activeUntil;
  elements.timeGrid.classList.toggle("disabled", !settings.scheduleEnabled);
  renderOutputs(lastKnownOutputs, settings);
}

function renderStatus(data) {
  const outputs = data.outputs.length ? data.outputs : lastKnownOutputs;
  if (data.outputs.length) lastKnownOutputs = data.outputs;
  setStatus(elements.mqttDot, elements.mqttStatus, data.mqttConnected, t("connected"), t("disconnected"));
  setStatus(elements.airplayDot, elements.airplayStatus, data.ownToneConnected, t("foundOutputs", { count: outputs.length }), t("unavailable"));
  const activeAudioReady =
    data.settings.audioMode === "upload" ? Boolean(data.customAudioUrl) : data.ttsReady;
  const audioLabel =
    data.settings.audioMode === "upload"
      ? data.settings.customAudioOriginalName || t("customFile")
      : t("localVoiceReady");
  setStatus(elements.ttsDot, elements.ttsStatus, activeAudioReady, audioLabel, t("preparing"));
  elements.currentAudio.classList.toggle("hidden", !data.customAudioUrl);
  elements.currentAudioName.textContent = data.settings.customAudioOriginalName || "–";
  if (data.customAudioUrl) {
    const nextSource = `${data.customAudioUrl}?v=${encodeURIComponent(data.settings.customAudioFilename)}`;
    if (!elements.customAudioPlayer.src.endsWith(nextSource)) elements.customAudioPlayer.src = nextSource;
  }
  elements.lastEvent.textContent = formatDate(data.lastEventAt);
  elements.lastOutcome.textContent = data.lastEventOutcome
    ? localizeServerMessage(language, data.lastEventOutcome)
    : t("noEventYet");
  elements.lastPlayback.textContent = formatDate(data.lastPlaybackAt);
  elements.lastMqtt.textContent = formatDate(data.mqttLastMessageAt);
  elements.mqttTopic.textContent = data.mqttTopic;
  elements.mqttTopic.title = data.mqttTopic;
  elements.outputCount.textContent = t("foundOutputs", { count: outputs.length });
  elements.lastError.textContent = localizeServerMessage(language, data.lastError || "–");
  elements.lastError.title = data.lastError || "";
  if (!formDirty) applyForm(data.settings);
}

async function loadStatus({ quiet = false, forceForm = false } = {}) {
  try {
    const data = await api("/api/status");
    current = data;
    if (forceForm) formDirty = false;
    renderStatus(data);
  } catch (error) {
    if (!quiet) showNotice(t("statusLoadFailed", { message: localizeServerMessage(language, error.message) }));
  }
}

function markDirty() {
  formDirty = true;
}

elements.announcementText.addEventListener("input", () => {
  markDirty();
  elements.textCount.textContent = `${elements.announcementText.value.length} / 240`;
});
elements.audioMode.forEach((input) => {
  input.addEventListener("change", () => {
    markDirty();
    showAudioMode(selectedAudioMode());
  });
});
elements.audioFile.addEventListener("change", () => {
  elements.audioFileLabel.textContent = elements.audioFile.files[0]?.name || t("chooseAudioFile");
});
elements.volume.addEventListener("input", () => {
  markDirty();
  updateVolumeVisual(elements.volume.value);
});
elements.useAll.addEventListener("change", () => {
  markDirty();
  document.querySelectorAll(".output-checkbox").forEach((checkbox) => {
    const requiresApproval = checkbox.dataset.requiresApproval === "true";
    checkbox.disabled = requiresApproval || elements.useAll.checked;
    if (elements.useAll.checked) checkbox.checked = !requiresApproval;
  });
});
elements.scheduleEnabled.addEventListener("change", () => {
  markDirty();
  elements.timeGrid.classList.toggle("disabled", !elements.scheduleEnabled.checked);
});
for (const element of [elements.enabled, elements.activeFrom, elements.activeUntil, elements.cooldown]) {
  element.addEventListener("change", markDirty);
}
elements.outputs.addEventListener("change", markDirty);

elements.audioUploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!elements.audioFile.files.length) {
    showNotice(t("chooseFileFirst"));
    return;
  }
  elements.uploadAudio.disabled = true;
  elements.uploadAudio.textContent = t("uploading");
  try {
    const result = await api("/api/custom-audio", {
      method: "POST",
      body: new FormData(elements.audioUploadForm),
    });
    elements.audioUploadForm.reset();
    elements.audioFileLabel.textContent = t("chooseAudioFile");
    formDirty = false;
    showNotice(t("uploaded", { name: result.originalName }), true);
    await loadStatus({ quiet: true, forceForm: true });
  } catch (error) {
    showNotice(error.message);
  } finally {
    elements.uploadAudio.disabled = false;
    elements.uploadAudio.textContent = t("upload");
  }
});

elements.save.addEventListener("click", async () => {
  elements.save.disabled = true;
  elements.saveLabel.textContent = t("preparingAnnouncement");
  try {
    const result = await api("/api/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        activeFrom: elements.activeFrom.value,
        activeUntil: elements.activeUntil.value,
        announcementText: elements.announcementText.value,
        audioMode: selectedAudioMode(),
        cooldownSeconds: Number(elements.cooldown.value),
        enabled: elements.enabled.checked,
        scheduleEnabled: elements.scheduleEnabled.checked,
        selectedOutputIds: selectedOutputIds(),
        useAllOutputs: elements.useAll.checked,
        volume: Number(elements.volume.value),
      }),
    });
    formDirty = false;
    showNotice(result.warning || t("settingsSaved"), true);
    await loadStatus({ quiet: true, forceForm: true });
  } catch (error) {
    showNotice(error.message);
  } finally {
    elements.save.disabled = false;
    elements.saveLabel.textContent = t("saveSettings");
  }
});

elements.test.addEventListener("click", async () => {
  elements.test.disabled = true;
  try {
    await api("/api/test-announcement", { method: "POST" });
    showNotice(t("testPlayed"), true);
    await loadStatus({ quiet: true });
  } catch (error) {
    showNotice(error.message);
  } finally {
    elements.test.disabled = false;
  }
});

elements.languageButtons.forEach((button) => {
  button.addEventListener("click", () => changeLanguage(button.dataset.language));
});
elements.refresh.addEventListener("click", () => loadStatus({ forceForm: !formDirty }));

applyTranslations();
await loadStatus();
setInterval(() => loadStatus({ quiet: true }), 10000);
