import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  localizeServerMessage,
  resolveLanguage,
  translate,
  translations,
} from "../src/public/i18n.js";

const root = path.resolve(import.meta.dirname, "..");

test("English and German contain the same translation keys", () => {
  assert.deepEqual(Object.keys(translations.de).sort(), Object.keys(translations.en).sort());
});

test("every key used in the web interface is translated", () => {
  const html = fs.readFileSync(path.join(root, "src/public/index.html"), "utf8");
  const script = fs.readFileSync(path.join(root, "src/public/app.js"), "utf8");
  const keys = new Set([
    ...[...html.matchAll(/data-i18n(?:-aria-label|-title)?="([^"]+)"/g)].map((match) => match[1]),
    ...[...script.matchAll(/\bt\("([^"]+)"/g)].map((match) => match[1]),
  ]);
  for (const key of keys) {
    assert.ok(key in translations.en, `missing English text for ${key}`);
    assert.ok(key in translations.de, `missing German text for ${key}`);
  }
});

test("stored language wins and browser language is used as fallback", () => {
  assert.equal(resolveLanguage("de", ["en-GB"]), "de");
  assert.equal(resolveLanguage(null, ["de-AT", "en-GB"]), "de");
  assert.equal(resolveLanguage(null, ["fr-FR"]), "en");
});

test("translations interpolate dynamic values", () => {
  assert.equal(translate("de", "foundOutputs", { count: 4 }), "4 gefunden");
  assert.equal(translate("en", "currentVolume", { volume: 62 }), "Current volume 62 %");
});

test("server outcomes and errors are shown in German", () => {
  assert.equal(localizeServerMessage("de", "Announcement played"), "Ansage abgespielt");
  assert.equal(
    localizeServerMessage("de", "Unavailable AirPlay outputs: 1, 2"),
    "Nicht erreichbare AirPlay-Ausgänge: 1, 2"
  );
  assert.equal(localizeServerMessage("en", "Announcement played"), "Announcement played");
  assert.equal(localizeServerMessage("de", "Something new"), "Something new");
});
