import type { UniverseId } from "./gameData";

export const WORLD_ROUTE_SEGMENT_COUNT = 20;
export const VISUAL_PLANES = ["far", "mid", "terrain", "near"] as const;

export type VisualPlane = (typeof VISUAL_PLANES)[number];
export type RouteProp = "tree" | "rocks" | "arch" | "tower" | "lamp" | "crystal" | "pillar" | "spores" | "antenna" | "ruin";

export type VisualJoin = { key: string; prop: RouteProp };
export type VisualLayerManifest = { plane: VisualPlane; depth: number; variant: number };

export type VisualSegment = {
  id: string;
  index: number;
  seed: number;
  cropX: number;
  mirrored: boolean;
  landform: string;
  entryJoin: VisualJoin;
  exitJoin: VisualJoin;
  secondaryProp: RouteProp;
  landmark: boolean;
  layers: Record<VisualPlane, VisualLayerManifest>;
};

export type RouteSceneState = {
  routeProgress: number;
  cameraSegments: number;
  trackPercent: number;
  segmentIndex: number;
  localProgress: number;
  parallaxPx: Record<VisualPlane, number>;
};

type VisualTheme = { props: readonly RouteProp[]; landforms: readonly string[] };

const PLANE_DEPTHS: Record<VisualPlane, number> = { far: 0.12, mid: 0.34, terrain: 0.72, near: 1 };

const THEMES: Record<UniverseId, VisualTheme> = {
  "vallee-elyra": { props: ["tree", "rocks", "lamp", "arch", "spores"], landforms: ["meadow", "grove", "stream", "glade"] },
  "royaumes-couronne": { props: ["tower", "arch", "rocks", "pillar", "tree"], landforms: ["rampart", "moor", "village", "highlands"] },
  "neo-arcadia": { props: ["antenna", "lamp", "tower", "arch", "pillar"], landforms: ["skyline", "market", "rail", "rooftops"] },
  "noctis-hollow": { props: ["tree", "arch", "lamp", "ruin", "pillar"], landforms: ["graveyard", "old-town", "marsh", "cathedral"] },
  "helios-9": { props: ["antenna", "crystal", "arch", "pillar", "rocks"], landforms: ["crater", "colony", "ridge", "observatory"] },
  "xibalba-verte": { props: ["tree", "ruin", "pillar", "spores", "rocks"], landforms: ["canopy", "cenote", "temple", "river"] },
  aetheria: { props: ["crystal", "arch", "pillar", "spores", "ruin"], landforms: ["cloud-sea", "islands", "starfall", "dawn-gate"] },
};

const segmentCache = new Map<UniverseId, readonly VisualSegment[]>();
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

function hashText(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createJoin(universeId: UniverseId, boundary: number, theme: VisualTheme): VisualJoin {
  const key = `${universeId}-join-${boundary}`;
  const seed = hashText(key);
  return { key, prop: theme.props[seed % theme.props.length] };
}

function createSegments(universeId: UniverseId): readonly VisualSegment[] {
  const theme = THEMES[universeId];
  return Object.freeze(Array.from({ length: WORLD_ROUTE_SEGMENT_COUNT }, (_, index) => {
    const seed = hashText(`${universeId}-segment-${index}-v3`);
    const layers = Object.fromEntries(VISUAL_PLANES.map((plane, planeIndex) => [plane, {
      plane,
      depth: PLANE_DEPTHS[plane],
      variant: (seed + planeIndex * 7) % 5,
    }])) as Record<VisualPlane, VisualLayerManifest>;
    return Object.freeze({
      id: `${universeId}-segment-${String(index + 1).padStart(2, "0")}`,
      index,
      seed,
      cropX: 12 + (seed % 77),
      mirrored: (seed & 1) === 1,
      landform: theme.landforms[(seed >>> 3) % theme.landforms.length],
      entryJoin: Object.freeze(createJoin(universeId, index, theme)),
      exitJoin: Object.freeze(createJoin(universeId, index + 1, theme)),
      secondaryProp: theme.props[(seed >>> 7) % theme.props.length],
      landmark: index === 4 || index === 9 || index === 14 || index === 19,
      layers: Object.freeze(layers),
    });
  }));
}

export function getWorldRouteSegments(universeId: UniverseId): readonly VisualSegment[] {
  const cached = segmentCache.get(universeId);
  if (cached) return cached;
  const segments = createSegments(universeId);
  segmentCache.set(universeId, segments);
  return segments;
}

export function getRouteSceneState(universeId: UniverseId, steps: number, routeGoal: number): RouteSceneState {
  getWorldRouteSegments(universeId);
  const safeGoal = Number.isFinite(routeGoal) && routeGoal > 0 ? routeGoal : 1;
  const safeSteps = Number.isFinite(steps) ? clamp(steps, 0, safeGoal) : 0;
  const routeProgress = safeSteps / safeGoal;
  const cameraSegments = routeProgress * (WORLD_ROUTE_SEGMENT_COUNT - 1);
  const segmentIndex = Math.min(WORLD_ROUTE_SEGMENT_COUNT - 1, Math.floor(cameraSegments));
  const localProgress = segmentIndex === WORLD_ROUTE_SEGMENT_COUNT - 1 ? 1 : cameraSegments - segmentIndex;
  return {
    routeProgress,
    cameraSegments,
    trackPercent: routeProgress === 0 ? 0 : -(cameraSegments / WORLD_ROUTE_SEGMENT_COUNT) * 100,
    segmentIndex,
    localProgress,
    parallaxPx: {
      far: -routeProgress * 2,
      mid: -routeProgress * 4,
      terrain: -routeProgress * 7,
      near: -routeProgress * 10,
    },
  };
}
