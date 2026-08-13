import assert from "node:assert/strict";
import test from "node:test";
import { UNIVERSES } from "../app/gameData";
import {
  ATLAS_PLANE_ROWS,
  ATLAS_VARIANT_COUNT,
  ROUTE_LOCAL_PARALLAX_STRENGTH_PX,
  ROUTE_RENDER_WINDOW_SIZE,
  VISUAL_PLANES,
  WORLD_ROUTE_SEGMENT_COUNT,
  getLocalParallaxPx,
  getRouteRenderSegments,
  getRouteSceneState,
  getWorldLayerAtlasPath,
  getWorldRouteSegments,
} from "../app/worldVisualData";

function compositionKey(segment: ReturnType<typeof getWorldRouteSegments>[number]): string {
  return VISUAL_PLANES.map((plane) => segment.layers[plane].variant).join("-");
}

test("every universe owns twenty deterministic four-plane atlas segments", () => {
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
      for (const plane of VISUAL_PLANES) {
        const layer = segment.layers[plane];
        assert.equal(layer.atlasColumn, layer.variant);
        assert.equal(layer.atlasRow, ATLAS_PLANE_ROWS[plane]);
        assert.equal(layer.atlasXPercent, layer.variant * (100 / 3));
        assert.equal(layer.atlasYPercent, ATLAS_PLANE_ROWS[plane] * (100 / 3));
        assert.ok(layer.variant >= 0 && layer.variant < ATLAS_VARIANT_COUNT);
      }
    }
  }
});

test("every world has twenty unique balanced compositions without adjacent repeats", () => {
  for (const universe of UNIVERSES) {
    const segments = getWorldRouteSegments(universe.id);
    assert.equal(new Set(segments.map(compositionKey)).size, WORLD_ROUTE_SEGMENT_COUNT);
    for (const plane of VISUAL_PLANES) {
      const counts = Array.from({ length: ATLAS_VARIANT_COUNT }, (_, variant) =>
        segments.filter((segment) => segment.layers[plane].variant === variant).length,
      );
      assert.deepEqual(counts, [5, 5, 5, 5]);
    }
    for (let index = 1; index < segments.length; index += 1) {
      const changedPlanes = VISUAL_PLANES.filter(
        (plane) => segments[index - 1].layers[plane].variant !== segments[index].layers[plane].variant,
      ).length;
      assert.ok(changedPlanes >= 2);
      if (index % 5 === 0) assert.equal(changedPlanes, 4);
    }
  }
});

test("landforms progress through four coherent five-segment acts", () => {
  for (const universe of UNIVERSES) {
    const segments = getWorldRouteSegments(universe.id);
    for (let act = 0; act < 4; act += 1) {
      const actSegments = segments.slice(act * 5, act * 5 + 5);
      assert.deepEqual(actSegments.map((segment) => segment.landformIndex), [act, act, act, act, act]);
      assert.equal(new Set(actSegments.map((segment) => segment.landform)).size, 1);
      assert.deepEqual(actSegments.map((segment) => segment.landmark), [false, false, false, false, true]);
      assert.deepEqual(actSegments.map((segment) => segment.layers.far.variant), [act, act, act, act, act]);
      assert.deepEqual(actSegments.map((segment) => segment.layers.terrain.variant), [act, act, act, act, act]);
      assert.deepEqual(
        actSegments.map((segment) => segment.layers.mid.variant),
        [0, 1, 2, 3, 0].map((variant) => (variant + act) % ATLAS_VARIANT_COUNT),
      );
      assert.deepEqual(
        actSegments.map((segment) => segment.layers.near.variant),
        [0, 2, 3, 1, 2].map((variant) => (variant + act) % ATLAS_VARIANT_COUNT),
      );
    }
  }
});

test("all universe layer atlases use stable project paths", () => {
  const paths = UNIVERSES.map((universe) => getWorldLayerAtlasPath(universe.id));
  assert.equal(new Set(paths).size, UNIVERSES.length);
  for (const universe of UNIVERSES) {
    assert.equal(getWorldLayerAtlasPath(universe.id), `/worlds/layers/${universe.id}-layers.webp`);
  }
});

