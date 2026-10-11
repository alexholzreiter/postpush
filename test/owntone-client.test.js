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
  let outputsReads = 0;
  const client = new OwnToneClient("http://owntone.test", {
    fetch: async (url, options) => {
      requests.push({ body: options.body, method: options.method, url });
      if (url.endsWith("/api/outputs")) {
        outputsReads += 1;
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
      body: JSON.stringify({ selected: true }),
      method: "PUT",
      url: "http://owntone.test/api/outputs/200988995313997",
    },
    {
      body: JSON.stringify({ selected: true }),
      method: "PUT",
      url: "http://owntone.test/api/outputs/134524895452726",
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
  assert.equal(outputsReads, 1);
});

test("output preparation fails when OwnTone never activates the requested speaker", async () => {
  const client = new OwnToneClient("http://owntone.test", {
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
    /konnte die ausgewählten HomePods nicht aktivieren/
  );
});
