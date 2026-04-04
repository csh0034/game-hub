import { create } from "zustand";
import type { BilliardsPublicState, BilliardsFrameData } from "@game-hub/shared-types";

const MAX_IMPACT_OFFSET = 0.03075; // ball radius

export interface CushionHit {
  side: "left" | "right" | "top" | "bottom";
  time: number;
  speed: number;
}

interface BallInterp {
  prevX: number;
  prevZ: number;
  currX: number;
  currZ: number;
  vx: number;
  vz: number;
  spinX: number;
  spinY: number;
  spinZ: number;
}

interface BilliardsStore {
  // Ball interpolation state (prev + current frame for lerp)
  ballInterp: Map<string, BallInterp>;
  frameTime: number; // timestamp when current frame arrived
  prevFrameTime: number; // timestamp when previous frame arrived
  // Aiming state (client-only)
  aimDirection: number; // degrees
  power: number; // 0~1
  isDragging: boolean;
  dragStartY: number;
  // Impact point (당점)
  impactOffsetX: number; // -MAX ~ +MAX (좌우)
  impactOffsetY: number; // -MAX ~ +MAX (상하)
  // HUD
  cushionCount: number;
  objectBallsHit: string[];
  lastShotResult: { scored: boolean; cushionCount: number; objectBallsHit: string[] } | null;
  showShotResult: boolean;
  // Trail: position history per ball during simulation
  ballTrails: Map<string, { x: number; z: number }[]>;
  isSimulating: boolean;
  // Cushion deformation hits
  cushionHits: CushionHit[];
  // Trail toggle
  showTrail: boolean;
  // Shot animation
  shotAnimStartTime: number; // 0 = not animating

  // Legacy accessor for components that read ballPositions
  ballPositions: Map<string, { x: number; z: number }>;

  setBallPositions: (balls: { id: string; x: number; z: number }[]) => void;
  setAimDirection: (deg: number) => void;
  setPower: (power: number) => void;
  setDragging: (dragging: boolean, startY?: number) => void;
  setImpactOffset: (dx: number, dy: number) => void;
  resetImpactOffset: () => void;
  applyFrame: (frame: BilliardsFrameData) => void;
  applyState: (state: BilliardsPublicState) => void;
  setShotResult: (result: { scored: boolean; cushionCount: number; objectBallsHit: string[] } | null) => void;
  setShowShotResult: (show: boolean) => void;
  setSimulating: (sim: boolean) => void;
  addCushionHit: (hit: CushionHit) => void;
  toggleTrail: () => void;
  startShotAnim: () => void;
  reset: () => void;
}

function clampOffset(v: number): number {
  return Math.max(-MAX_IMPACT_OFFSET, Math.min(MAX_IMPACT_OFFSET, v));
}

