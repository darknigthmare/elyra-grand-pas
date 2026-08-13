import assert from "node:assert/strict";
import test from "node:test";
import { ALL_ENCOUNTERS, UNIVERSES } from "../app/gameData";
import {
  addStepsToSave,
  claimUniverseQuest,
  createDefaultSave,
  isUniverseUnlocked,
  normalizeSave,
  resolveEncounter,
  selectUniverse,
  type GameSave,
} from "../app/gameEngine";

const DATE = "2026-08-13";

function emptySave(): GameSave {
  const seed = createDefaultSave(DATE);
  return {
    ...seed,
    stepsToday: 0,
    totalSteps: 0,
    leaves: 0,
    sparks: 0,
    worldProgress: Object.fromEntries(
      UNIVERSES.map(({ id }) => [id, { steps: 0, dailySteps: 0, claimedQuest: false }]),
    ) as GameSave["worldProgress"],
    resolvedEncounters: [],
    pendingEncounters: [],
    journal: [],
  };
}

test("the seven-universe registry has unique and coherent progression data", () => {
  assert.equal(UNIVERSES.length, 7);
  assert.equal(new Set(UNIVERSES.map(({ id }) => id)).size, 7);
  assert.equal(new Set(ALL_ENCOUNTERS.map(({ id }) => id)).size, ALL_ENCOUNTERS.length);
  let unlockAt = 0;
  for (const [index, universe] of UNIVERSES.entries()) {
    assert.equal(universe.order, index + 1);
    assert.equal(universe.unlockAt, unlockAt);
    assert.ok(universe.questGoal <= universe.routeGoal);
    unlockAt += universe.routeGoal;
  }
  assert.deepEqual(UNIVERSES[0].encounters.map(({ at }) => at), [2000, 2350]);
});

test("a large step batch queues every crossed encounter once and tracks daily progress", () => {
  const crossed = addStepsToSave(emptySave(), 2400);
  assert.equal(crossed.stepsToday, 2400);
  assert.equal(crossed.worldProgress["vallee-elyra"].steps, 2400);
  assert.equal(crossed.worldProgress["vallee-elyra"].dailySteps, 2400);
  assert.deepEqual(crossed.pendingEncounters, ["lume", "milo"]);
  assert.deepEqual(addStepsToSave(crossed, 100).pendingEncounters, ["lume", "milo"]);
});

test("non-finite, negative and sub-step additions are rejected", () => {
  const save = emptySave();
  assert.strictEqual(addStepsToSave(save, Number.POSITIVE_INFINITY), save);
  assert.strictEqual(addStepsToSave(save, Number.NaN), save);
  assert.strictEqual(addStepsToSave(save, -10), save);
  assert.strictEqual(addStepsToSave(save, 0.5), save);
});

test("only pending encounters with an exact valid choice can be resolved", () => {
  const save = emptySave();
  assert.strictEqual(resolveEncounter(save, "lume", "L’appeler Lume"), save);

  const pending = addStepsToSave(save, 2000);
  assert.deepEqual(pending.pendingEncounters, ["lume"]);
  assert.strictEqual(resolveEncounter(pending, "lume", "Choix inventé"), pending);

  const resolved = resolveEncounter(pending, "lume", "L’appeler Lume", "2026-08-13T08:00:00.000Z");
  assert.equal(resolved.leaves, 4);
  assert.equal(resolved.sparks, 1);
  assert.deepEqual(resolved.pendingEncounters, []);
  assert.deepEqual(resolved.resolvedEncounters, ["lume"]);
  assert.equal(resolved.journal[0].choice, "L’appeler Lume");
  assert.strictEqual(resolveEncounter(resolved, "lume", "L’appeler Lume"), resolved);
});

