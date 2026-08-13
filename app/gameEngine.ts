import { ALL_ENCOUNTERS, UNIVERSE_BY_ID, UNIVERSES, type Encounter, type UniverseId } from "./gameData";

export const STORAGE_KEY_V1 = "elyra-grand-pas-v1";
export const STORAGE_KEY_V2 = "elyra-grand-pas-v2";
export const DAILY_GOAL = 5000;

export type WorldProgress = {
  steps: number;
  dailySteps: number;
  claimedQuest: boolean;
};

export type JournalEntry = {
  encounterId: string;
  universeId: UniverseId;
  choice: string;
  resolvedAt: string;
};

export type GameSave = {
  schemaVersion: 2;
  dateKey: string;
  stepsToday: number;
  totalSteps: number;
  leaves: number;
  sparks: number;
  activeUniverseId: UniverseId;
  worldProgress: Record<UniverseId, WorldProgress>;
  resolvedEncounters: string[];
  pendingEncounters: string[];
  journal: JournalEntry[];
};

type LegacySave = {
  steps?: unknown;
  totalSteps?: unknown;
  leaves?: unknown;
  sparks?: unknown;
  encounters?: unknown;
  claimedQuest?: unknown;
};

const MAX_COUNTER = Number.MAX_SAFE_INTEGER;
const ENCOUNTER_BY_ID = new Map(ALL_ENCOUNTERS.map((encounter) => [encounter.id, encounter]));

function finiteNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.min(MAX_COUNTER, Math.floor(value))
    : fallback;
}

function safeAdd(value: number, amount: number) {
  return Math.min(MAX_COUNTER, value + amount);
}

function isKnownUniverseId(value: unknown): value is UniverseId {
  return typeof value === "string" && Object.hasOwn(UNIVERSE_BY_ID, value);
}

function uniqueKnownEncounterIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const candidate of value) {
    if (typeof candidate !== "string" || seen.has(candidate) || !ENCOUNTER_BY_ID.has(candidate)) continue;
    seen.add(candidate);
    ids.push(candidate);
  }
  return ids;
}

function normalizeJournal(value: unknown): JournalEntry[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const journal: JournalEntry[] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object") continue;
    const entry = candidate as Partial<JournalEntry>;
    const encounter = typeof entry.encounterId === "string" ? ENCOUNTER_BY_ID.get(entry.encounterId) : undefined;
    if (
      !encounter
      || seen.has(encounter.id)
      || entry.universeId !== encounter.universeId
      || typeof entry.choice !== "string"
      || !(encounter.choices as readonly string[]).includes(entry.choice)
      || typeof entry.resolvedAt !== "string"
      || entry.resolvedAt.length === 0
    ) continue;
    seen.add(encounter.id);
    journal.push({
      encounterId: encounter.id,
      universeId: encounter.universeId,
      choice: entry.choice,
      resolvedAt: entry.resolvedAt,
    });
  }
  return journal;
}

function reconcileEncounterState(save: GameSave): GameSave {
  const journal = normalizeJournal(save.journal);
  const resolvedEncounters = uniqueKnownEncounterIds([
    ...save.resolvedEncounters,
    ...journal.map((entry) => entry.encounterId),
  ]);
  const resolved = new Set(resolvedEncounters);
  const pendingEncounters = ALL_ENCOUNTERS
    .filter((encounter) => (
      !resolved.has(encounter.id)
      && save.worldProgress[encounter.universeId].steps >= encounter.at
    ))
    .map((encounter) => encounter.id);

  return { ...save, resolvedEncounters, pendingEncounters, journal };
}

export function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function emptyWorldProgress(): Record<UniverseId, WorldProgress> {
  return Object.fromEntries(
    UNIVERSES.map((universe) => [universe.id, { steps: 0, dailySteps: 0, claimedQuest: false }]),
  ) as Record<UniverseId, WorldProgress>;
}

export function createDefaultSave(dateKey = localDateKey()): GameSave {
  const worldProgress = emptyWorldProgress();
  worldProgress["vallee-elyra"].steps = 1847;
  worldProgress["vallee-elyra"].dailySteps = 1847;
  return {
    schemaVersion: 2,
    dateKey,
    stepsToday: 1847,
    totalSteps: 12846,
    leaves: 12,
    sparks: 3,
    activeUniverseId: "vallee-elyra",
    worldProgress,
    resolvedEncounters: [],
    pendingEncounters: [],
    journal: [],
  };
}

export function migrateLegacySave(raw: LegacySave, dateKey = localDateKey()): GameSave {
  const save = createDefaultSave(dateKey);
  const legacySteps = finiteNumber(raw.steps, save.stepsToday);
  save.stepsToday = legacySteps;
  save.totalSteps = finiteNumber(raw.totalSteps, save.totalSteps);
  save.leaves = finiteNumber(raw.leaves, save.leaves);
  save.sparks = finiteNumber(raw.sparks, save.sparks);
  save.worldProgress["vallee-elyra"].steps = legacySteps;
  save.worldProgress["vallee-elyra"].dailySteps = legacySteps;
  save.worldProgress["vallee-elyra"].claimedQuest = raw.claimedQuest === true;
  save.resolvedEncounters = uniqueKnownEncounterIds(raw.encounters);
  return reconcileEncounterState(save);
}