function assertClose(actual: number, expected: number, epsilon = 1e-9): void {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} is not within ${epsilon} of ${expected}`);
}

function recoveredCameraSegments(scene: ReturnType<typeof getRouteSceneState>): number {
  return scene.renderWindowStart + (-scene.renderTrackPercent / 100) * ROUTE_RENDER_WINDOW_SIZE;
}

test("route scene clamps invalid, negative and completed progress", () => {
  const universe = UNIVERSES[0];
  const start = getRouteSceneState(universe.id, -20, universe.routeGoal);
  assert.equal(start.routeProgress, 0);
  assert.equal(start.segmentIndex, 0);
  assert.equal(start.renderWindowStart, 0);
  assert.equal(start.renderTrackPercent, 0);
  assert.deepEqual(getRouteRenderSegments(universe.id, start).map((segment) => segment.index), [0, 1, 2]);

  const invalid = getRouteSceneState(universe.id, Number.NaN, 0);
  assert.equal(invalid.routeProgress, 0);

  const end = getRouteSceneState(universe.id, universe.routeGoal * 2, universe.routeGoal);
  assert.equal(end.routeProgress, 1);
  assert.equal(end.segmentIndex, WORLD_ROUTE_SEGMENT_COUNT - 1);
  assert.equal(end.renderWindowStart, WORLD_ROUTE_SEGMENT_COUNT - ROUTE_RENDER_WINDOW_SIZE);
  assertClose(end.renderTrackPercent, -(2 / ROUTE_RENDER_WINDOW_SIZE) * 100);
  assert.deepEqual(getRouteRenderSegments(universe.id, end).map((segment) => segment.index), [17, 18, 19]);
});

test("one shared three-segment window feeds all four planes with three foreground masks", () => {
  for (const universe of UNIVERSES) {
    for (const steps of [0, universe.routeGoal * 0.13, universe.routeGoal * 0.52, universe.routeGoal]) {
      const scene = getRouteSceneState(universe.id, steps, universe.routeGoal);
      const renderSegments = getRouteRenderSegments(universe.id, scene);
      const expectedIds = renderSegments.map((segment) => segment.id);
      assert.equal(renderSegments.length, ROUTE_RENDER_WINDOW_SIZE);
      for (const plane of VISUAL_PLANES) {
        assert.deepEqual(renderSegments.map((segment) => segment.id), expectedIds, `${plane} diverged`);
        assert.ok(renderSegments.every((segment) => segment.layers[plane].plane === plane));
      }
      const renderedSurfaces = renderSegments.length * VISUAL_PLANES.length + renderSegments.length;
      assert.equal(renderedSurfaces, 15);
      assert.ok(renderSegments.some((segment) => segment.index === scene.segmentIndex));
    }
  }
});

test("window changes preserve the exact absolute camera at every segment boundary", () => {
  const universe = UNIVERSES[1];
  const cameraToSteps = (cameraSegments: number) =>
    (cameraSegments / (WORLD_ROUTE_SEGMENT_COUNT - 1)) * universe.routeGoal;
  const epsilon = 1e-7;

  for (let boundary = 1; boundary < WORLD_ROUTE_SEGMENT_COUNT; boundary += 1) {
    const beforeCamera = boundary - epsilon;
    const afterCamera = Math.min(WORLD_ROUTE_SEGMENT_COUNT - 1, boundary + epsilon);
    const before = getRouteSceneState(universe.id, cameraToSteps(beforeCamera), universe.routeGoal);
    const at = getRouteSceneState(universe.id, cameraToSteps(boundary), universe.routeGoal);
    const after = getRouteSceneState(universe.id, cameraToSteps(afterCamera), universe.routeGoal);

    assertClose(recoveredCameraSegments(before), before.cameraSegments);
    assertClose(recoveredCameraSegments(at), at.cameraSegments);
    assertClose(recoveredCameraSegments(after), after.cameraSegments);
    assert.ok(after.renderWindowStart - before.renderWindowStart >= 0);
    assert.ok(after.renderWindowStart - before.renderWindowStart <= 1);
    assertClose(
      recoveredCameraSegments(after) - recoveredCameraSegments(before),
      after.cameraSegments - before.cameraSegments,
    );
  }
});

test("local parallax is deterministic, cell-local, bounded and continuous", () => {
  for (const plane of VISUAL_PLANES) {
    const strength = ROUTE_LOCAL_PARALLAX_STRENGTH_PX[plane];
    assertClose(getLocalParallaxPx(plane, 8, 8), 0);
    assertClose(getLocalParallaxPx(plane, 6, 8), -strength);
    assertClose(getLocalParallaxPx(plane, 10, 8), strength);

    for (const camera of [0, 0.5, 7.9999999, 8, 8.0000001, 19, Number.NaN]) {
      assert.ok(Math.abs(getLocalParallaxPx(plane, camera, 8)) <= Math.abs(strength));
    }

    const epsilon = 1e-7;
    const before = getLocalParallaxPx(plane, 8 - epsilon, 8);
    const after = getLocalParallaxPx(plane, 8 + epsilon, 8);
    assertClose(before, -epsilon * strength, 1e-12);
    assertClose(after, epsilon * strength, 1e-12);
    assertClose(after - before, 2 * epsilon * strength, 1e-12);
  }
});

test("step-derived camera state is deterministic and advances only with accepted steps", () => {
  const universe = UNIVERSES[4];
  const first = getRouteSceneState(universe.id, 500, universe.routeGoal);
  const repeated = getRouteSceneState(universe.id, 500, universe.routeGoal);
  const after = getRouteSceneState(universe.id, 501, universe.routeGoal);
  assert.deepEqual(first, repeated);
  assert.ok(after.cameraSegments > first.cameraSegments);
  assert.ok(recoveredCameraSegments(after) > recoveredCameraSegments(first));
});
