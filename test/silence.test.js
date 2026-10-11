import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createSilenceWav, ensureSilenceFile } from "../src/silence.js";

test("silence is a valid 44.1 kHz stereo PCM WAV of the requested length", () => {
  const wav = createSilenceWav(1500);
  assert.equal(wav.toString("ascii", 0, 4), "RIFF");
  assert.equal(wav.toString("ascii", 8, 12), "WAVE");
  assert.equal(wav.readUInt16LE(22), 2);
  assert.equal(wav.readUInt32LE(24), 44100);
  assert.equal(wav.readUInt32LE(40), 66150 * 4);
  assert.equal(wav.length, 44 + 66150 * 4);
  assert.ok(wav.subarray(44).every((byte) => byte === 0));
});

test("silence files are only rewritten when missing or of the wrong length", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "postpush-silence-"));
  const file = path.join(directory, "tail.wav");
  assert.equal(ensureSilenceFile(file, 500), true);
  assert.equal(ensureSilenceFile(file, 500), false);
  assert.equal(ensureSilenceFile(file, 1000), true);
  assert.equal(fs.statSync(file).size, createSilenceWav(1000).length);
  fs.rmSync(directory, { recursive: true, force: true });
});
