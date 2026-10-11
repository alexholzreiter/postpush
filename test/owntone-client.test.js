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