export function normalizeSave(raw: unknown, dateKey = localDateKey()): GameSave {
  if (!raw || typeof raw !== "object") return createDefaultSave(dateKey);
  const value = raw as Partial<GameSave>;
  if (value.schemaVersion !== 2) return migrateLegacySave(raw as LegacySave, dateKey);

  const fallback = createDefaultSave(dateKey);
  const savedDateKey = typeof value.dateKey === "string" ? value.dateKey : dateKey;
  const changedDay = savedDateKey !== dateKey;
  const stepsToday = changedDay ? 0 : finiteNumber(value.stepsToday, fallback.stepsToday);
  const totalSteps = finiteNumber(value.totalSteps, fallback.totalSteps);
  const requestedUniverseId = isKnownUniverseId(value.activeUniverseId) ? value.activeUniverseId : fallback.activeUniverseId;
  const activeUniverseId = totalSteps >= UNIVERSE_BY_ID[requestedUniverseId].unlockAt
    ? requestedUniverseId
    : "vallee-elyra";

  const worldProgress = emptyWorldProgress();
  let hasPerWorldDailyProgress = false;
  for (const universe of UNIVERSES) {
    const candidate = value.worldProgress?.[universe.id];
    const fallbackProgress = fallback.worldProgress[universe.id];
    const steps = finiteNumber(candidate?.steps, fallbackProgress.steps);
    const hasDailySteps = typeof candidate?.dailySteps === "number"
      && Number.isFinite(candidate.dailySteps)
      && candidate.dailySteps >= 0;
    hasPerWorldDailyProgress ||= hasDailySteps;
    worldProgress[universe.id] = {
      steps,
      dailySteps: changedDay ? 0 : Math.min(steps, finiteNumber(candidate?.dailySteps, 0)),
      claimedQuest: changedDay ? false : candidate?.claimedQuest === true,
    };
  }

  // Saves created by the first V2 preview did not yet store per-world daily progress.
  if (!changedDay && !hasPerWorldDailyProgress && stepsToday > 0) {
    const progress = worldProgress[activeUniverseId];
    progress.dailySteps = Math.min(progress.steps, stepsToday);
  }

  const normalized: GameSave = {
    schemaVersion: 2,
    dateKey,
    stepsToday,
    totalSteps,
    leaves: finiteNumber(value.leaves, fallback.leaves),
    sparks: finiteNumber(value.sparks, fallback.sparks),
    activeUniverseId,
    worldProgress,
    resolvedEncounters: uniqueKnownEncounterIds(value.resolvedEncounters),
    pendingEncounters: uniqueKnownEncounterIds(value.pendingEncounters),
    journal: normalizeJournal(value.journal),
  };
  return reconcileEncounterState(normalized);
}

export function isUniverseUnlocked(save: GameSave, universeId: UniverseId) {
  const universe = UNIVERSE_BY_ID[universeId];
  return Boolean(universe && Number.isFinite(save.totalSteps) && save.totalSteps >= universe.unlockAt);
}

export function addStepsToSave(save: GameSave, amount: number): GameSave {
  if (!Number.isFinite(amount) || amount <= 0) return save;
  const safeAmount = Math.min(MAX_COUNTER, Math.floor(amount));
  if (!safeAmount) return save;
  const universe = UNIVERSE_BY_ID[save.activeUniverseId];
  if (!universe) return save;
  const currentWorld = save.worldProgress[universe.id];

  return reconcileEncounterState({
    ...save,
    stepsToday: safeAdd(save.stepsToday, safeAmount),
    totalSteps: safeAdd(save.totalSteps, safeAmount),
    worldProgress: {
      ...save.worldProgress,
      [universe.id]: {
        ...currentWorld,
        steps: safeAdd(currentWorld.steps, safeAmount),
        dailySteps: safeAdd(currentWorld.dailySteps, safeAmount),
      },
    },
  });
}

export function selectUniverse(save: GameSave, universeId: UniverseId): GameSave {
  return isUniverseUnlocked(save, universeId) ? { ...save, activeUniverseId: universeId } : save;
}

export function encounterById(id: string | undefined): Encounter | undefined {
  return id ? ENCOUNTER_BY_ID.get(id) : undefined;
}

export function resolveEncounter(save: GameSave, encounterId: string, choice: string, resolvedAt = new Date().toISOString()): GameSave {
  const encounter = encounterById(encounterId);
  if (
    !encounter
    || save.resolvedEncounters.includes(encounterId)
    || !save.pendingEncounters.includes(encounterId)
    || !(encounter.choices as readonly string[]).includes(choice)
  ) return save;

  const safeResolvedAt = typeof resolvedAt === "string" && resolvedAt.length > 0
    ? resolvedAt
    : new Date().toISOString();
  return {
    ...save,
    leaves: safeAdd(save.leaves, encounter.rewardLeaves),
    sparks: safeAdd(save.sparks, encounter.rewardSparks),
    pendingEncounters: save.pendingEncounters.filter((id) => id !== encounterId),
    resolvedEncounters: [...save.resolvedEncounters, encounterId],
    journal: [{ encounterId, universeId: encounter.universeId, choice, resolvedAt: safeResolvedAt }, ...save.journal],
  };
}

export function claimUniverseQuest(save: GameSave): GameSave {
  const universe = UNIVERSE_BY_ID[save.activeUniverseId];
  if (!universe) return save;
  const progress = save.worldProgress[universe.id];
  if (progress.claimedQuest || progress.dailySteps < universe.questGoal) return save;
  return {
    ...save,
    leaves: safeAdd(save.leaves, 10 + universe.order * 2),
    sparks: safeAdd(save.sparks, Math.floor(universe.order / 2)),
    worldProgress: {
      ...save.worldProgress,
      [universe.id]: { ...progress, claimedQuest: true },
    },
  };
}

export function unlockedCount(save: GameSave) {
  return UNIVERSES.filter((universe) => isUniverseUnlocked(save, universe.id)).length;
}
