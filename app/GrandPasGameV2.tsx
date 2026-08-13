"use client";

import Image from "next/image";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { UNIVERSE_BY_ID, UNIVERSES, type UniverseId } from "./gameData";
import {
  DAILY_GOAL,
  STORAGE_KEY_V1,
  STORAGE_KEY_V2,
  addStepsToSave,
  claimUniverseQuest,
  createDefaultSave,
  encounterById,
  isUniverseUnlocked,
  localDateKey,
  migrateLegacySave,
  normalizeSave,
  resolveEncounter,
  selectUniverse,
  unlockedCount,
  type GameSave,
} from "./gameEngine";
import {
  acceptStepDelta,
  createStepMotionState,
  createStepRuntimeState,
  detectStep,
  resetStepMotionState,
  type StepSource,
} from "./stepMotion";
import {
  VISUAL_PLANES,
  WORLD_ROUTE_SEGMENT_COUNT,
  getLocalParallaxPx,
  getRouteRenderSegments,
  getRouteSceneState,
  getWorldLayerAtlasPath,
  type VisualPlane,
  type VisualSegment,
} from "./worldVisualData";


type Tab = "voyage" | "mondes" | "journal" | "refuge";
type SensorMode = "idle" | "motion" | "demo";
type RefugeProgress = { refugeLevel: number; observatoryLevel: number };

const REFUGE_STORAGE_KEY = "elyra_refuge_v1";
const HYDRATION_DATE_KEY = "1970-01-01";
const DEFAULT_REFUGE: RefugeProgress = { refugeLevel: 1, observatoryLevel: 0 };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const formatSteps = (value: number) => new Intl.NumberFormat("fr-FR").format(value);

function Icon({ name }: { name: string }) {
  const icons: Record<string, string> = { foot: "◒", leaf: "❧", spark: "✦", flame: "♨", route: "⌁", worlds: "◈", journal: "▤", refuge: "⌂", heart: "♥", lock: "◆", compass: "✥" };
  return <span aria-hidden="true">{icons[name] ?? "•"}</span>;
}

function loadInitialSave(): GameSave {
  if (typeof window === "undefined") return createDefaultSave();
  try {
    const current = window.localStorage.getItem(STORAGE_KEY_V2);
    if (current) return normalizeSave(JSON.parse(current));
    const legacy = window.localStorage.getItem(STORAGE_KEY_V1);
    if (legacy) return migrateLegacySave(JSON.parse(legacy));
  } catch {
    // A broken or unavailable local storage must never block the adventure.
  }
  return createDefaultSave();
}

function loadRefugeProgress(): RefugeProgress {
  try {
    const value = JSON.parse(window.localStorage.getItem(REFUGE_STORAGE_KEY) ?? "null") as Partial<RefugeProgress> | null;
    return {
      refugeLevel: clamp(Math.floor(Number(value?.refugeLevel) || 1), 1, 7),
      observatoryLevel: clamp(Math.floor(Number(value?.observatoryLevel) || 0), 0, 3),
    };
  } catch {
    return DEFAULT_REFUGE;
  }
}

