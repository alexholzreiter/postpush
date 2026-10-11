import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const standalone = path.join(root, "runtipi");
const storeApp = path.join(root, "apps", "postpush");
const packagedFiles = [
  "config.json",
  "docker-compose.yml",
  "metadata/description.md",
  "metadata/logo.jpg",
  "metadata/logo.png",
];

const publicIcons = [
  "app-icon.png",
  "apple-touch-icon.png",
  "favicon-32.png",
  "favicon.ico",
];

test("standalone and app-store packages stay identical", () => {
  for (const filename of packagedFiles) {
    assert.deepEqual(
      fs.readFileSync(path.join(storeApp, filename)),
      fs.readFileSync(path.join(standalone, filename)),
      `${filename} differs between Runtipi packages`
    );
  }
});

test("web app ships the requested icon and favicon assets", () => {
  for (const filename of publicIcons) {
    assert.equal(fs.existsSync(path.join(root, "src", "public", filename)), true, `${filename} is missing`);
  }

  const page = fs.readFileSync(path.join(root, "src", "public", "index.html"), "utf8");
  assert.match(page, /href="\/favicon\.ico"/);
  assert.match(page, /href="\/favicon-32\.png"/);
  assert.match(page, /href="\/apple-touch-icon\.png"/);
  assert.match(page, /src="\/app-icon\.png"/);
});

test("the new PostPush icon is identical across the app, website and Runtipi", () => {
  const canonicalIcon = fs.readFileSync(path.join(root, "docs", "postpush-icon.png"));
  const exactIconCopies = [
    path.join(root, "src", "public", "app-icon.png"),
    path.join(root, "website", "assets", "postpush-icon.png"),
    path.join(root, "website", "assets", "logo.png"),
    path.join(storeApp, "metadata", "logo.png"),
    path.join(standalone, "metadata", "logo.png"),
  ];

  for (const icon of exactIconCopies) {
    assert.deepEqual(fs.readFileSync(icon), canonicalIcon, `${icon} does not use the canonical PostPush icon`);
  }
});

test("application, image and Runtipi versions stay synchronized", () => {
  const version = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;
  const config = JSON.parse(fs.readFileSync(path.join(storeApp, "config.json"), "utf8"));
  const compose = fs.readFileSync(path.join(storeApp, "docker-compose.yml"), "utf8");
  assert.equal(config.version, version);
  assert.equal(config.tipi_version, 17);
  assert.match(compose, new RegExp(`postpush:${version.replaceAll(".", "\\.")}`));
  assert.match(compose, /schema_version: 2/);
});

test("Runtipi fields are valid and secrets use password input", () => {
  const config = JSON.parse(fs.readFileSync(path.join(storeApp, "config.json"), "utf8"));
  for (const field of config.form_fields) {
    assert.equal(Number.isInteger(field.min), true);
    assert.equal(Number.isInteger(field.max), true);
    assert.equal(field.min <= field.max, true);
  }
  assert.equal(config.form_fields.find((field) => field.env_variable === "MQTT_PASSWORD").type, "password");
});

test("Runtipi package runs its own OwnTone without depending on another app", () => {
  const compose = fs.readFileSync(path.join(storeApp, "docker-compose.yml"), "utf8");
  assert.match(compose, /WEB_PORT: "8586"/);
  assert.match(compose, /OWNTONE_URL: http:\/\/127\.0\.0\.1:3690/);
  assert.match(compose, /^  owntone:/m);
  assert.match(compose, /port = 3690/);
  assert.match(compose, /websocket_port = 3691/);
  assert.match(compose, /owntone:8dfd6db1@sha256:/);
  assert.doesNotMatch(compose, /doorbell/i);
  assert.doesNotMatch(compose, /3689/);
});

test("Runtipi package uses the host mDNS stack instead of starting its own", () => {
  const compose = fs.readFileSync(path.join(storeApp, "docker-compose.yml"), "utf8");
  assert.match(compose, /\/var\/run\/dbus\/system_bus_socket:\/run\/dbus\/system_bus_socket/);
  assert.doesNotMatch(compose, /avahi-daemon --daemonize/);
  assert.doesNotMatch(compose, /dbus-daemon/);
  assert.doesNotMatch(compose, /privileged:/);
});