export const useBilliardsStore = create<BilliardsStore>((set) => ({
  ballInterp: new Map(),
  frameTime: 0,
  prevFrameTime: 0,
  ballPositions: new Map(),
  aimDirection: 0,
  power: 0,
  isDragging: false,
  dragStartY: 0,
  impactOffsetX: 0,
  impactOffsetY: 0,
  cushionCount: 0,
  objectBallsHit: [],
  lastShotResult: null,
  showShotResult: false,
  ballTrails: new Map(),
  isSimulating: false,
  showTrail: true,
  cushionHits: [],
  shotAnimStartTime: 0,

  setBallPositions: (balls) =>
    set(() => {
      const map = new Map<string, { x: number; z: number }>();
      const interp = new Map<string, BallInterp>();
      for (const b of balls) {
        map.set(b.id, { x: b.x, z: b.z });
        interp.set(b.id, { prevX: b.x, prevZ: b.z, currX: b.x, currZ: b.z, vx: 0, vz: 0, spinX: 0, spinY: 0, spinZ: 0 });
      }
      const now = performance.now();
      return { ballPositions: map, ballInterp: interp, frameTime: now, prevFrameTime: now };
    }),

  setAimDirection: (deg) => set({ aimDirection: ((deg % 360) + 360) % 360 }),
  setPower: (power) => set({ power: Math.max(0, Math.min(1, power)) }),
  setDragging: (dragging, startY) =>
    set({ isDragging: dragging, ...(startY !== undefined ? { dragStartY: startY } : {}) }),

  setImpactOffset: (dx, dy) =>
    set((s) => ({
      impactOffsetX: clampOffset(s.impactOffsetX + dx),
      impactOffsetY: clampOffset(s.impactOffsetY + dy),
    })),

  resetImpactOffset: () => set({ impactOffsetX: 0, impactOffsetY: 0 }),

  applyFrame: (frame) =>
    set((s) => {
      const now = performance.now();
      const interp = new Map<string, BallInterp>();
      const posMap = new Map<string, { x: number; z: number }>();
      const trails = new Map(s.ballTrails);

      for (const b of frame.balls) {
        const prev = s.ballInterp.get(b.id);
        interp.set(b.id, {
          prevX: prev?.currX ?? b.x,
          prevZ: prev?.currZ ?? b.z,
          currX: b.x,
          currZ: b.z,
          vx: b.vx,
          vz: b.vz,
          spinX: b.spinX,
          spinY: b.spinY,
          spinZ: b.spinZ,
        });
        posMap.set(b.id, { x: b.x, z: b.z });

        // Accumulate trail points during simulation
        const trail = trails.get(b.id) ?? [];
        const last = trail[trail.length - 1];
        if (!last || Math.abs(last.x - b.x) > 0.001 || Math.abs(last.z - b.z) > 0.001) {
          trail.push({ x: b.x, z: b.z });
        }
        trails.set(b.id, trail);
      }

      // Detect cushion hits from shot events
      const TABLE_W = 2.844;
      const TABLE_H = 1.422;
      const BALL_R = 0.03075;
      const boundX = TABLE_W / 2 - BALL_R;
      const boundZ = TABLE_H / 2 - BALL_R;
      const newHits: CushionHit[] = [];
      for (const evt of frame.shotEvents) {
        if (evt.type === "cushion") {
          const pos = posMap.get(evt.ballId);
          if (pos) {
            let side: CushionHit["side"] = "left";
            if (Math.abs(pos.x - boundX) < 0.01) side = "right";
            else if (Math.abs(pos.x + boundX) < 0.01) side = "left";
            else if (Math.abs(pos.z - boundZ) < 0.01) side = "bottom";
            else if (Math.abs(pos.z + boundZ) < 0.01) side = "top";
            newHits.push({ side, time: Date.now(), speed: 3 });
          }
        }
      }

      return {
        ballInterp: interp,
        ballPositions: posMap,
        frameTime: now,
        prevFrameTime: s.frameTime,
        cushionCount: frame.cushionCount,
        objectBallsHit: frame.objectBallsHit,
        ballTrails: trails,
        cushionHits: newHits.length > 0 ? [...s.cushionHits, ...newHits] : s.cushionHits,
      };
    }),

  applyState: (state) =>
    set(() => {
      const map = new Map<string, { x: number; z: number }>();
      const interp = new Map<string, BallInterp>();
      const now = performance.now();
      for (const b of state.balls) {
        map.set(b.id, { x: b.x, z: b.z });
        interp.set(b.id, { prevX: b.x, prevZ: b.z, currX: b.x, currZ: b.z, vx: 0, vz: 0, spinX: 0, spinY: 0, spinZ: 0 });
      }
      return {
        ballPositions: map,
        ballInterp: interp,
        frameTime: now,
        prevFrameTime: now,
        cushionCount: state.cushionCount,
        objectBallsHit: state.objectBallsHit,
        lastShotResult: state.lastShotResult,
      };
    }),

  setShotResult: (result) => set({ lastShotResult: result }),
  setShowShotResult: (show) => set({ showShotResult: show }),
  setSimulating: (sim) =>
    set((s) => sim
      ? { isSimulating: true, ballTrails: new Map(), cushionHits: [] }
      : { isSimulating: false, ballTrails: s.ballTrails }),
  addCushionHit: (hit) => set((s) => ({ cushionHits: [...s.cushionHits, hit] })),
  toggleTrail: () => set((s) => ({ showTrail: !s.showTrail })),
  startShotAnim: () => set({ shotAnimStartTime: performance.now() }),

  reset: () =>
    set({
      ballInterp: new Map(),
      frameTime: 0,
      prevFrameTime: 0,
      ballPositions: new Map(),
      aimDirection: 0,
      power: 0,
      isDragging: false,
      dragStartY: 0,
      impactOffsetX: 0,
      impactOffsetY: 0,
      cushionCount: 0,
      objectBallsHit: [],
      lastShotResult: null,
      showShotResult: false,
      ballTrails: new Map(),
      isSimulating: false,
      cushionHits: [],
      shotAnimStartTime: 0,
    }),
}));

export const MAX_OFFSET = MAX_IMPACT_OFFSET;
