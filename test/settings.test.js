import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createSettingsStore, normalizeSettings } from "../src/settings.js";

test("normalizeSettings validates all user-controlled values", () => {
  assert.deepEqual(
    normalizeSettings({
      activeFrom: "25:99",
      activeUntil: "21:30",
      announcementText: "  Die   Post ist da!  ",
      cooldownSeconds: 9999,
      enabled: false,
      scheduleEnabled: false,
      selectedOutputIds: ["a", "a", "", 4],
      useAllOutputs: false,
      volume: -10,
    }),
    {
      activeFrom: "05:00",
      activeUntil: "21:30",
      announcementText: "Die Post ist da!",
      cooldownSeconds: 600,
      enabled: false,
      scheduleEnabled: false,
      selectedOutputIds: ["a"],
      useAllOutputs: false,
      volume: 1,
    }
  );
});

test("settings store persists normalized settings atomically", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "postpush-settings-"));
  const store = createSettingsStore(directory);
  assert.equal(store.read().announcementText, "Du hast Post bekommen.");
  store.write({ volume: 77, announcementText: "Post!" });
  assert.equal(store.read().volume, 77);
  assert.equal(store.read().announcementText, "Post!");
  fs.rmSync(directory, { recursive: true, force: true });
});