test("universe selection and normalization reject locked worlds", () => {
  const below = { ...emptySave(), totalSteps: 2399 };
  assert.equal(isUniverseUnlocked(below, "royaumes-couronne"), false);
  assert.strictEqual(selectUniverse(below, "royaumes-couronne"), below);

  const boundary = { ...below, totalSteps: 2400 };
  assert.equal(selectUniverse(boundary, "royaumes-couronne").activeUniverseId, "royaumes-couronne");

  const corrupted = { ...emptySave(), activeUniverseId: "aetheria" } as GameSave;
  assert.equal(normalizeSave(corrupted, DATE).activeUniverseId, "vallee-elyra");
});

test("legacy saves migrate safely, deduplicate ids and reconcile attained encounters", () => {
  const migrated = normalizeSave({
    steps: 2400,
    totalSteps: 9000,
    leaves: 7,
    sparks: 2,
    encounters: ["lume", "lume", "inconnu", 42],
    claimedQuest: true,
  }, DATE);
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.totalSteps, 9000);
  assert.equal(migrated.worldProgress["vallee-elyra"].steps, 2400);
  assert.equal(migrated.worldProgress["vallee-elyra"].dailySteps, 2400);
  assert.deepEqual(migrated.resolvedEncounters, ["lume"]);
  assert.deepEqual(migrated.pendingEncounters, ["milo"]);
});

test("V2 normalization sanitizes encounter state and journal entries", () => {
  const base = emptySave();
  const normalized = normalizeSave({
    ...base,
    worldProgress: {
      ...base.worldProgress,
      "vallee-elyra": { steps: 2400, dailySteps: 2400, claimedQuest: false },
    },
    resolvedEncounters: ["lume", "lume", "inconnu"],
    pendingEncounters: ["lume", "milo", "milo", "inconnu"],
    journal: [
      { encounterId: "lume", universeId: "vallee-elyra", choice: "L’appeler Lume", resolvedAt: "2026-08-13T08:00:00.000Z" },
      { encounterId: "milo", universeId: "vallee-elyra", choice: "Choix inventé", resolvedAt: "2026-08-13T09:00:00.000Z" },
      { encounterId: "milo", universeId: "aetheria", choice: "Suivre la mélodie", resolvedAt: "2026-08-13T09:00:00.000Z" },
    ],
  }, DATE);

  assert.deepEqual(normalized.resolvedEncounters, ["lume"]);
  assert.deepEqual(normalized.pendingEncounters, ["milo"]);
  assert.equal(normalized.journal.length, 1);
});

test("daily reset clears per-world quest progress without erasing campaign distance", () => {
  const completed = addStepsToSave(emptySave(), 2000);
  const claimed = claimUniverseQuest(completed);
  assert.equal(claimed.worldProgress["vallee-elyra"].claimedQuest, true);
  assert.equal(claimed.leaves, 12);

  const nextDay = normalizeSave(claimed, "2026-08-14");
  assert.equal(nextDay.stepsToday, 0);
  assert.equal(nextDay.worldProgress["vallee-elyra"].steps, 2000);
  assert.equal(nextDay.worldProgress["vallee-elyra"].dailySteps, 0);
  assert.equal(nextDay.worldProgress["vallee-elyra"].claimedQuest, false);
  assert.strictEqual(claimUniverseQuest(nextDay), nextDay);

  const reclaimed = claimUniverseQuest(addStepsToSave(nextDay, 2000));
  assert.equal(reclaimed.worldProgress["vallee-elyra"].claimedQuest, true);
  assert.equal(reclaimed.leaves, 24);
});

test("early V2 saves infer daily progress once instead of losing it", () => {
  const preview = {
    ...emptySave(),
    stepsToday: 700,
    worldProgress: Object.fromEntries(
      UNIVERSES.map(({ id }) => [
        id,
        { steps: id === "vallee-elyra" ? 800 : 0, claimedQuest: false },
      ]),
    ),
  };
  assert.equal(normalizeSave(preview, DATE).worldProgress["vallee-elyra"].dailySteps, 700);
});
