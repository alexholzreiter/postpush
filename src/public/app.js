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

function formatDate(value) {
  return value
    ? new Intl.DateTimeFormat("en-GB", { dateStyle: "short", timeStyle: "medium" }).format(
        new Date(value)
      )
    : "–";
}

function showNotice(message, success = false) {
  clearTimeout(noticeTimer);
  elements.notice.textContent = message;
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
    empty.textContent = "No HomePods found yet. Check the network and AirPlay access.";
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
    name.textContent = output.name || "AirPlay speaker";
    const detail = document.createElement("small");
    detail.textContent = requiresApproval ? "AirPlay PIN required" : `Current volume ${output.volume ?? "–"} %`;
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
  setStatus(elements.mqttDot, elements.mqttStatus, data.mqttConnected, "Connected", "Disconnected");
  setStatus(elements.airplayDot, elements.airplayStatus, data.ownToneConnected, `${outputs.length} found`, "Unavailable");
  const activeAudioReady =
    data.settings.audioMode === "upload" ? Boolean(data.customAudioUrl) : data.ttsReady;
  const audioLabel =
    data.settings.audioMode === "upload"
      ? data.settings.customAudioOriginalName || "Custom file"
      : "Local voice ready";
  setStatus(elements.ttsDot, elements.ttsStatus, activeAudioReady, audioLabel, "Preparing");
  elements.currentAudio.classList.toggle("hidden", !data.customAudioUrl);
  elements.currentAudioName.textContent = data.settings.customAudioOriginalName || "–";
  if (data.customAudioUrl) {
    const nextSource = `${data.customAudioUrl}?v=${encodeURIComponent(data.settings.customAudioFilename)}`;
    if (!elements.customAudioPlayer.src.endsWith(nextSource)) elements.customAudioPlayer.src = nextSource;
  }
  elements.lastEvent.textContent = formatDate(data.lastEventAt);
  elements.lastOutcome.textContent = data.lastEventOutcome || "No event yet";
  elements.lastPlayback.textContent = formatDate(data.lastPlaybackAt);
  elements.lastMqtt.textContent = formatDate(data.mqttLastMessageAt);
  elements.mqttTopic.textContent = data.mqttTopic;
  elements.mqttTopic.title = data.mqttTopic;
  elements.outputCount.textContent = `${outputs.length} found`;
  elements.lastError.textContent = data.lastError || "–";
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
    if (!quiet) showNotice(`Could not load status: ${error.message}`);
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
  elements.audioFileLabel.textContent = elements.audioFile.files[0]?.name || "Choose an audio file";
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
    showNotice("Choose an audio file first.");
    return;
  }
  elements.uploadAudio.disabled = true;
  elements.uploadAudio.textContent = "Uploading …";
  try {
    const result = await api("/api/custom-audio", {
      method: "POST",
      body: new FormData(elements.audioUploadForm),
    });
    elements.audioUploadForm.reset();
    elements.audioFileLabel.textContent = "Choose an audio file";
    formDirty = false;
    showNotice(`“${result.originalName}” was uploaded and selected.`, true);
    await loadStatus({ quiet: true, forceForm: true });
  } catch (error) {
    showNotice(error.message);
  } finally {
    elements.uploadAudio.disabled = false;
    elements.uploadAudio.textContent = "Upload file";
  }
});

elements.save.addEventListener("click", async () => {
  elements.save.disabled = true;
  elements.save.textContent = "Preparing announcement …";
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
    showNotice(result.warning || "Settings and announcement saved.", true);
    await loadStatus({ quiet: true, forceForm: true });
  } catch (error) {
    showNotice(error.message);
  } finally {
    elements.save.disabled = false;
    elements.save.textContent = "Save settings";
  }
});

elements.test.addEventListener("click", async () => {
  elements.test.disabled = true;
  try {
    await api("/api/test-announcement", { method: "POST" });
    showNotice("Test announcement played.", true);
    await loadStatus({ quiet: true });
  } catch (error) {
    showNotice(error.message);
  } finally {
    elements.test.disabled = false;
  }
});

elements.refresh.addEventListener("click", () => loadStatus({ forceForm: !formDirty }));

await loadStatus();
setInterval(() => loadStatus({ quiet: true }), 10000);