export function GrandPasGameV2() {
  const [save, setSave] = useState<GameSave>(() => createDefaultSave(HYDRATION_DATE_KEY));
  const [refugeProgress, setRefugeProgress] = useState<RefugeProgress>(DEFAULT_REFUGE);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>("voyage");
  const [sensorMode, setSensorMode] = useState<SensorMode>("idle");
  const [isWalking, setIsWalking] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [atlasOpen, setAtlasOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [greeting, setGreeting] = useState("Bienvenue, voyageur");
  const [movementSequence, setMovementSequence] = useState(0);
  const [encountersPaused, setEncountersPaused] = useState(false);
  const motionState = useRef(createStepMotionState());
  const stepRuntime = useRef(createStepRuntimeState());
  const previousPendingCount = useRef(0);

  useEffect(() => {
    window.queueMicrotask(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? "Bonjour, voyageur" : hour < 18 ? "Belle marche, voyageur" : "Bonsoir, voyageur");
    setSave(loadInitialSave());
    setRefugeProgress(loadRefugeProgress());
    setHasLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!hasLoaded) return;
    try { window.localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(save)); } catch { /* Private browsing can disable local storage. */ }
  }, [hasLoaded, save]);

  useEffect(() => {
    if (!hasLoaded) return;
    try { window.localStorage.setItem(REFUGE_STORAGE_KEY, JSON.stringify(refugeProgress)); } catch { /* Private browsing can disable local storage. */ }
  }, [hasLoaded, refugeProgress]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 3000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const activeUniverse = UNIVERSE_BY_ID[save.activeUniverseId];
  const worldProgress = save.worldProgress[activeUniverse.id];
  const routeProgress = clamp(worldProgress.steps / activeUniverse.routeGoal, 0, 1);
  const dailyProgress = clamp(save.stepsToday / DAILY_GOAL, 0, 1);
  const modalEncounter = encounterById(save.pendingEncounters[0]);
  const visibleEncounter = encountersPaused ? undefined : modalEncounter;
  const nextEvent = activeUniverse.encounters.find((event) => !save.resolvedEncounters.includes(event.id) && !save.pendingEncounters.includes(event.id) && event.at > worldProgress.steps);
  const remaining = Math.max(0, (nextEvent?.at ?? activeUniverse.routeGoal) - worldProgress.steps);
  const distanceKm = (save.totalSteps * 0.00072).toFixed(1).replace(".", ",");
  const level = Math.max(1, Math.floor(save.totalSteps / 2500) + 1);
  const nextLockedUniverse = UNIVERSES.find((universe) => !isUniverseUnlocked(save, universe.id));

  useEffect(() => {
    if (save.pendingEncounters.length > previousPendingCount.current) window.queueMicrotask(() => setEncountersPaused(false));
    previousPendingCount.current = save.pendingEncounters.length;
  }, [save.pendingEncounters.length]);

  const acceptSteps = useCallback((amount: number, source: StepSource) => {
    const result = acceptStepDelta(stepRuntime.current, { source, delta: amount, observedAt: Date.now() });
    if (result.acceptedDelta === 0) return;
    stepRuntime.current = result.state;
    setMovementSequence(result.state.movementSequence);
    setSave((current) => addStepsToSave(current, result.acceptedDelta));
  }, []);

  useEffect(() => {
    if (!isWalking || sensorMode !== "demo") return;
    const interval = window.setInterval(() => acceptSteps(3, "demo"), 560);
    return () => window.clearInterval(interval);
  }, [acceptSteps, isWalking, sensorMode]);

  useEffect(() => {
    if (!isWalking || sensorMode !== "motion") return;
    motionState.current = resetStepMotionState();
    const onMotion = (event: DeviceMotionEvent) => {
      const a = event.accelerationIncludingGravity;
      if (!a) return;
      const result = detectStep(motionState.current, { x: a.x, y: a.y, z: a.z, observedAt: Date.now() });
      motionState.current = result.state;
      if (result.accepted) acceptSteps(1, "motion");
    };
    window.addEventListener("devicemotion", onMotion);
    return () => {
      window.removeEventListener("devicemotion", onMotion);
      motionState.current = resetStepMotionState();
    };
  }, [acceptSteps, isWalking, sensorMode]);

  async function startWalking() {
    if (isWalking) {
      setIsWalking(false);
      motionState.current = resetStepMotionState();
      setToast("Promenade mise en pause · le monde reste exactement à votre dernier pas.");
      return;
    }
    const motionEvent = typeof window !== "undefined" ? window.DeviceMotionEvent : undefined;
    if (motionEvent) {
      const permissionTarget = motionEvent as typeof DeviceMotionEvent & { requestPermission?: () => Promise<PermissionState> };
      if (typeof permissionTarget.requestPermission === "function") {
        try {
          if ((await permissionTarget.requestPermission()) === "granted") { setSensorMode("motion"); setIsWalking(true); setToast("Capteur activé · le décor attend votre prochain pas."); return; }
        } catch { /* Permission denied: discovery mode remains available. */ }
      } else { setSensorMode("motion"); setIsWalking(true); setToast("Détection active · le décor attend votre prochain pas."); return; }
    }
    setSensorMode("idle");
    setIsWalking(false);
    setToast("Capteur indisponible · utilisez le mode découverte séparé pour tester le voyage.");
  }

  function useDemo() {
    motionState.current = resetStepMotionState();
    setSensorMode("demo"); setIsWalking(true); setToast("Mode découverte activé · seuls les pas simulés font avancer le monde.");
  }
  function chooseUniverse(universeId: UniverseId) {
    if (!isUniverseUnlocked(save, universeId)) { setToast(`Ce monde s’ouvre à ${formatSteps(UNIVERSE_BY_ID[universeId].unlockAt)} pas cumulés.`); return; }
    setSave((current) => selectUniverse(current, universeId)); setTab("voyage"); setAtlasOpen(false); setToast(`${UNIVERSE_BY_ID[universeId].name} · expédition sélectionnée.`);
  }
  function chooseEncounter(choice: string) {
    if (!visibleEncounter) return;
    setSave((current) => resolveEncounter(current, visibleEncounter.id, choice));
    setEncountersPaused(false);
    setToast(`${choice} · +${visibleEncounter.rewardLeaves} feuilles · +${visibleEncounter.rewardSparks} éclat${visibleEncounter.rewardSparks > 1 ? "s" : ""}`);
  }
  function postponeEncounter() {
    setEncountersPaused(true);
    setToast("Rencontre gardée dans le journal.");
  }
  function claimQuest() { const before = worldProgress.claimedQuest; setSave((current) => claimUniverseQuest(current)); if (!before) setToast(`Quête accomplie · ressources de ${activeUniverse.name} reçues.`); }
  function improveRefuge(kind: "refuge" | "observatory") {
    const isRefuge = kind === "refuge";
    const currentLevel = isRefuge ? refugeProgress.refugeLevel : refugeProgress.observatoryLevel;
    const maximum = isRefuge ? 7 : 3;
    const cost = isRefuge ? 40 * currentLevel : 12 * (currentLevel + 1);
    const available = isRefuge ? save.leaves : save.sparks;
    if (currentLevel >= maximum || available < cost) return;
    setSave((current) => ({ ...current, leaves: current.leaves - (isRefuge ? cost : 0), sparks: current.sparks - (isRefuge ? 0 : cost) }));
    setRefugeProgress((current) => isRefuge
      ? { ...current, refugeLevel: current.refugeLevel + 1 }
      : { ...current, observatoryLevel: current.observatoryLevel + 1 });
    setToast(isRefuge ? "Le Nid des Brèches gagne un niveau." : "L’Observatoire révèle un nouvel horizon.");
  }
  function resetAdventure() {
    if (!window.confirm("Réinitialiser toute l’aventure, les ressources et les améliorations du refuge ? Cette action est définitive.")) return;
    setIsWalking(false);
    setSensorMode("idle");
    motionState.current = resetStepMotionState();
    stepRuntime.current = createStepRuntimeState();
    setMovementSequence(0);
    setSave(createDefaultSave(localDateKey()));
    setRefugeProgress(DEFAULT_REFUGE);
    setEncountersPaused(false);
    setMenuOpen(false);
    setToast("Aventure locale réinitialisée.");
  }

  const theme = {
    "--world-accent": activeUniverse.accent,
    "--world-accent-soft": activeUniverse.accentSoft,
    "--world-ink": activeUniverse.ink,
    "--world-overlay": activeUniverse.overlay,
    "--route-position": `${12 + routeProgress * 58}%`,
    "--daily": `${dailyProgress * 360}deg`,
  } as React.CSSProperties;

  return (
    <main className={`app-shell universe-${activeUniverse.id}`} style={theme}>
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <header className="topbar">
        <button className="profile-button" aria-label="Ouvrir le profil" onClick={() => setMenuOpen(true)}><span className="profile-ring"><Image src="/assets/elyra-avatar.png" alt="" width={1254} height={1254} sizes="44px" /></span><span><small>{greeting}</small><strong>Niveau {level}</strong></span></button>
        <div className="resources" role="group" aria-label="Ressources disponibles"><span className="resource leaf"><Icon name="leaf" /> {save.leaves}<span className="resource-name">feuilles</span></span><span className="resource spark"><Icon name="spark" /> {save.sparks}<span className="resource-name">éclats</span></span><button className="round-button" aria-label="Ouvrir les réglages" onClick={() => setMenuOpen(true)}>☰</button></div>
      </header>

      {tab === "voyage" && <VoyageScreen save={save} activeUniverse={activeUniverse} worldProgress={worldProgress} routeProgress={routeProgress} dailyProgress={dailyProgress} movementSequence={movementSequence} isWalking={isWalking} sensorMode={sensorMode} nextEvent={nextEvent} remaining={remaining} nextLockedUniverse={nextLockedUniverse} setAtlasOpen={setAtlasOpen} setTab={setTab} startWalking={startWalking} useDemo={useDemo} />}
      {tab === "mondes" && <WorldsScreen save={save} chooseUniverse={chooseUniverse} />}
      {tab === "journal" && <JournalScreen save={save} activeUniverse={activeUniverse} worldProgress={worldProgress} distanceKm={distanceKm} claimQuest={claimQuest} />}
      {tab === "refuge" && <RefugeScreen save={save} progress={refugeProgress} improve={improveRefuge} />}

      <nav className="bottom-nav" aria-label="Navigation principale">
        {([ ["voyage", "route", "Voyage"], ["mondes", "worlds", "Mondes"], ["journal", "journal", "Journal"], ["refuge", "refuge", "Refuge"] ] as [Tab, string, string][]).map(([id, icon, label]) => <button key={id} className={tab === id ? "active" : ""} aria-current={tab === id ? "page" : undefined} aria-pressed={tab === id} onClick={() => setTab(id)}><Icon name={icon} /><span>{label}</span></button>)}
      </nav>

      {atlasOpen && <AtlasModal save={save} close={() => setAtlasOpen(false)} chooseUniverse={chooseUniverse} />}
      {menuOpen && <SettingsModal save={save} sensorMode={sensorMode} activeUniverseName={activeUniverse.name} close={() => setMenuOpen(false)} resetAdventure={resetAdventure} />}
      {visibleEncounter && <EncounterModal encounterId={visibleEncounter.id} pendingCount={save.pendingEncounters.length} chooseEncounter={chooseEncounter} postponeEncounter={postponeEncounter} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}

type VoyageProps = {
  save: GameSave; activeUniverse: (typeof UNIVERSES)[number]; worldProgress: GameSave["worldProgress"][UniverseId]; routeProgress: number; dailyProgress: number; movementSequence: number; isWalking: boolean; sensorMode: SensorMode; nextEvent: (typeof UNIVERSES)[number]["encounters"][number] | undefined; remaining: number; nextLockedUniverse: (typeof UNIVERSES)[number] | undefined; setAtlasOpen: (value: boolean) => void; setTab: (tab: Tab) => void; startWalking: () => void; useDemo: () => void;
};

const RouteLayer = memo(function RouteLayer({ plane, segments, atlas, cameraSegments, renderWindowStart, foregroundOnly = false }: {
  plane: VisualPlane;
  segments: readonly VisualSegment[];
  atlas: string;
  cameraSegments: number;
  renderWindowStart: number;
  foregroundOnly?: boolean;
}) {
  const layerClassName = foregroundOnly ? "world-layer world-layer-near-front" : `world-layer world-layer-${plane}`;
  return <div className={layerClassName} aria-hidden="true"><div className="world-layer-track" data-render-window-start={renderWindowStart} key={`${plane}-${foregroundOnly ? "front" : "back"}-${renderWindowStart}`}>
    {segments.map((segment) => {
      const layer = segment.layers[plane];
      const segmentStyle = {
        "--atlas-x": `${layer.atlasXPercent}%`,
        "--atlas-y": `${layer.atlasYPercent}%`,
        "--layer-variant": layer.variant,
        "--cell-parallax-x": `${getLocalParallaxPx(plane, cameraSegments, segment.index)}px`,
      } as React.CSSProperties;
      return <div className={`world-segment variant-${layer.variant} landform-${segment.landform}`} data-landmark={segment.landmark || undefined} data-segment-id={segment.id} key={`${plane}-${segment.id}`} style={segmentStyle}>
        <div className={`segment-surface ${foregroundOnly ? "near-front-surface" : ""}`} style={{ backgroundImage: `url(${atlas})` }} />
      </div>;
    })}
  </div></div>;
});

function WorldViewport({ activeUniverse, steps, stepsToday, movementSequence, isTracking }: { activeUniverse: (typeof UNIVERSES)[number]; steps: number; stepsToday: number; movementSequence: number; isTracking: boolean }) {
  const layerAtlas = getWorldLayerAtlasPath(activeUniverse.id);
  const scene = getRouteSceneState(activeUniverse.id, steps, activeUniverse.routeGoal);
  const renderSegments = getRouteRenderSegments(activeUniverse.id, scene);
  const frame = Math.abs(Math.floor(steps)) % 4;
  const viewportStyle = {
    "--track-shift": `${scene.renderTrackPercent}%`,
    "--walker-frame": `${frame * (100 / 3)}%`,
  } as React.CSSProperties;
  return <div className={`pixel-world ambient-${activeUniverse.ambient} ${isTracking ? "is-tracking" : ""}`} data-route-segment={scene.segmentIndex + 1} data-route-segments={WORLD_ROUTE_SEGMENT_COUNT} data-step-sequence={movementSequence} style={viewportStyle}>
    {VISUAL_PLANES.map((plane) => <RouteLayer atlas={layerAtlas} cameraSegments={scene.cameraSegments} key={plane} plane={plane} renderWindowStart={scene.renderWindowStart} segments={renderSegments} />)}
    <RouteLayer atlas={layerAtlas} cameraSegments={scene.cameraSegments} foregroundOnly key="near-front" plane="near" renderWindowStart={scene.renderWindowStart} segments={renderSegments} />
    <div className="world-grade" />
    <div className="world-particles" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <i key={index} />)}</div>
    <div className={`speed-lines ${movementSequence > 0 ? "step-impulse" : ""}`} key={`speed-${movementSequence}`} />
    <span className={`walker-sprite ${movementSequence > 0 ? "step-impulse" : ""}`} key={`walker-${movementSequence}`} role="img" aria-label={`Votre exploratrice dans ${activeUniverse.name}`} />
    <div className={`step-shadow ${movementSequence > 0 ? "step-impulse" : ""}`} key={`shadow-${movementSequence}`} />
    <div className="segment-indicator" aria-hidden="true">Décor {scene.segmentIndex + 1}<span>/ {WORLD_ROUTE_SEGMENT_COUNT}</span></div>
    <div className="step-bubble"><Icon name="foot" /><strong>{formatSteps(stepsToday)}</strong><small>pas aujourd’hui</small></div>
    <div className="world-badge"><small>{activeUniverse.genre} · route vivante</small><strong>{activeUniverse.name}</strong></div>
  </div>;
}

