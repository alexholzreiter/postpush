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
