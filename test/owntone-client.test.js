import assert from "node:assert/strict";
import test from "node:test";
import { isAirPlayOutput, isReadyAirPlayOutput, selectOutputIds } from "../src/owntone-client.js";

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
