import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("marketing website has the expected domain and GitHub Pages workflow", async () => {
  const [html, cname, workflow, sitemap, googleVerification] = await Promise.all([
    read("website/index.html"),
    read("website/CNAME"),
    read(".github/workflows/pages.yml"),
    read("website/sitemap.xml"),
    read("website/google7afa0469d038fe76.html"),
  ]);

  assert.equal(cname.trim(), "postpush.klickwerk.digital");
  assert.match(html, /<link rel="canonical" href="https:\/\/postpush\.klickwerk\.digital\/">/);
  assert.match(sitemap, /https:\/\/postpush\.klickwerk\.digital\//);
  assert.match(workflow, /actions\/configure-pages@v5/);
  assert.match(workflow, /actions\/upload-pages-artifact@v5/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
  assert.match(workflow, /path: website/);
  assert.match(workflow, /include-hidden-files: true/);
  assert.equal(googleVerification.trim(), "google-site-verification: google7afa0469d038fe76.html");
});

test("website exposes GitHub, Runtipi, Docker, and coffee support actions", async () => {
  const html = await read("website/index.html");
  assert.match(html, /https:\/\/github\.com\/alexholzreiter\/postpush/);
  assert.match(html, /data-install-tab="runtipi"/);
  assert.match(html, /data-install-tab="docker"/);
  assert.match(html, /https:\/\/buy\.stripe\.com\/00w8wOcsV8WHdr7apqaZi04/);
  assert.match(html, /data-en="Tip a coffee" data-de="Kaffee spenden"/);
});

test("every translated marketing string includes English and German", async () => {
  const pages = await Promise.all([read("website/index.html"), read("website/about/index.html"), read("website/impressum/index.html")]);
  const translatedElements = pages.flatMap((html) => html.match(/<[^>]+data-en="[^"]*"[^>]*>/g) || []);
  assert.ok(translatedElements.length > 60);
  for (const element of translatedElements) assert.match(element, /data-de="[^"]*"/, element);

  const ariaElements = pages.flatMap((html) => html.match(/<[^>]+data-en-aria="[^"]*"[^>]*>/g) || []);
  for (const element of ariaElements) assert.match(element, /data-de-aria="[^"]*"/, element);
});

test("legal notice mirrors the published provider information and is linked site-wide", async () => {
  const [home, about, legal, sitemap] = await Promise.all([
    read("website/index.html"),
    read("website/about/index.html"),
    read("website/impressum/index.html"),
    read("website/sitemap.xml"),
  ]);
  assert.match(home, /href="impressum\/" data-en="Legal notice" data-de="Impressum"/);
  assert.match(about, /href="\.\.\/impressum\/" data-en="Legal notice" data-de="Impressum"/);
  assert.match(legal, /<title>Legal Notice — PostPush<\/title>/);
  assert.match(legal, /Laura Wagner \/ klickwerk/);
  assert.match(legal, /Dörfl 30/);
  assert.match(legal, /37872786/);
  assert.match(legal, /\+43 670 60 80 441/);
  assert.match(about, /\+43 670 60 80 441/);
  assert.doesNotMatch(home + about + legal, /\+43 677 64314340/);
  assert.match(legal, /data-en="Legal notice" data-de="Impressum"/);
  assert.match(legal, /postpush-share\.png/);
  assert.match(sitemap, /https:\/\/postpush\.klickwerk\.digital\/impressum\//);
});

test("website references only existing local visual assets", async () => {
  const html = await read("website/index.html");
  const assetPaths = [...html.matchAll(/(?:src|href)="(assets\/[^"]+)"/g)].map((match) => match[1]);
  assert.ok(assetPaths.length >= 6);
  for (const path of new Set(assetPaths)) {
    await assert.doesNotReject(readFile(new URL(`../website/${path}`, import.meta.url)));
  }
});

test("website uses PostPush branding, favicons and a dedicated social preview", async () => {
  const [home, about, shareImage] = await Promise.all([
    read("website/index.html"),
    read("website/about/index.html"),
    readFile(new URL("../website/assets/postpush-share.png", import.meta.url)),
  ]);
  assert.match(home, /assets\/postpush-icon\.png/);
  assert.match(home, /assets\/favicon\.ico/);
  assert.match(home, /assets\/favicon-32\.png/);
  assert.match(home, /assets\/apple-touch-icon\.png/);
  assert.match(home, /property="og:image" content="https:\/\/postpush\.klickwerk\.digital\/assets\/postpush-share\.png"/);
  assert.match(home, /name="twitter:card" content="summary_large_image"/);
  assert.match(home, /name="twitter:image" content="https:\/\/postpush\.klickwerk\.digital\/assets\/postpush-share\.png"/);
  assert.match(about, /assets\/postpush-icon\.png/);
  assert.match(about, /property="og:image" content="https:\/\/postpush\.klickwerk\.digital\/assets\/postpush-share\.png"/);
  assert.equal(shareImage.readUInt32BE(16), 1200);
  assert.equal(shareImage.readUInt32BE(20), 630);
});

test("structured data matches visible PostPush FAQs and the package version", async () => {
  const [html, faqData, packageJson] = await Promise.all([
    read("website/index.html"),
    read("website/ai/faq.json"),
    read("package.json"),
  ]);
  const jsonLdSource = html.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/)?.[1];
  assert.ok(jsonLdSource);

  const graph = JSON.parse(jsonLdSource)["@graph"];
  const byType = (type) => graph.find((item) => item["@type"] === type);
  assert.equal(byType("WebSite").name, "PostPush");
  assert.equal(byType("SoftwareApplication").name, "PostPush");
  assert.equal(byType("SoftwareApplication").softwareVersion, JSON.parse(packageJson).version);
  assert.equal(byType("Brand").name, "PostPush");
  assert.equal(byType("Organization").name, "klickwerk");
  assert.deepEqual(
    byType("FAQPage").mainEntity.map((item) => item.name),
    JSON.parse(faqData).items.map((item) => item.question),
  );
  assert.match(html, /<title>PostPush —/);
  assert.match(html, /<h1><span>PostPush\.<\/span>/);
  assert.match(html, /type="application\/rss\+xml"/);
});

test("AI discovery, feed, about page, and README remain consistent", async () => {
  const [llms, summary, service, feed, about, readme, packageJson] = await Promise.all([
    read("website/llms.txt"),
    read("website/ai/summary.json"),
    read("website/ai/service.json"),
    read("website/feed.xml"),
    read("website/about/index.html"),
    read("README.md"),
    read("package.json"),
  ]);
  assert.match(llms, /^# PostPush/);
  assert.equal(JSON.parse(summary).name, "PostPush");
  assert.equal(JSON.parse(service).capabilities.audioFormats.count, 6);
  assert.match(feed, new RegExp(`PostPush ${JSON.parse(packageJson).version}`));
  assert.match(about, /Created and maintained by Alexander Holzreiter/);
  assert.match(readme, /docs\/postpush-hero\.png/);
  assert.match(readme, /Tip%20a%20coffee/);
});

test("GitHub artwork uses the real logo and renders to stable PNGs", async () => {
  const [hero, flow, heroPng, flowPng] = await Promise.all([
    read("docs/postpush-hero.svg"),
    read("docs/postpush-flow.svg"),
    readFile(new URL("../docs/postpush-hero.png", import.meta.url)),
    readFile(new URL("../docs/postpush-flow.png", import.meta.url)),
  ]);
  assert.match(hero, /<image href="postpush-icon\.png"/);
  assert.match(flow, /<image href="postpush-icon\.png"/);
  assert.match(hero, /Same clean mailbox silhouette used on the project website/);
  assert.match(flow, /The sensor detects mail/);
  assert.match(flow, /PostPush prepares the message/);
  assert.match(flow, /OwnTone plays in sync/);
  assert.equal(heroPng.readUInt32BE(16), 1440);
  assert.equal(heroPng.readUInt32BE(20), 580);
  assert.equal(flowPng.readUInt32BE(16), 1200);
  assert.equal(flowPng.readUInt32BE(20), 360);
});

test("public Runtipi metadata is written in English", async () => {
  const [configSource, description] = await Promise.all([
    read("apps/postpush/config.json"),
    read("apps/postpush/metadata/description.md"),
  ]);
  const config = JSON.parse(configSource);
  assert.equal(config.version, "0.2.17");
  assert.equal(config.tipi_version, 18);
  assert.equal(config.form_fields[0].label, "MQTT broker");
  assert.match(description, /PostPush announces new mail/);
  assert.doesNotMatch(description, /Deutsch|PostPush kündigt/);
});
