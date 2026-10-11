import fs from "node:fs";

const SAMPLE_RATE = 44100;
const CHANNELS = 2;
const BYTES_PER_SAMPLE = 2;

export function createSilenceWav(durationMs) {
  const frames = Math.round((SAMPLE_RATE * durationMs) / 1000);
  const dataSize = frames * CHANNELS * BYTES_PER_SAMPLE;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(CHANNELS, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE, 28);
  buffer.writeUInt16LE(CHANNELS * BYTES_PER_SAMPLE, 32);
  buffer.writeUInt16LE(BYTES_PER_SAMPLE * 8, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataSize, 40);
  return buffer;
}

// Returns true when the file had to be (re)written.
export function ensureSilenceFile(destination, durationMs) {
  const expected = createSilenceWav(durationMs);
  if (fs.existsSync(destination) && fs.statSync(destination).size === expected.length) {
    return false;
  }
  const temporary = `${destination}.tmp`;
  fs.writeFileSync(temporary, expected, { mode: 0o644 });
  fs.renameSync(temporary, destination);
  return true;
}
