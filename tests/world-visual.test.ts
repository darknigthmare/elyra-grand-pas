import assert from "node:assert/strict";
import test from "node:test";
import { UNIVERSES } from "../app/gameData";
import {
  VISUAL_PLANES,
  WORLD_ROUTE_SEGMENT_COUNT,
  getRouteSceneState,
  getWorldRouteSegments,
} from "../app/worldVisualData";

test("every universe owns twenty deterministic four-plane segments", () => {
  assert.equal(UNIVERSES.length, 7);
  for (const universe of UNIVERSES) {
    const first = getWorldRouteSegments(universe.id);
    const second = getWorldRouteSegments(universe.id);
    assert.equal(first, second);
    assert.equal(first.length, WORLD_ROUTE_SEGMENT_COUNT);
    assert.equal(new Set(first.map((segment) => segment.id)).size, WORLD_ROUTE_SEGMENT_COUNT);
    for (const segment of first) {
      assert.deepEqual(Object.keys(segment.layers), [...VISUAL_PLANES]);
      assert.ok(segment.layers.far.depth < segment.layers.mid.depth);
      assert.ok(segment.layers.mid.depth < segment.layers.terrain.depth);
      assert.ok(segment.layers.terrain.depth < segment.layers.near.depth);
      assert.ok(segment.cropX >= 12 && segment.cropX <= 88);
    }
  }
});

test("all nineteen interior joins share the same deterministic cover prop", () => {
  for (const universe of UNIVERSES) {
    const segments = getWorldRouteSegments(universe.id);
    for (let index = 0; index < segments.length - 1; index += 1) {
      assert.deepEqual(segments[index].exitJoin, segments[index + 1].entryJoin);
    }
  }
});

test("route scene clamps invalid, negative and completed progress", () => {
  const universe = UNIVERSES[0];
  const start = getRouteSceneState(universe.id, -20, universe.routeGoal);
  assert.equal(start.routeProgress, 0);
  assert.equal(start.segmentIndex, 0);
  assert.equal(start.trackPercent, 0);

  const invalid = getRouteSceneState(universe.id, Number.NaN, 0);
  assert.equal(invalid.routeProgress, 0);

  const end = getRouteSceneState(universe.id, universe.routeGoal * 2, universe.routeGoal);
  assert.equal(end.routeProgress, 1);
  assert.equal(end.segmentIndex, WORLD_ROUTE_SEGMENT_COUNT - 1);
  assert.equal(end.trackPercent, -95);
});

test("step-derived camera state is deterministic and parallax depth is ordered", () => {
  const universe = UNIVERSES[2];
  const first = getRouteSceneState(universe.id, 1_731, universe.routeGoal);
  const second = getRouteSceneState(universe.id, 1_731, universe.routeGoal);
  assert.deepEqual(first, second);
  assert.ok(Math.abs(first.parallaxPx.far) <= Math.abs(first.parallaxPx.mid));
  assert.ok(Math.abs(first.parallaxPx.mid) <= Math.abs(first.parallaxPx.terrain));
  assert.ok(Math.abs(first.parallaxPx.terrain) <= Math.abs(first.parallaxPx.near));
});

test("each accepted step advances the absolute camera without time input", () => {
  const universe = UNIVERSES[4];
  const before = getRouteSceneState(universe.id, 500, universe.routeGoal);
  const after = getRouteSceneState(universe.id, 501, universe.routeGoal);
  assert.ok(after.cameraSegments > before.cameraSegments);
  assert.ok(after.trackPercent < before.trackPercent);
});

test("parallax remains monotonic across every segment boundary", () => {
  const universe = UNIVERSES[0];
  const stepsPerSegment = universe.routeGoal / (WORLD_ROUTE_SEGMENT_COUNT - 1);
  for (let boundary = 1; boundary < WORLD_ROUTE_SEGMENT_COUNT - 1; boundary += 1) {
    const boundarySteps = boundary * stepsPerSegment;
    const before = getRouteSceneState(universe.id, boundarySteps - 0.001, universe.routeGoal);
    const after = getRouteSceneState(universe.id, boundarySteps + 0.001, universe.routeGoal);
    for (const plane of VISUAL_PLANES) {
      assert.ok(after.parallaxPx[plane] < before.parallaxPx[plane]);
    }
  }
});
