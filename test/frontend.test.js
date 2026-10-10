import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

test("web interface contains all primary controls and no remote assets", () => {
  const html = fs.readFileSync(path.join(root, "src/public/index.html"), "utf8");
  const css = fs.readFileSync(path.join(root, "src/public/styles.css"), "utf8");
  for (const id of [
    "enabled",
    "announcement-text",
    "audio-file",
    "audio-upload-form",
    "use-all",
    "volume",
    "schedule-enabled",
    "active-from",
    "active-until",
    "cooldown",
    "save",
    "test-announcement",
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.doesNotMatch(html, /https?:\/\//);
  assert.doesNotMatch(css, /https?:\/\//);
});

test("custom audio upload supports common formats", () => {
  const html = fs.readFileSync(path.join(root, "src/public/index.html"), "utf8");
  const server = fs.readFileSync(path.join(root, "src/index.js"), "utf8");
  assert.match(html, /\.mp3,\.wav,\.m4a,\.aac,\.flac,\.ogg/);
  assert.match(server, /app\.post\("\/api\/custom-audio"/);
  assert.match(server, /25 \* 1024 \* 1024/);
});

test("DoorBell visual language includes the PostPush mailbox hero", () => {
  const html = fs.readFileSync(path.join(root, "src/public/index.html"), "utf8");
  const css = fs.readFileSync(path.join(root, "src/public/styles.css"), "utf8");

  assert.match(html, /class="mailbox-device"/);
  assert.match(html, /class="mini-pod pod-one"/);
  assert.match(html, /class="mini-pod pod-two"/);
  assert.match(html, /class="mini-pod pod-three"/);
  assert.match(css, /width: min\(1220px, calc\(100% - 40px\)\)/);
  assert.match(css, /min-height: 530px/);
  assert.match(css, /border-radius: 38px/);
});
