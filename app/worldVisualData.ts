import type { UniverseId } from "./gameData";

export const WORLD_ROUTE_SEGMENT_COUNT = 20;
export const ROUTE_RENDER_WINDOW_SIZE = 3;
export const ATLAS_VARIANT_COUNT = 4;
export const VISUAL_PLANES = ["far", "mid", "terrain", "near"] as const;

export type VisualPlane = (typeof VISUAL_PLANES)[number];
export type AtlasVariant = 0 | 1 | 2 | 3;

export const ATLAS_PLANE_ROWS: Record<VisualPlane, AtlasVariant> = {
  far: 0,
  mid: 1,
  terrain: 2,
  near: 3,
};

export type VisualLayerManifest = {
  plane: VisualPlane;
  depth: number;
  variant: AtlasVariant;
  atlasColumn: AtlasVariant;
  atlasRow: AtlasVariant;
  atlasXPercent: number;
  atlasYPercent: number;
};

export type VisualSegment = {
  id: string;
  index: number;
  landform: string;
  landformIndex: AtlasVariant;
  landmark: boolean;
  layers: Record<VisualPlane, VisualLayerManifest>;
};

export type RouteSceneState = {
  routeProgress: number;
  cameraSegments: number;
  renderWindowStart: number;
  renderTrackPercent: number;
  segmentIndex: number;
  localProgress: number;
};

type VisualTheme = { landforms: readonly [string, string, string, string] };

const PLANE_DEPTHS: Record<VisualPlane, number> = { far: 0.12, mid: 0.34, terrain: 0.72, near: 1 };

export const ROUTE_LOCAL_PARALLAX_STRENGTH_PX: Readonly<Record<VisualPlane, number>> = Object.freeze({
  far: 10,
  mid: 6,
  terrain: 0,
  near: -8,
});

const THEMES: Record<UniverseId, VisualTheme> = {
  "vallee-elyra": { landforms: ["meadow", "grove", "stream", "glade"] },
  "royaumes-couronne": { landforms: ["rampart", "moor", "village", "highlands"] },
  "neo-arcadia": { landforms: ["skyline", "market", "rail", "rooftops"] },
  "noctis-hollow": { landforms: ["graveyard", "old-town", "marsh", "cathedral"] },
  "helios-9": { landforms: ["crater", "colony", "ridge", "observatory"] },
  "xibalba-verte": { landforms: ["canopy", "cenote", "temple", "river"] },
  aetheria: { landforms: ["cloud-sea", "islands", "starfall", "dawn-gate"] },
};

const segmentCache = new Map<UniverseId, readonly VisualSegment[]>();
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

function toVariant(value: number): AtlasVariant {
  return ((value % ATLAS_VARIANT_COUNT) + ATLAS_VARIANT_COUNT) % ATLAS_VARIANT_COUNT as AtlasVariant;
}

const MID_SCENE_VARIANTS = [0, 1, 2, 3, 0] as const;
const NEAR_SCENE_VARIANTS = [0, 2, 3, 1, 2] as const;

function narrativeVariants(index: number): Record<VisualPlane, AtlasVariant> {
  const act = Math.floor(index / 5) as AtlasVariant;
  const scene = index % 5;
  return {
    far: act,
    mid: toVariant(MID_SCENE_VARIANTS[scene] + act),
    terrain: act,
    near: toVariant(NEAR_SCENE_VARIANTS[scene] + act),
  };
}

function createSegments(universeId: UniverseId): readonly VisualSegment[] {
  const theme = THEMES[universeId];
  return Object.freeze(Array.from({ length: WORLD_ROUTE_SEGMENT_COUNT }, (_, index) => {
    const variants = narrativeVariants(index);
    const layers = Object.fromEntries(VISUAL_PLANES.map((plane) => {
      const variant = variants[plane];
      const atlasRow = ATLAS_PLANE_ROWS[plane];
      return [plane, Object.freeze({
        plane,
        depth: PLANE_DEPTHS[plane],
        variant,
        atlasColumn: variant,
        atlasRow,
        atlasXPercent: variant * (100 / (ATLAS_VARIANT_COUNT - 1)),
        atlasYPercent: atlasRow * (100 / (ATLAS_VARIANT_COUNT - 1)),
      })];
    })) as Record<VisualPlane, VisualLayerManifest>;
    const landformIndex = Math.min(3, Math.floor(index / 5)) as AtlasVariant;
    return Object.freeze({
      id: `${universeId}-segment-${String(index + 1).padStart(2, "0")}`,
      index,
      landform: theme.landforms[landformIndex],
      landformIndex,
      landmark: (index + 1) % 5 === 0,
      layers: Object.freeze(layers),
    });
  }));
}

export function getWorldLayerAtlasPath(universeId: UniverseId): string {
  return `/worlds/layers/${universeId}-layers.webp`;
}

export function getWorldRouteSegments(universeId: UniverseId): readonly VisualSegment[] {
  const cached = segmentCache.get(universeId);
  if (cached) return cached;
  const segments = createSegments(universeId);
  segmentCache.set(universeId, segments);
  return segments;
}

export function getRouteRenderSegments(
  universeId: UniverseId,
  scene: Pick<RouteSceneState, "renderWindowStart">,
): readonly VisualSegment[] {
  return getWorldRouteSegments(universeId).slice(
    scene.renderWindowStart,
    scene.renderWindowStart + ROUTE_RENDER_WINDOW_SIZE,
  );
}

export function getLocalParallaxPx(plane: VisualPlane, cameraSegments: number, segmentIndex: number): number {
  const safeCamera = Number.isFinite(cameraSegments) ? cameraSegments : 0;
  const safeSegment = Number.isFinite(segmentIndex) ? segmentIndex : 0;
  const localDistance = clamp(safeCamera - safeSegment, -1, 1);
  const parallax = localDistance * ROUTE_LOCAL_PARALLAX_STRENGTH_PX[plane];
  return Object.is(parallax, -0) ? 0 : parallax;
}

export function getRouteSceneState(universeId: UniverseId, steps: number, routeGoal: number): RouteSceneState {
  getWorldRouteSegments(universeId);
  const safeGoal = Number.isFinite(routeGoal) && routeGoal > 0 ? routeGoal : 1;
  const safeSteps = Number.isFinite(steps) ? clamp(steps, 0, safeGoal) : 0;
  const routeProgress = safeSteps / safeGoal;
  const cameraSegments = routeProgress * (WORLD_ROUTE_SEGMENT_COUNT - 1);
  const segmentIndex = Math.min(WORLD_ROUTE_SEGMENT_COUNT - 1, Math.floor(cameraSegments));
  const localProgress = segmentIndex === WORLD_ROUTE_SEGMENT_COUNT - 1 ? 1 : cameraSegments - segmentIndex;
  const renderWindowStart = clamp(
    segmentIndex - 1,
    0,
    WORLD_ROUTE_SEGMENT_COUNT - ROUTE_RENDER_WINDOW_SIZE,
  );
  return {
    routeProgress,
    cameraSegments,
    renderWindowStart,
    renderTrackPercent: cameraSegments === renderWindowStart
      ? 0
      : -((cameraSegments - renderWindowStart) / ROUTE_RENDER_WINDOW_SIZE) * 100,
    segmentIndex,
    localProgress,
  };
}
