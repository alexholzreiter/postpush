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

test("application, image and Runtipi versions stay synchronized", () => {
  const version = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;
  const config = JSON.parse(fs.readFileSync(path.join(storeApp, "config.json"), "utf8"));
  const compose = fs.readFileSync(path.join(storeApp, "docker-compose.yml"), "utf8");
  assert.equal(config.version, version);
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

test("PostPush ports do not collide with the Ring reference app", () => {
  const compose = fs.readFileSync(path.join(storeApp, "docker-compose.yml"), "utf8");
  assert.match(compose, /WEB_PORT: "8586"/);
  assert.match(compose, /port = 3690/);
  assert.doesNotMatch(compose, /port = 3689/);
});

test("OwnTone starts without privileged OpenRC init and gates PostPush readiness", () => {
  const compose = fs.readFileSync(path.join(storeApp, "docker-compose.yml"), "utf8");
  assert.match(compose, /condition: service_healthy/);
  assert.match(compose, /rc-service dbus start/);
  assert.match(compose, /rc-service avahi-daemon start/);
  assert.match(compose, /exec \/usr\/sbin\/owntone -f/);
  assert.match(compose, /127\.0\.0\.1:3690\/api\/config/);
  assert.doesNotMatch(compose, /privileged:/);
  assert.doesNotMatch(compose, /exec \/sbin\/init/);
});
