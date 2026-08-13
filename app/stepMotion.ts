export type StepSource = "motion" | "demo" | "healthkit" | "health-connect";

export type MotionSample = {
  x: number | null;
  y: number | null;
  z: number | null;
  observedAt: number;
};

export type StepMotionOptions = {
  threshold?: number;
  releaseThreshold?: number;
  minimumCadenceMs?: number;
  maximumAcceleration?: number;
};

export type StepMotionState = {
  aboveThreshold: boolean;
  lastAcceptedAt: number | null;
};

export type StepMotionResult = {
  state: StepMotionState;
  accepted: boolean;
};

export type StepDelta = {
  source: StepSource;
  delta: number;
  observedAt: number;
};

export type StepRuntimeState = {
  movementSequence: number;
  acceptedSteps: number;
};

const GRAVITY = 9.81;
const DEFAULT_THRESHOLD = 1.35;
const DEFAULT_RELEASE_THRESHOLD = 0.7;
const DEFAULT_MINIMUM_CADENCE_MS = 300;
const DEFAULT_MAXIMUM_ACCELERATION = 80;
const MAX_DELTA = 100_000;
const STEP_SOURCES = new Set<StepSource>(["motion", "demo", "healthkit", "health-connect"]);

const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const finiteOption = (value: number | undefined, fallback: number, minimum: number): number => (
  isFiniteNumber(value) && value >= minimum ? value : fallback
);

export function createStepMotionState(): StepMotionState {
  return { aboveThreshold: false, lastAcceptedAt: null };
}

export function resetStepMotionState(): StepMotionState {
  return createStepMotionState();
}

export function detectStep(
  state: StepMotionState,
  sample: MotionSample,
  options: StepMotionOptions = {},
): StepMotionResult {
  const threshold = finiteOption(options.threshold, DEFAULT_THRESHOLD, Number.EPSILON);
  const releaseThreshold = Math.min(
    finiteOption(options.releaseThreshold, DEFAULT_RELEASE_THRESHOLD, 0),
    threshold,
  );
  const minimumCadenceMs = finiteOption(options.minimumCadenceMs, DEFAULT_MINIMUM_CADENCE_MS, 0);
  const maximumAcceleration = finiteOption(options.maximumAcceleration, DEFAULT_MAXIMUM_ACCELERATION, GRAVITY);

  if (
    !isFiniteNumber(sample.x)
    || !isFiniteNumber(sample.y)
    || !isFiniteNumber(sample.z)
    || !isFiniteNumber(sample.observedAt)
    || sample.observedAt < 0
    || Math.abs(sample.x) > maximumAcceleration
    || Math.abs(sample.y) > maximumAcceleration
    || Math.abs(sample.z) > maximumAcceleration
  ) {
    return { state, accepted: false };
  }

  const magnitude = Math.hypot(sample.x, sample.y, sample.z);
  if (!Number.isFinite(magnitude) || magnitude > maximumAcceleration) {
    return { state, accepted: false };
  }
  const deviation = Math.abs(magnitude - GRAVITY);

  if (state.aboveThreshold) {
    if (deviation <= releaseThreshold) {
      return { state: { ...state, aboveThreshold: false }, accepted: false };
    }
    return { state, accepted: false };
  }

  if (deviation < threshold) return { state, accepted: false };

  const elapsed = state.lastAcceptedAt == null ? Number.POSITIVE_INFINITY : sample.observedAt - state.lastAcceptedAt;
  const accepted = elapsed >= minimumCadenceMs;
  return {
    state: {
      aboveThreshold: true,
      lastAcceptedAt: accepted ? sample.observedAt : state.lastAcceptedAt,
    },
    accepted,
  };
}

export function createStepRuntimeState(): StepRuntimeState {
  return { movementSequence: 0, acceptedSteps: 0 };
}

export function acceptStepDelta(
  state: StepRuntimeState,
  event: StepDelta,
): { state: StepRuntimeState; acceptedDelta: number } {
  if (
    !Number.isSafeInteger(state.movementSequence)
    || state.movementSequence < 0
    || !Number.isSafeInteger(state.acceptedSteps)
    || state.acceptedSteps < 0
    || !STEP_SOURCES.has(event.source)
    || !Number.isSafeInteger(event.delta)
    || event.delta <= 0
    || event.delta > MAX_DELTA
    || !isFiniteNumber(event.observedAt)
    || event.observedAt < 0
    || state.acceptedSteps > Number.MAX_SAFE_INTEGER - event.delta
    || state.movementSequence >= Number.MAX_SAFE_INTEGER
  ) {
    return { state, acceptedDelta: 0 };
  }

  return {
    state: {
      movementSequence: state.movementSequence + 1,
      acceptedSteps: state.acceptedSteps + event.delta,
    },
    acceptedDelta: event.delta,
  };
}