function VoyageScreen({ save, activeUniverse, worldProgress, routeProgress, dailyProgress, movementSequence, isWalking, sensorMode, nextEvent, remaining, nextLockedUniverse, setAtlasOpen, setTab, startWalking, useDemo }: VoyageProps) {
  return <div className="screen voyage-screen">
    <section className="hero-copy" aria-labelledby="hero-title"><div className="world-heading-row"><p className="eyebrow"><span /> Chapitre {activeUniverse.chapter}</p><button className="world-switch" onClick={() => setAtlasOpen(true)}><Icon name="compass" /> Changer</button></div><h1 id="hero-title">Sept mondes.<br /><em>Un seul voyage.</em></h1><p>{activeUniverse.description}</p></section>
    <section className="journey-card" aria-label={`Progression de ${activeUniverse.routeName}`}>
      <div className="route-label"><span className="mini-emblem"><Icon name="route" /></span><div><small>{activeUniverse.kicker}</small><strong>{activeUniverse.routeName}</strong></div><span className="weather" role="status" aria-label={`Météo : ${activeUniverse.weather}, ${activeUniverse.temperature}`}>{activeUniverse.weather}<b>{activeUniverse.temperature}</b></span></div>
      <WorldViewport activeUniverse={activeUniverse} isTracking={isWalking} movementSequence={movementSequence} steps={worldProgress.steps} stepsToday={save.stepsToday} />
      <div className="route-progress"><div className="progress-track" role="progressbar" aria-label={`Progression de ${activeUniverse.routeName}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(routeProgress * 100)}><span style={{ width: `${routeProgress * 100}%` }} /></div><div className="milestones">{activeUniverse.milestones.map((milestone, index) => { const at = Math.round((activeUniverse.routeGoal / 3) * index); return <span className={worldProgress.steps >= at ? "passed" : index === Math.floor(routeProgress * 3) ? "current" : ""} key={milestone}><b>{milestone}</b><small>{formatSteps(at)}</small></span>; })}</div></div>
    </section>
    <section className="daily-row" aria-label="Objectif quotidien"><div className="daily-ring"><span><Icon name="flame" /></span></div><div className="daily-copy"><small>OBJECTIF DU JOUR</small><strong>{formatSteps(save.stepsToday)} <span>/ {formatSteps(DAILY_GOAL)} pas</span></strong><div className="thin-progress" role="progressbar" aria-label="Objectif quotidien" aria-valuemin={0} aria-valuemax={DAILY_GOAL} aria-valuenow={Math.min(save.stepsToday, DAILY_GOAL)}><span style={{ width: `${dailyProgress * 100}%` }} /></div></div><div className="streak"><strong>{unlockedCount(save)}</strong><small>mondes ouverts</small></div></section>
    <section className="encounter-teaser"><div className="teaser-icon">{nextEvent?.icon ?? "✦"}</div><div><small>PROCHAINE DÉCOUVERTE</small><strong>{nextEvent?.title.replace("…", "") ?? activeUniverse.landmark}</strong><span>{remaining > 0 ? `Encore ${formatSteps(remaining)} pas` : "Le jalon vous attend"}</span></div><button aria-label="Voir le journal" onClick={() => setTab("journal")}>›</button></section>
    {nextLockedUniverse && <p className="unlock-hint"><Icon name="lock" /> Prochaine brèche : {nextLockedUniverse.name} à {formatSteps(nextLockedUniverse.unlockAt)} pas cumulés.</p>}
    <div className="walk-actions"><button className={`walk-button ${isWalking ? "active" : ""}`} aria-pressed={isWalking} onClick={startWalking}><span className="walk-icon"><Icon name={isWalking ? "heart" : "foot"} /></span><span><strong>{isWalking ? "Mettre en pause" : "Commencer à marcher"}</strong><small>{sensorMode === "demo" ? "Mode découverte · pas simulés" : isWalking ? "Capteur armé · le monde attend vos pas" : "Téléphone en poche · regardez où vous allez"}</small></span>{isWalking ? <span className="live-pill">{sensorMode === "demo" ? "D\u00C9COUVERTE" : "CAPTEUR ACTIF"}</span> : null}</button>{!isWalking ? <button className="demo-link" onClick={useDemo}>Explorer en mode découverte</button> : null}</div>
  </div>;
}

function WorldsScreen({ save, chooseUniverse }: { save: GameSave; chooseUniverse: (id: UniverseId) => void }) {
  return <div className="screen secondary-screen worlds-screen"><div className="section-heading"><p className="eyebrow"><span /> L’Atlas des Brèches</p><h1>Choisissez votre<br /><em>prochain univers.</em></h1><p>Chaque monde possède sa campagne, ses rencontres et sa progression.</p></div><div className="universe-grid">{UNIVERSES.map((universe) => { const unlocked = isUniverseUnlocked(save, universe.id); const progress = save.worldProgress[universe.id]; const selected = save.activeUniverseId === universe.id; const percentage = Math.round(clamp(progress.steps / universe.routeGoal, 0, 1) * 100); return <article className={`universe-card ${unlocked ? "unlocked" : "locked"} ${selected ? "selected" : ""}`} key={universe.id}><button className="universe-card-action" onClick={() => chooseUniverse(universe.id)} aria-label={unlocked ? `Explorer ${universe.name}, progression ${percentage} %` : `${universe.name} verrouillé`} aria-pressed={selected}><span className="universe-card-art" style={{ backgroundImage: `url(${universe.image})` }}><i>{unlocked ? universe.genre : <><Icon name="lock" /> {formatSteps(universe.unlockAt)}</>}</i></span><span className="universe-card-copy"><small>MONDE {String(universe.order).padStart(2, "0")} · {universe.kicker}</small><strong>{universe.name}</strong><span>{universe.description}</span><b>{formatSteps(progress.steps)} / {formatSteps(universe.routeGoal)} pas</b><em aria-hidden="true"><span style={{ width: `${percentage}%` }} /></em></span></button></article>; })}</div></div>;
}

function JournalScreen({ save, activeUniverse, worldProgress, distanceKm, claimQuest }: { save: GameSave; activeUniverse: (typeof UNIVERSES)[number]; worldProgress: GameSave["worldProgress"][UniverseId]; distanceKm: string; claimQuest: () => void }) {
  return <div className="screen secondary-screen"><div className="section-heading"><p className="eyebrow"><span /> Chroniques du Grand Pas</p><h1>Vos pas écrivent<br /><em>sept histoires.</em></h1><p>Quêtes, rencontres et décisions restent liées à leur monde d’origine.</p></div><div className="stat-trio"><div><strong>{formatSteps(save.totalSteps)}</strong><small>pas parcourus</small></div><div><strong>{distanceKm} km</strong><small>à travers les mondes</small></div><div><strong>{save.resolvedEncounters.length}</strong><small>rencontres vécues</small></div></div><article className="quest-card"><span className="quest-mark">{activeUniverse.encounters[0].icon}</span><div><small>QUÊTE · {activeUniverse.name}</small><h2>{activeUniverse.questTitle}</h2><p>{activeUniverse.questText}</p><div className="thin-progress" role="progressbar" aria-label={`Progression de la quête ${activeUniverse.questTitle}`} aria-valuemin={0} aria-valuemax={activeUniverse.questGoal} aria-valuenow={Math.min(worldProgress.dailySteps, activeUniverse.questGoal)}><span style={{ width: `${clamp(worldProgress.dailySteps / activeUniverse.questGoal, 0, 1) * 100}%` }} /></div><span>{formatSteps(Math.min(worldProgress.dailySteps, activeUniverse.questGoal))} / {formatSteps(activeUniverse.questGoal)} pas aujourd’hui</span></div><button disabled={worldProgress.dailySteps < activeUniverse.questGoal || worldProgress.claimedQuest} onClick={claimQuest}>{worldProgress.claimedQuest ? "Reçu" : worldProgress.dailySteps >= activeUniverse.questGoal ? "Recevoir" : `+${10 + activeUniverse.order * 2} ❧`}</button></article><h2 className="subheading">Souvenirs récents</h2><div className="memory-list">{save.journal.length === 0 ? <article className="empty-memory"><span>◇</span><div><small>LE CARNET ATTEND</small><h3>La prochaine rencontre écrira cette page</h3><p>Marchez dans l’univers de votre choix pour croiser ses habitants.</p></div></article> : null}{save.journal.slice(0, 8).map((entry) => { const encounter = encounterById(entry.encounterId); if (!encounter) return null; const universe = UNIVERSE_BY_ID[entry.universeId]; return <article key={`${entry.encounterId}-${entry.resolvedAt}`}><span>{encounter.icon}</span><div><small>{universe.name}</small><h3>{encounter.title}</h3><p>« {entry.choice} »</p></div></article>; })}</div></div>;
}

function RefugeScreen({ save, progress, improve }: { save: GameSave; progress: RefugeProgress; improve: (kind: "refuge" | "observatory") => void }) {
  const openCount = unlockedCount(save);
  const refugeCost = 40 * progress.refugeLevel;
  const observatoryCost = 12 * (progress.observatoryLevel + 1);
  const refugeComplete = progress.refugeLevel >= 7;
  const observatoryComplete = progress.observatoryLevel >= 3;
  return <div className="screen secondary-screen"><div className="section-heading"><p className="eyebrow"><span /> Carrefour des mondes</p><h1>Un refuge entre<br /><em>tous les horizons.</em></h1><p>Les souvenirs de chaque univers transforment désormais votre havre.</p></div><section className={`refuge-scene refuge-level-${progress.refugeLevel}`} aria-label={`Refuge interdimensionnel, niveau ${progress.refugeLevel}`}><div className="portal-ring" /><div className="cabin"><i /><b>Le Nid des Brèches</b></div><div className="world-orbs" aria-hidden="true">{UNIVERSES.slice(0, openCount).map((universe) => <i key={universe.id} style={{ background: universe.accent }} />)}</div><Image src="/assets/elyra-avatar.png" alt="Votre exploratrice devant le refuge" width={1254} height={1254} sizes="95px" /></section><div className="collection-panel"><small>COLLECTION D’HORIZONS</small><strong>{openCount} / {UNIVERSES.length} mondes reliés</strong><div role="list" aria-label="Mondes de la collection">{UNIVERSES.map((universe) => { const open = isUniverseUnlocked(save, universe.id); return <span role="listitem" aria-label={`${universe.name} : ${open ? "relié" : "à découvrir"}`} className={open ? "open" : ""} key={universe.id} title={universe.name} style={{ "--orb": universe.accent } as React.CSSProperties} />; })}</div></div><div className="upgrade-list"><article><span aria-hidden="true">⌂</span><div><small>NIVEAU {progress.refugeLevel} / 7</small><h2>Le Nid des Brèches</h2><p>Chaque amélioration agrandit le refuge et stabilise ses souvenirs.</p></div><button disabled={refugeComplete || save.leaves < refugeCost} aria-label={refugeComplete ? "Le Nid des Brèches est au niveau maximum" : `Améliorer le refuge pour ${refugeCost} feuilles`} onClick={() => improve("refuge")}>{refugeComplete ? "Complet" : `${refugeCost} ❧`}</button></article><article><span aria-hidden="true">◈</span><div><small>NIVEAU {progress.observatoryLevel} / 3</small><h2>Observatoire des horizons</h2><p>Chaque niveau dévoile davantage de routes et de chroniques.</p></div><button disabled={observatoryComplete || save.sparks < observatoryCost} aria-label={observatoryComplete ? "L’Observatoire est au niveau maximum" : `Améliorer l’observatoire pour ${observatoryCost} éclats`} onClick={() => improve("observatory")}>{observatoryComplete ? "Complet" : `${observatoryCost} ✦`}</button></article></div><p className="kind-note"><Icon name="heart" /> Élyra respecte vos journées de repos. Aucun monde ne disparaît si vous faites une pause.</p></div>;
}

function AtlasModal({ save, close, chooseUniverse }: { save: GameSave; close: () => void; chooseUniverse: (id: UniverseId) => void }) {
  return <div className="modal-backdrop atlas-backdrop"><button className="modal-dismiss" aria-label="Fermer l’atlas" onClick={close} /><section className="sheet atlas-sheet" role="dialog" aria-modal="true" aria-labelledby="atlas-title"><button className="close-button" aria-label="Fermer" onClick={close}>×</button><span className="sheet-emblem"><Icon name="worlds" /></span><h2 id="atlas-title">Changer d’univers</h2><p>Votre progression reste indépendante dans chaque monde.</p><div className="atlas-list">{UNIVERSES.map((universe) => <button key={universe.id} disabled={!isUniverseUnlocked(save, universe.id)} className={save.activeUniverseId === universe.id ? "active" : ""} aria-pressed={save.activeUniverseId === universe.id} onClick={() => chooseUniverse(universe.id)}><span style={{ backgroundImage: `url(${universe.image})` }} /><b>{universe.name}<small>{isUniverseUnlocked(save, universe.id) ? universe.genre : `${formatSteps(universe.unlockAt)} pas requis`}</small></b><i>{isUniverseUnlocked(save, universe.id) ? "›" : <Icon name="lock" />}</i></button>)}</div></section></div>;
}

function SettingsModal({ save, sensorMode, activeUniverseName, close, resetAdventure }: { save: GameSave; sensorMode: SensorMode; activeUniverseName: string; close: () => void; resetAdventure: () => void }) {
  return <div className="modal-backdrop"><button className="modal-dismiss" aria-label="Fermer les réglages" onClick={close} /><section className="sheet settings-sheet" role="dialog" aria-modal="true" aria-labelledby="settings-title"><button className="close-button" aria-label="Fermer" onClick={close}>×</button><span className="sheet-emblem">❧</span><h2 id="settings-title">Votre Grand Pas</h2><p>Sauvegarde V2 locale, migration automatique de la première aventure.</p><div className="setting-row"><span>Univers actif</span><strong>{activeUniverseName}</strong></div><div className="setting-row"><span>Source des pas</span><strong>{sensorMode === "motion" ? "Mouvement · direct" : sensorMode === "demo" ? "Découverte · simulé" : "Non connectée"}</strong></div><div className="setting-row"><span>Pas cumulés</span><strong>{formatSteps(save.totalSteps)}</strong></div><div className="setting-row"><span>Données santé</span><strong>Restent locales</strong></div><p className="technical-note">L’édition web anime les mondes lorsque la page reste ouverte. Le futur paquet mobile utilisera HealthKit et Health Connect pour réconcilier les pas écran éteint.</p><button className="danger-link" onClick={resetAdventure}>Réinitialiser l’aventure</button></section></div>;
}

function EncounterModal({ encounterId, pendingCount, chooseEncounter, postponeEncounter }: { encounterId: string; pendingCount: number; chooseEncounter: (choice: string) => void; postponeEncounter: () => void }) {
  const encounter = encounterById(encounterId);
  if (!encounter) return null;
  const universe = UNIVERSE_BY_ID[encounter.universeId];
  return <div className="modal-backdrop encounter-backdrop"><section className="sheet encounter-sheet" role="dialog" aria-modal="true" aria-labelledby="encounter-title"><span className="encounter-world" style={{ backgroundImage: `url(${universe.image})` }} /><span className="encounter-glow">{encounter.icon}</span><small>RENCONTRE · {universe.name}</small><h2 id="encounter-title">{encounter.title}</h2><p>{encounter.text}</p><div className="choice-list">{encounter.choices.map((choice) => <button key={choice} onClick={() => chooseEncounter(choice)}>{choice}<span>›</span></button>)}</div><button className="later-button" onClick={postponeEncounter}>Garder pour plus tard</button>{pendingCount > 1 && <small className="queue-count">+{pendingCount - 1} rencontre(s) en attente</small>}</section></div>;
}
