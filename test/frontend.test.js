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
  assert.match(css, /font-size: clamp\(44px, 4\.55vw, 58px\)/);
  assert.match(css, /\.hero h1 em \{[^}]*white-space: nowrap;/);
});

test("local interface is English and the live icon has no white matte", () => {
  const html = fs.readFileSync(path.join(root, "src/public/index.html"), "utf8");
  const script = fs.readFileSync(path.join(root, "src/public/app.js"), "utf8");
  const css = fs.readFileSync(path.join(root, "src/public/styles.css"), "utf8");

  assert.match(html, /<html lang="en">/);
  assert.match(html, /Everything at a glance\./);
  assert.match(html, /Save settings/);
  assert.match(script, /Test announcement played\./);
  assert.doesNotMatch(html, /Alles im Blick|Einstellungen speichern|Briefkasten|Wird geprüft|Lautstärke/);
  assert.doesNotMatch(script, /Noch keine|Verbunden|Wird vorbereitet|gefunden|hochgeladen/);
  assert.match(css, /\.live-logo \{[^}]*border: 0;[^}]*background: #f44a1b;/);
});

test("local interface ships a 1200 by 630 social share image", () => {
  const html = fs.readFileSync(path.join(root, "src/public/index.html"), "utf8");
  const shareImage = fs.readFileSync(path.join(root, "src/public/postpush-share.png"));

  assert.match(html, /property="og:image" content="\/postpush-share\.png"/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  assert.equal(shareImage.readUInt32BE(16), 1200);
  assert.equal(shareImage.readUInt32BE(20), 630);
});
