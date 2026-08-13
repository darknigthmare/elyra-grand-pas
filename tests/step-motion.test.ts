import assert from "node:assert/strict";
import test from "node:test";
import {
  acceptStepDelta,
  createStepMotionState,
  createStepRuntimeState,
  detectStep,
  resetStepMotionState,
  type MotionSample,
} from "../app/stepMotion";

const sample = (z: number, observedAt: number): MotionSample => ({ x: 0, y: 0, z, observedAt });

test("stationary noise never produces a step", () => {
  let state = createStepMotionState();
  for (let index = 0; index < 80; index += 1) {
    const result = detectStep(state, sample(9.81 + Math.sin(index) * 0.3, index * 25));
    state = result.state;
    assert.equal(result.accepted, false);
  }
});

test("a full peak produces one step and a held peak cannot repeat", () => {
  let state = createStepMotionState();
  let result = detectStep(state, sample(12.1, 1_000));
  assert.equal(result.accepted, true);
  state = result.state;
  result = detectStep(state, sample(12.4, 1_400));
  assert.equal(result.accepted, false);
  state = result.state;
  result = detectStep(state, sample(9.9, 1_450));
  assert.equal(result.accepted, false);
  assert.equal(result.state.aboveThreshold, false);
});

test("cadence rejects close peaks and accepts a later peak", () => {
  let state = detectStep(createStepMotionState(), sample(12, 1_000)).state;
  state = detectStep(state, sample(9.81, 1_060)).state;
  let result = detectStep(state, sample(12, 1_180));
  assert.equal(result.accepted, false);
  state = detectStep(result.state, sample(9.81, 1_220)).state;
  result = detectStep(state, sample(12, 1_340));
  assert.equal(result.accepted, true);
});

test("reset clears the peak latch and cadence checkpoint", () => {
  const stepped = detectStep(createStepMotionState(), sample(12, 5_000));
  assert.equal(stepped.accepted, true);
  const reset = resetStepMotionState();
  assert.deepEqual(reset, { aboveThreshold: false, lastAcceptedAt: null });
  assert.equal(detectStep(reset, sample(12, 5_010)).accepted, true);
});

test("invalid and extreme samples are ignored", () => {
  const initial = createStepMotionState();
  const invalidSamples: MotionSample[] = [
    { x: null, y: 0, z: 12, observedAt: 1 },
    { x: Number.NaN, y: 0, z: 12, observedAt: 2 },
    { x: 0, y: Number.POSITIVE_INFINITY, z: 12, observedAt: 3 },
    { x: 0, y: 0, z: 120, observedAt: 4 },
    { x: 0, y: 0, z: 12, observedAt: Number.NaN },
  ];
  for (const invalid of invalidSamples) {
    assert.deepEqual(detectStep(initial, invalid), { state: initial, accepted: false });
  }
});

test("vector magnitude and malformed detector options cannot create false steps", () => {
  const initial = createStepMotionState();
  assert.equal(detectStep(initial, { x: 60, y: 60, z: 60, observedAt: 10 }).accepted, false);

  const malformed = detectStep(initial, sample(9.81, 20), {
    threshold: Number.NaN,
    releaseThreshold: -1,
    minimumCadenceMs: Number.POSITIVE_INFINITY,
    maximumAcceleration: Number.NaN,
  });
  assert.equal(malformed.accepted, false);
});


test("runtime advances its visual sequence only for valid deltas", () => {
  const initial = createStepRuntimeState();
  const invalid = acceptStepDelta(initial, { source: "motion", delta: 0, observedAt: 10 });
  assert.deepEqual(invalid, { state: initial, acceptedDelta: 0 });
  const first = acceptStepDelta(initial, { source: "motion", delta: 1, observedAt: 20 });
  assert.equal(first.acceptedDelta, 1);
  assert.deepEqual(first.state, { movementSequence: 1, acceptedSteps: 1 });
  const batch = acceptStepDelta(first.state, { source: "health-connect", delta: 27, observedAt: 30 });
  assert.equal(batch.acceptedDelta, 27);
  assert.deepEqual(batch.state, { movementSequence: 2, acceptedSteps: 28 });
});

test("runtime rejects malformed, oversized and overflowing deltas", () => {
  const initial = createStepRuntimeState();
  for (const delta of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 100_001]) {
    assert.equal(acceptStepDelta(initial, { source: "demo", delta, observedAt: 1 }).acceptedDelta, 0);
  }
  const full = { movementSequence: Number.MAX_SAFE_INTEGER, acceptedSteps: Number.MAX_SAFE_INTEGER };
  assert.equal(acceptStepDelta(full, { source: "healthkit", delta: 1, observedAt: 2 }).acceptedDelta, 0);
});
