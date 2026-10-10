import assert from "node:assert/strict";
import test from "node:test";
import { evaluateMailEvent, isMailPayload, isWithinActiveWindow } from "../src/schedule.js";

function localDate(hours, minutes = 0) {
  const date = new Date(2026, 9, 11, hours, minutes, 0, 0);
  return date;
}

test("daytime window is active from 05:00 until before 22:00", () => {
  assert.equal(isWithinActiveWindow(localDate(4, 59), "05:00", "22:00"), false);
  assert.equal(isWithinActiveWindow(localDate(5), "05:00", "22:00"), true);
  assert.equal(isWithinActiveWindow(localDate(21, 59), "05:00", "22:00"), true);
  assert.equal(isWithinActiveWindow(localDate(22), "05:00", "22:00"), false);
});

test("overnight window crosses midnight", () => {
  assert.equal(isWithinActiveWindow(localDate(23), "22:00", "05:00"), true);
  assert.equal(isWithinActiveWindow(localDate(3), "22:00", "05:00"), true);
  assert.equal(isWithinActiveWindow(localDate(12), "22:00", "05:00"), false);
});

test("event decision applies switch, schedule and cooldown", () => {
  const settings = {
    activeFrom: "05:00",
    activeUntil: "22:00",
    cooldownSeconds: 30,
    enabled: true,
    scheduleEnabled: true,
  };
  assert.equal(evaluateMailEvent(settings, { now: localDate(1) }).reason, "quiet-hours");
  const now = localDate(12);
  assert.equal(evaluateMailEvent(settings, { now }).accepted, true);
  assert.equal(
    evaluateMailEvent(settings, { now, lastAcceptedAt: now.getTime() - 1000 }).reason,
    "cooldown"
  );
  assert.equal(evaluateMailEvent({ ...settings, enabled: false }, { now }).reason, "disabled");
});

test("mail payload accepts only explicit event values", () => {
  assert.equal(isMailPayload('{"event":"mail"}'), true);
  assert.equal(isMailPayload('{"post":true}'), true);
  assert.equal(isMailPayload("on"), true);
  assert.equal(isMailPayload('{"occupancy":true}'), false);
  assert.equal(isMailPayload("hello"), false);
});
