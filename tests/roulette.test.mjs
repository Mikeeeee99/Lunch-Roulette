import assert from "node:assert/strict";
import test from "node:test";
import { buildCandidatePool, formatDateKey, getRecentRestaurantIds, pickDifferentMessage, pickRandomRestaurant } from "../lib/roulette.js";

const restaurants = [
  { id: "a", enabled: true },
  { id: "b", enabled: true },
  { id: "c", enabled: true },
  { id: "off", enabled: false },
];

test("formats dates using the local calendar date", () => {
  assert.equal(formatDateKey(new Date(2026, 7, 8, 12)), "2026-08-08");
});

test("excludes restaurants from the two most recent recorded lunch days", () => {
  const history = [
    { date: "2026-08-17", restaurantId: "a" },
    { date: "2026-08-14", restaurantId: "b" },
    { date: "2026-08-13", restaurantId: "c" },
    { date: "2026-08-18", restaurantId: "today" },
  ];
  assert.deepEqual(getRecentRestaurantIds(history, "2026-08-18"), ["a", "b"]);
});

test("builds a pool without recent, manual, rerolled, or disabled restaurants", () => {
  assert.deepEqual(buildCandidatePool(restaurants, ["a"], ["b"], ["off"]), [restaurants[2]]);
});

test("random selection stays inside the candidate pool", () => {
  assert.equal(pickRandomRestaurant(restaurants.slice(0, 3), () => 0).id, "a");
  assert.equal(pickRandomRestaurant(restaurants.slice(0, 3), () => 0.999).id, "c");
  assert.equal(pickRandomRestaurant([], () => 0.5), null);
});

test("result message does not immediately repeat when alternatives exist", () => {
  const messages = ["第一条", "第二条", "第三条"];
  assert.notEqual(pickDifferentMessage(messages, "第一条", () => 0), "第一条");
  assert.equal(pickDifferentMessage(["唯一一条"], "唯一一条", () => 0.5), "唯一一条");
  assert.equal(pickDifferentMessage([], "", () => 0.5), "");
});
