"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

type Tab = "voyage" | "carte" | "journal" | "refuge";
type SensorMode = "idle" | "motion" | "demo";

type SaveData = {
  steps: number;
  totalSteps: number;
  leaves: number;
  sparks: number;
  encounters: string[];
  claimedQuest: boolean;
};

const DAILY_GOAL = 5000;
const ROUTE_GOAL = 2400;
const STORAGE_KEY = "elyra-grand-pas-v1";

const DEFAULT_SAVE: SaveData = {
  steps: 1847,
  totalSteps: 12846,
  leaves: 12,
  sparks: 3,
  encounters: [],
  claimedQuest: false,
};

const encounters = [
  {
    id: "lume",
    at: 2000,
    icon: "✦",
    title: "Une lueur vous suit…",
    text: "Un minuscule esprit-lanterne s’est posé près du sentier. Il semble attendre un nom.",
    choices: ["L’appeler Lume", "Lui offrir une feuille"],
  },
  {
    id: "milo",
    at: 2350,
    icon: "♬",
    title: "Le musicien du sous-bois",
    text: "Milo cherche trois notes perdues. Une promenade suffit peut-être à réveiller sa mélodie.",
    choices: ["Promettre de l’aider", "Écouter son histoire"],
  },
];

const regionCards = [
  { name: "Sentier des Lucioles", steps: "0 — 2 400", status: "En cours", tone: "sun" },
  { name: "Bois des Horloges", steps: "2 400 — 8 000", status: "À découvrir", tone: "forest" },
  { name: "Falaises Cuivrées", steps: "8 000 — 18 000", status: "Verrouillé", tone: "cliff" },
  { name: "Archipel Céleste", steps: "18 000 — 32 000", status: "Verrouillé", tone: "sky" },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatSteps(value: number) {
  return new Intl.NumberFormat("fr-FR").format(value);
}

function Icon({ name }: { name: string }) {
  const icons: Record<string, string> = {
    foot: "◒",
    leaf: "❧",
    spark: "✦",
    flame: "♨",
    route: "⌁",
    map: "◇",
    journal: "▤",
    refuge: "⌂",
    heart: "♥",
    lock: "◆",
  };
  return <span aria-hidden="true">{icons[name] ?? "•"}</span>;
}

export function GrandPasGame() {
  const [save, setSave] = useState<SaveData>(DEFAULT_SAVE);
  const [tab, setTab] = useState<Tab>("voyage");
  const [sensorMode, setSensorMode] = useState<SensorMode>("idle");
  const [isWalking, setIsWalking] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalEncounter, setModalEncounter] = useState<(typeof encounters)[number] | null>(null);
  const [toast, setToast] = useState("");
  const lastPeak = useRef(0);
  const wasAbove = useRef(false);
  const hasHydratedSave = useRef(false);
  const motionAvailable = typeof DeviceMotionEvent !== "undefined";

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        hasHydratedSave.current = true;
        if (stored) setSave({ ...DEFAULT_SAVE, ...JSON.parse(stored) });
      } catch {
        hasHydratedSave.current = true;
      }
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!hasHydratedSave.current) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
    } catch {
      // Private browsing can disable local storage.
    }
  }, [save]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const addSteps = (amount: number) => {
    setSave((current) => {
      const nextSteps = current.steps + amount;
      const crossed = encounters.find(
        (event) => current.steps < event.at && nextSteps >= event.at && !current.encounters.includes(event.id),
      );
      if (crossed) window.setTimeout(() => setModalEncounter(crossed), 350);
      return {
        ...current,
        steps: nextSteps,
        totalSteps: current.totalSteps + amount,
      };
    });
  };

  useEffect(() => {
    if (!isWalking || sensorMode !== "demo") return;
    const interval = window.setInterval(() => addSteps(2), 650);
    return () => window.clearInterval(interval);
  }, [isWalking, sensorMode]);

  useEffect(() => {
    if (!isWalking || sensorMode !== "motion") return;

    const onMotion = (event: DeviceMotionEvent) => {
      const a = event.accelerationIncludingGravity;
      if (!a || a.x == null || a.y == null || a.z == null) return;
      const magnitude = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
      const deviation = Math.abs(magnitude - 9.81);
      const now = Date.now();
      const above = deviation > 1.35;
      if (above && !wasAbove.current && now - lastPeak.current > 300) {
        lastPeak.current = now;
        addSteps(1);
      }
      wasAbove.current = above;
    };

    window.addEventListener("devicemotion", onMotion);
    return () => window.removeEventListener("devicemotion", onMotion);
  }, [isWalking, sensorMode]);

  const dailyProgress = clamp(save.steps / DAILY_GOAL, 0, 1);
  const routeProgress = clamp(save.steps / ROUTE_GOAL, 0, 1);
  const nextEvent = encounters.find((event) => !save.encounters.includes(event.id) && event.at > save.steps);
  const remaining = Math.max(0, (nextEvent?.at ?? ROUTE_GOAL) - save.steps);
  const distanceKm = (save.steps * 0.00072).toFixed(1).replace(".", ",");

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bonjour, explorateur";
    if (hour < 18) return "Belle marche, explorateur";
    return "Bonsoir, explorateur";
  }, []);

  async function startWalking() {
    if (isWalking) {
      setIsWalking(false);
      setToast("Promenade mise en pause. Vos pas sont sauvegardés.");
      return;
    }

    const permissionTarget = DeviceMotionEvent as typeof DeviceMotionEvent & {
      requestPermission?: () => Promise<PermissionState>;
    };

    if (motionAvailable && typeof permissionTarget.requestPermission === "function") {
      try {
        const result = await permissionTarget.requestPermission();
        if (result === "granted") {
          setSensorMode("motion");
          setIsWalking(true);
          setToast("Capteur activé — gardez l’écran ouvert pendant cette version web.");
          return;
        }
      } catch {
        // Fall through to the clearly labelled demo mode.
      }
    }

    if (motionAvailable && typeof permissionTarget.requestPermission !== "function") {
      setSensorMode("motion");
      setIsWalking(true);
      setToast("Détection de mouvement active au premier plan.");
      return;
    }

    setSensorMode("demo");
    setIsWalking(true);
    setToast("Mode découverte activé — pas simulés pour essayer l’aventure.");
  }

  function useDemo() {
    setSensorMode("demo");
    setIsWalking(true);
    setToast("Mode découverte activé — les pas ajoutés sont simulés.");
  }

  function resolveEncounter(choice: string) {
    if (!modalEncounter) return;
    setSave((current) => ({
      ...current,
      leaves: current.leaves + 4,
      sparks: current.sparks + 1,
      encounters: [...new Set([...current.encounters, modalEncounter.id])],
    }));
    setToast(`${choice} · +4 feuilles · +1 éclat`);
    setModalEncounter(null);
  }

  function claimQuest() {
    if (save.steps < 2000 || save.claimedQuest) return;
    setSave((current) => ({
      ...current,
      leaves: current.leaves + 8,
      claimedQuest: true,
    }));
    setToast("Quête accomplie · +8 feuilles d’ambre");
  }

  function resetDemo() {
    setIsWalking(false);
    setSensorMode("idle");
    setSave(DEFAULT_SAVE);
    setMenuOpen(false);
    setToast("Aventure locale réinitialisée.");
  }

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="topbar">
        <button className="profile-button" aria-label="Ouvrir le profil" onClick={() => setMenuOpen(true)}>
          <span className="profile-ring">
            <Image src="/assets/elyra-avatar.png" alt="" width={1254} height={1254} unoptimized />
          </span>
          <span>
            <small>{greeting}</small>
            <strong>Niveau 7</strong>
          </span>
        </button>

        <div className="resources" aria-label="Ressources">
          <span className="resource leaf"><Icon name="leaf" /> {save.leaves}</span>
          <span className="resource spark"><Icon name="spark" /> {save.sparks}</span>
          <button className="round-button" aria-label="Ouvrir les réglages" onClick={() => setMenuOpen(true)}>☰</button>
        </div>
      </header>

      {tab === "voyage" && (
        <div className="screen voyage-screen">
          <section className="hero-copy" aria-labelledby="hero-title">
            <p className="eyebrow"><span /> Chapitre I · La vallée qui s’éveille</p>
            <h1 id="hero-title">Le monde avance<br /><em>avec vous.</em></h1>
            <p>Chaque pas dans la vraie vie fait voyager votre avatar à travers Élyra.</p>
          </section>

          <section className="journey-card" aria-label="Progression du Sentier des Lucioles">
            <div className="route-label">
              <span className="mini-emblem"><Icon name="route" /></span>
              <div>
                <small>DESTINATION ACTUELLE</small>
                <strong>Sentier des Lucioles</strong>
              </div>
              <span className="weather" aria-label="Temps doux">☀ <b>18°</b></span>
            </div>

            <div
              className={`pixel-world ${isWalking ? "is-walking" : ""}`}
              style={{ "--route-position": `${14 + routeProgress * 52}%` } as React.CSSProperties}
            >
              <div className="sunset" />
              <div className="far-mountains" />
              <div className="near-mountains" />
              <div className="cloud cloud-a" />
              <div className="cloud cloud-b" />
              <div className="tree-line" />
              <div className="fireflies" aria-hidden="true">
                <i /><i /><i /><i /><i /><i /><i />
              </div>
              <div className="path" />
              <div className="signpost"><span>2000</span></div>
              <div className="forest-friend" aria-hidden="true">♩</div>
              <Image className="walker" src="/assets/elyra-avatar.png" alt="Votre explorateur marche sur le sentier" width={1254} height={1254} priority unoptimized />
              <div className="step-bubble"><Icon name="foot" /><strong>{formatSteps(save.steps)}</strong><small>pas aujourd’hui</small></div>
            </div>

            <div className="route-progress" aria-label={`${Math.round(routeProgress * 100)} % du sentier parcouru`}>
              <div className="progress-track"><span style={{ width: `${routeProgress * 100}%` }} /></div>
              <div className="milestones">
                <span className="passed"><b>Départ</b><small>0</small></span>
                <span className={save.steps >= 1200 ? "passed" : ""}><b>Clairière</b><small>1 200</small></span>
                <span className={save.steps >= 2000 ? "passed current" : "current"}><b>Rencontre</b><small>2 000</small></span>
                <span className={save.steps >= ROUTE_GOAL ? "passed" : ""}><b>Le Grand Chêne</b><small>2 400</small></span>
              </div>
            </div>
          </section>

          <section className="daily-row" aria-label="Objectif quotidien">
            <div className="daily-ring" style={{ "--daily": `${dailyProgress * 360}deg` } as React.CSSProperties}>
              <span><Icon name="flame" /></span>
            </div>
            <div className="daily-copy">
              <small>OBJECTIF DU JOUR</small>
              <strong>{formatSteps(save.steps)} <span>/ {formatSteps(DAILY_GOAL)} pas</span></strong>
              <div className="thin-progress"><span style={{ width: `${dailyProgress * 100}%` }} /></div>
            </div>
            <div className="streak"><strong>4</strong><small>jours doux</small></div>
          </section>

          <section className="encounter-teaser">
            <div className="teaser-icon">✦</div>
            <div>
              <small>PROCHAINE DÉCOUVERTE</small>
              <strong>{nextEvent ? nextEvent.title.replace("…", "") : "Le Grand Chêne vous attend"}</strong>
              <span>{remaining > 0 ? `Encore ${formatSteps(remaining)} pas` : "Vous y êtes !"}</span>
            </div>
            <button aria-label="Voir le journal" onClick={() => setTab("journal")}>›</button>
          </section>

          <div className="walk-actions">
            <button className={`walk-button ${isWalking ? "active" : ""}`} onClick={startWalking}>
              <span className="walk-icon"><Icon name={isWalking ? "heart" : "foot"} /></span>
              <span><strong>{isWalking ? "Mettre en pause" : "Commencer à marcher"}</strong><small>{sensorMode === "demo" ? "Mode découverte · pas simulés" : "Téléphone en poche · regardez où vous allez"}</small></span>
            </button>
            {!isWalking && <button className="demo-link" onClick={useDemo}>Essayer sans capteur</button>}
          </div>
        </div>
      )}

      {tab === "carte" && (
        <div className="screen secondary-screen">
          <div className="section-heading">
            <p className="eyebrow"><span /> Atlas d’Élyra</p>
            <h1>Choisissez votre<br /><em>prochain horizon.</em></h1>
            <p>Les sentiers se dévoilent naturellement au fil de vos promenades.</p>
          </div>
          <div className="region-grid">
            {regionCards.map((region, index) => (
              <article className={`region-card ${region.tone} ${index > 1 ? "locked" : ""}`} key={region.name}>
                <div className="region-art"><i /><i /><i /></div>
                <div>
                  <small>{region.status}</small>
                  <h2>{region.name}</h2>
                  <p>{region.steps} pas</p>
                </div>
                {index > 1 ? <Icon name="lock" /> : <button onClick={() => { setTab("voyage"); setToast(`${region.name} sélectionné.`); }} aria-label={`Explorer ${region.name}`}>›</button>}
              </article>
            ))}
          </div>
        </div>
      )}

      {tab === "journal" && (
        <div className="screen secondary-screen">
          <div className="section-heading">
            <p className="eyebrow"><span /> Carnet du voyageur</p>
            <h1>Vos pas deviennent<br /><em>des souvenirs.</em></h1>
            <p>Retrouvez les êtres croisés, vos quêtes et toute votre histoire.</p>
          </div>
          <div className="stat-trio">
            <div><strong>{formatSteps(save.totalSteps)}</strong><small>pas parcourus</small></div>
            <div><strong>{distanceKm} km</strong><small>dans Élyra</small></div>
            <div><strong>{save.encounters.length + 3}</strong><small>découvertes</small></div>
          </div>
          <article className="quest-card">
            <span className="quest-mark">❧</span>
            <div>
              <small>QUÊTE DU JOUR · BIENVEILLANCE</small>
              <h2>Réveiller les lanternes</h2>
              <p>Marchez 2 000 pas pour rallumer le chemin des voyageurs.</p>
              <div className="thin-progress"><span style={{ width: `${clamp(save.steps / 2000, 0, 1) * 100}%` }} /></div>
              <span>{formatSteps(Math.min(save.steps, 2000))} / 2 000 pas</span>
            </div>
            <button disabled={save.steps < 2000 || save.claimedQuest} onClick={claimQuest}>{save.claimedQuest ? "Reçu" : save.steps >= 2000 ? "Recevoir" : "+8 ❧"}</button>
          </article>
          <h2 className="subheading">Rencontres</h2>
          <div className="memory-list">
            <article><span>♩</span><div><small>AU VIEUX PONT</small><h3>Milo, musicien des mousses</h3><p>« Les meilleurs chemins ne sont jamais pressés. »</p></div></article>
            <article><span>✦</span><div><small>PRÈS DE LA CLAIRIÈRE</small><h3>Une étrange lueur</h3><p>{save.encounters.includes("lume") ? "Lume a rejoint votre voyage." : "Cette page attend encore d’être écrite."}</p></div></article>
          </div>
        </div>
      )}

      {tab === "refuge" && (
        <div className="screen secondary-screen">
          <div className="section-heading">
            <p className="eyebrow"><span /> Votre havre</p>
            <h1>Un refuge qui grandit<br /><em>à chaque promenade.</em></h1>
            <p>Ici, les amis rencontrés transforment vos pas en un lieu vivant.</p>
          </div>
          <section className="refuge-scene" aria-label="Refuge des voyageurs">
            <div className="refuge-sun" />
            <div className="cabin"><i /><b>Le Nid des Pas</b></div>
            <div className="garden">❀ ❧ ❀</div>
            <Image src="/assets/elyra-avatar.png" alt="Votre explorateur devant son refuge" width={1254} height={1254} unoptimized />
          </section>
          <div className="upgrade-list">
            <article><span>⌂</span><div><small>NIVEAU 2</small><h2>Le Nid des Pas</h2><p>Un lit douillet et trois places pour vos compagnons.</p></div><button disabled={save.leaves < 20}>20 ❧</button></article>
            <article><span>❀</span><div><small>À CONSTRUIRE</small><h2>Jardin des souvenirs</h2><p>Chaque région visitée y fait pousser une fleur unique.</p></div><button disabled={save.leaves < 30}>30 ❧</button></article>
          </div>
          <p className="kind-note"><Icon name="heart" /> Aucune série n’est perdue si vous vous reposez. Élyra vous attend, sans vous presser.</p>
        </div>
      )}

      <nav className="bottom-nav" aria-label="Navigation principale">
        {([
          ["voyage", "route", "Voyage"],
          ["carte", "map", "Carte"],
          ["journal", "journal", "Journal"],
          ["refuge", "refuge", "Refuge"],
        ] as [Tab, string, string][]).map(([id, icon, label]) => (
          <button key={id} className={tab === id ? "active" : ""} aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)}>
            <Icon name={icon} /><span>{label}</span>
          </button>
        ))}
      </nav>

      {menuOpen && (
        <div className="modal-backdrop">
          <button className="modal-dismiss" aria-label="Fermer les réglages" onClick={() => setMenuOpen(false)} />
          <section className="sheet settings-sheet" role="dialog" aria-modal="true" aria-labelledby="settings-title">
            <button className="close-button" aria-label="Fermer" onClick={() => setMenuOpen(false)}>×</button>
            <span className="sheet-emblem">❧</span>
            <h2 id="settings-title">Votre voyage</h2>
            <p>La version web conserve vos progrès uniquement sur cet appareil.</p>
            <div className="setting-row"><span>Source des pas</span><strong>{sensorMode === "motion" ? "Mouvement · direct" : sensorMode === "demo" ? "Découverte · simulé" : "Non connectée"}</strong></div>
            <div className="setting-row"><span>Objectif doux</span><strong>5 000 pas</strong></div>
            <div className="setting-row"><span>Données santé</span><strong>Restent locales</strong></div>
            <p className="technical-note">Pour compter les pas écran éteint, l’édition mobile finale utilisera HealthKit sur iPhone et Health Connect sur Android. Cette démo web estime seulement les mouvements quand elle reste ouverte.</p>
            <button className="danger-link" onClick={resetDemo}>Réinitialiser la démo</button>
          </section>
        </div>
      )}

      {modalEncounter && (
        <div className="modal-backdrop encounter-backdrop">
          <section className="sheet encounter-sheet" role="dialog" aria-modal="true" aria-labelledby="encounter-title">
            <span className="encounter-glow">{modalEncounter.icon}</span>
            <small>RENCONTRE SUR LE SENTIER</small>
            <h2 id="encounter-title">{modalEncounter.title}</h2>
            <p>{modalEncounter.text}</p>
            <div className="choice-list">
              {modalEncounter.choices.map((choice) => <button key={choice} onClick={() => resolveEncounter(choice)}>{choice}<span>›</span></button>)}
            </div>
            <button className="later-button" onClick={() => setModalEncounter(null)}>Garder pour plus tard</button>
          </section>
        </div>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
