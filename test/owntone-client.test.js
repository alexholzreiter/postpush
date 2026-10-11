import assert from "node:assert/strict";
import test from "node:test";
import { isAirPlayOutput, isReadyAirPlayOutput, OwnToneClient, selectOutputIds } from "../src/owntone-client.js";

test("only ready AirPlay outputs are selected", () => {
  const outputs = [
    { id: "kitchen", type: "AirPlay" },
    { id: "office", type: "AirPlay 2" },
    { id: "locked", type: "AirPlay 2", requires_auth: true },
    { id: "local", type: "ALSA" },
  ];
  assert.equal(isAirPlayOutput(outputs[1]), true);
  assert.equal(isReadyAirPlayOutput(outputs[2]), false);
  assert.deepEqual(selectOutputIds(outputs, { useAllOutputs: true, selectedOutputIds: [] }), [
    "kitchen",
    "office",
  ]);
  assert.deepEqual(
    selectOutputIds(outputs, { useAllOutputs: false, selectedOutputIds: ["office", "locked"] }),
    ["office"]
  );
});

test("output preparation selects speakers before setting volume through the player endpoint", async () => {
  const requests = [];
  const client = new OwnToneClient("http://owntone.test", {
    fetch: async (url, options) => {
      requests.push({ body: options.body, method: options.method, url });
      if (url.endsWith("/api/outputs")) {
        return {
          headers: { get: () => "application/json" },
          ok: true,
          status: 200,
          json: async () => ({
            outputs: [
              { id: "200988995313997", selected: true },
              { id: "134524895452726", selected: true },
            ],
          }),
        };
      }
      return {
        headers: { get: () => "" },
        ok: true,
        status: 204,
        text: async () => "",
      };
    },
  });

  await client.prepareOutputs(["200988995313997", "134524895452726"], 55);

  assert.deepEqual(requests, [
    {
      body: JSON.stringify({ outputs: ["200988995313997", "134524895452726"] }),
      method: "PUT",
      url: "http://owntone.test/api/outputs/set",
    },
    {
      body: undefined,
      method: undefined,
      url: "http://owntone.test/api/outputs",
    },
    {
      body: undefined,
      method: undefined,
      url: "http://owntone.test/api/outputs",
    },
    {
      body: undefined,
      method: "PUT",
      url: "http://owntone.test/api/player/volume?output_id=200988995313997&volume=55",
    },
    {
      body: undefined,
      method: "PUT",
      url: "http://owntone.test/api/player/volume?output_id=134524895452726&volume=55",
    },
  ]);
});

test("output preparation toggles a speaker when bulk selection did not activate it", async () => {
  const requests = [];
  let outputReads = 0;
  const client = new OwnToneClient("http://owntone.test", {
    activationPollDelayMs: 0,
    fetch: async (url, options) => {
      requests.push({ method: options.method, url });
      if (url.endsWith("/api/outputs")) {
        outputReads += 1;
        return {
          headers: { get: () => "application/json" },
          ok: true,
          status: 200,
          json: async () => ({
            outputs: [{ id: "office", selected: outputReads > 1 }],
          }),
        };
      }
      return {
        headers: { get: () => "" },
        ok: true,
        status: 204,
        text: async () => "",
      };
    },
  });

  await client.prepareOutputs(["office"], 70);

  assert.ok(
    requests.some(
      (request) =>
        request.method === "PUT" && request.url.endsWith("/api/outputs/office/toggle")
    )
  );
});

test("output preparation fails when OwnTone never activates the requested speaker", async () => {
  const client = new OwnToneClient("http://owntone.test", {
    activationPollDelayMs: 0,
    retryDelayMs: 0,
    fetch: async (url) => {
      if (url.endsWith("/api/outputs")) {
        return {
          headers: { get: () => "application/json" },
          ok: true,
          status: 200,
          json: async () => ({ outputs: [{ id: "office", selected: false }] }),
        };
      }
      return {
        headers: { get: () => "" },
        ok: true,
        status: 204,
        text: async () => "",
      };
    },
  });

  await assert.rejects(
    client.prepareOutputs(["office"], 70),
    /could not activate the selected HomePods/
  );
});

test("several tracks are queued in order with a single request", async () => {
  const requests = [];
  const client = new OwnToneClient("http://owntone.test", {
    fetch: async (url, options) => {
      requests.push({ method: options.method, url });
      if (url.endsWith("/api/outputs")) {
        return {
          headers: { get: () => "application/json" },
          ok: true,
          status: 200,
          json: async () => ({ outputs: [{ id: "kitchen", selected: true }] }),
        };
      }
      if (url.includes("/api/queue/items/add")) {
        return {
          headers: { get: () => "application/json" },
          ok: true,
          status: 200,
          json: async () => ({ count: 3 }),
        };
      }
      return { headers: { get: () => "" }, ok: true, status: 204, text: async () => "" };
    },
  });

  await client.playTracks(
    [{ uri: "library:track:1" }, { uri: "library:track:2" }, { uri: "library:track:3" }],
    ["kitchen"],
    50
  );

  const added = new URL(requests.find((request) => request.url.includes("/api/queue/items/add")).url);
  assert.equal(added.searchParams.get("uris"), "library:track:1,library:track:2,library:track:3");
  assert.equal(added.searchParams.get("playback"), "start");
});
