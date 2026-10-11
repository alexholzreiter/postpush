const DEFAULT_TIMEOUT_MS = 5000;

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export class OwnToneClient {
  constructor(baseUrl, options = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.fetch = options.fetch ?? globalThis.fetch;
    this.mediaPath = options.mediaPath ?? "/srv/media";
    this.retryDelayMs = options.retryDelayMs ?? 1000;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async request(endpoint, options = {}) {
    const response = await this.fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        ...(options.body ? { "content-type": "application/json" } : {}),
        ...options.headers,
      },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) {
      const details = await response.text().catch(() => "");
      throw new Error(
        `OwnTone ${options.method ?? "GET"} ${endpoint}: HTTP ${response.status}${
          details ? ` – ${details.slice(0, 180)}` : ""
        }`
      );
    }
    if (response.status === 204) return null;
    const contentType = response.headers.get("content-type") ?? "";
    return contentType.includes("json") ? response.json() : response.text();
  }

  async getOutputs(attempts = 4) {
    let lastError;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const data = await this.request("/api/outputs");
        return Array.isArray(data?.outputs) ? data.outputs : [];
      } catch (error) {
        lastError = error;
        if (attempt < attempts - 1) await sleep(this.retryDelayMs);
      }
    }
    throw lastError;
  }

  async getPlayer() {
    return this.request("/api/player");
  }

  async rescan() {
    await this.request("/api/update", { method: "PUT" });
  }

  async findTrack(filename, attempts = 24) {
    const wantedPath = `${this.mediaPath}/${filename}`;
    const query = new URLSearchParams({ directory: this.mediaPath });
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const data = await this.request(`/api/library/files?${query}`);
      const track = data?.tracks?.items?.find((item) => item.path === wantedPath);
      if (track) return track;
      if (attempt < attempts - 1) await sleep(250);
    }
    throw new Error("OwnTone hat die Ansage noch nicht indexiert.");
  }

  async setOutputs(outputIds) {
    await this.request("/api/outputs/set", {
      body: JSON.stringify({ outputs: outputIds }),
      method: "PUT",
    });
  }

  async configureOutput(outputId, values) {
    await this.request(`/api/outputs/${encodeURIComponent(outputId)}`, {
      body: JSON.stringify(values),
      method: "PUT",
    });
  }

  async setOutputVolume(outputId, volume) {
    const query = new URLSearchParams({
      output_id: String(outputId),
      volume: String(volume),
    });
    await this.request(`/api/player/volume?${query}`, { method: "PUT" });
  }

  async prepareOutputs(outputIds, volume) {
    await this.setOutputs(outputIds);

    // OwnTone's bulk endpoint may still answer with 204 when an AirPlay
    // connection was not activated. Selecting every requested output once
    // more through the per-output endpoint makes that failure observable.
    for (const id of outputIds) {
      await this.configureOutput(id, { selected: true });
    }

    await this.waitForSelectedOutputs(outputIds);
    for (const id of outputIds) {
      await this.setOutputVolume(id, volume);
    }
  }

  async waitForSelectedOutputs(outputIds, attempts = 24) {
    const requested = new Set(outputIds.map(String));
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const outputs = await this.getOutputs(1);
      const selected = new Set(
        outputs.filter((output) => output.selected).map((output) => String(output.id))
      );
      if ([...requested].every((id) => selected.has(id))) return outputs;
      if (attempt < attempts - 1) await sleep(250);
    }
    throw new Error(
      "OwnTone konnte die ausgewählten HomePods nicht aktivieren. Prüfe in Apple Home unter „Lautsprecher & TV“, ob Geräte im selben Netzwerk zugreifen dürfen."
    );
  }

  async pairOutput(outputId, pin) {
    return this.configureOutput(outputId, { pin });
  }

  async playTrack(track, outputIds, volume) {
    const outputs = await this.getOutputs();
    const availableIds = new Set(outputs.map((output) => String(output.id)));
    const missingIds = outputIds.filter((id) => !availableIds.has(String(id)));
    if (missingIds.length) {
      throw new Error(`Nicht erreichbare AirPlay-Ausgänge: ${missingIds.join(", ")}`);
    }
    await this.prepareOutputs(outputIds, volume);
    await this.request("/api/queue/clear", { method: "PUT" });
    const query = new URLSearchParams({ playback: "start", shuffle: "false", uris: track.uri });
    const queued = await this.request(`/api/queue/items/add?${query}`, { method: "POST" });
    if (!queued?.count) throw new Error("OwnTone hat die Audiodatei nicht in die Warteschlange gelegt.");
    return queued;
  }
}

export function isAirPlayOutput(output) {
  return /^airplay(?:\s+\d+)?$/i.test(String(output?.type ?? "").trim());
}

export function isReadyAirPlayOutput(output) {
  return isAirPlayOutput(output) && !output?.requires_auth && !output?.needs_auth_key;
}

export function selectOutputIds(outputs, settings) {
  const airPlayOutputs = outputs.filter(isReadyAirPlayOutput);
  const requested = settings.useAllOutputs
    ? airPlayOutputs.map((output) => String(output.id))
    : settings.selectedOutputIds.map(String);
  const available = new Set(airPlayOutputs.map((output) => String(output.id)));
  return requested.filter((id) => available.has(id));
}
