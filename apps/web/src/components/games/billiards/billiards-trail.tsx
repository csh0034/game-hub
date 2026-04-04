"use client";

import * as THREE from "three";
import { useBilliardsStore } from "./billiards-store";
import { useFrame } from "@react-three/fiber";
import { useRef, useMemo, useEffect, useCallback } from "react";

const BALL_RADIUS = 0.03075;
const TRAIL_BASE_Y = BALL_RADIUS + 0.001;
const MAX_TRAIL_POINTS = 300;
const FADE_DURATION = 1500; // ms to fade out after simulation ends
const TRAIL_WIDTH = 0.004; // 4mm trail width

const TRAIL_COLOR = "#ffffff";

// Render 3 parallel lines with slight offsets for thickness
const LINE_OFFSETS = [
  { dx: 0, dz: 0, dy: 0 },
  { dx: TRAIL_WIDTH, dz: 0, dy: 0.0002 },
  { dx: -TRAIL_WIDTH, dz: 0, dy: 0.0004 },
  { dx: 0, dz: TRAIL_WIDTH, dy: 0.0006 },
  { dx: 0, dz: -TRAIL_WIDTH, dy: 0.0008 },
];

function TrailLine({ id, fadeStartRef, offsetX, offsetZ, offsetY }: {
  id: string;
  fadeStartRef: React.RefObject<number>;
  offsetX: number;
  offsetZ: number;
  offsetY: number;
}) {
  const lineRef = useRef<THREE.Line>(null);
  const matRef = useRef<THREE.LineBasicMaterial>(null);
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(MAX_TRAIL_POINTS * 3), 3));
    return geo;
  }, []);
  const material = useMemo(() => {
    const mat = new THREE.LineBasicMaterial({
      color: TRAIL_COLOR,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      depthTest: false,
    });
    return mat;
  }, []);

  useEffect(() => { matRef.current = material; }, [material]);

  const lineObject = useMemo(() => new THREE.Line(geometry, material), [geometry, material]);

  useFrame(() => {
    if (!lineRef.current || !matRef.current) return;
    const store = useBilliardsStore.getState();
    const trails = store.ballTrails;
    const points = trails.get(id);

    if (!points || points.length < 2) {
      lineRef.current.visible = false;
      return;
    }

    // Fade out after simulation ends
    const fadeStartTime = fadeStartRef.current ?? 0;
    if (fadeStartTime > 0) {
      const elapsed = performance.now() - fadeStartTime;
      const fade = 1 - Math.min(elapsed / FADE_DURATION, 1);
      if (fade <= 0) {
        lineRef.current.visible = false;
        return;
      }
      matRef.current.opacity = fade * 0.7;
    } else {
      matRef.current.opacity = 0.7;
    }

    // Get the ball's current interpolated position to cap the trail
    const interp = store.ballInterp.get(id);
    let ballX: number | undefined;
    let ballZ: number | undefined;
    if (interp && store.frameTime > 0) {
      const elapsed = performance.now() - store.frameTime;
      const frameDuration = store.frameTime - store.prevFrameTime;
      const dt = frameDuration > 0 ? frameDuration : 50;
      const t = elapsed / dt;
      if (t <= 1.0) {
        ballX = interp.prevX + (interp.currX - interp.prevX) * t;
        ballZ = interp.prevZ + (interp.currZ - interp.prevZ) * t;
      } else {
        ballX = interp.currX + interp.vx * ((elapsed - dt) / 1000);
        ballZ = interp.currZ + interp.vz * ((elapsed - dt) / 1000);
      }
    }

    const posAttr = geometry.getAttribute("position") as THREE.BufferAttribute;
    const posArr = posAttr.array as Float32Array;
    let count = Math.min(points.length, MAX_TRAIL_POINTS);

    // Trim trail points that are ahead of the ball's interpolated position
    if (ballX !== undefined && ballZ !== undefined) {
      const bx = ballX;
      const bz = ballZ;
      // Walk backwards from the end, trim points past the ball
      while (count > 1) {
        const px = points[count - 1].x;
        const pz = points[count - 1].z;
        const _dx = px - bx;
        const _dz = pz - bz;
        // If this trail point is further from the previous point than the ball is, trim it
        const prevPx = points[count - 2].x;
        const prevPz = points[count - 2].z;
        const segDx = px - prevPx;
        const segDz = pz - prevPz;
        const segLen = Math.sqrt(segDx * segDx + segDz * segDz);
        if (segLen < 0.0001) { count--; continue; }
        // Project ball onto segment to check if trail overshoots
        const dot = ((bx - prevPx) * segDx + (bz - prevPz) * segDz) / (segLen * segLen);
        if (dot < 1.0) {
          // Ball hasn't reached this segment end yet — use ball position as last point
          count--;
          break;
        }
        break;
      }
    }

    for (let i = 0; i < count; i++) {
      posArr[i * 3] = points[i].x + offsetX;
      posArr[i * 3 + 1] = TRAIL_BASE_Y + offsetY;
      posArr[i * 3 + 2] = points[i].z + offsetZ;
    }
    // Append ball's current position as the final trail point
    if (ballX !== undefined && ballZ !== undefined && count < MAX_TRAIL_POINTS) {
      posArr[count * 3] = ballX + offsetX;
      posArr[count * 3 + 1] = TRAIL_BASE_Y + offsetY;
      posArr[count * 3 + 2] = ballZ + offsetZ;
      count++;
    }

    posAttr.needsUpdate = true;
    geometry.setDrawRange(0, count);
    lineRef.current.visible = true;
  });

  return <primitive object={lineObject} ref={lineRef} renderOrder={5} />;
}

export function BilliardsTrail({ cueBallId }: { cueBallId: string }) {
  const isSimulating = useBilliardsStore((s) => s.isSimulating);
  const hasTrail = useBilliardsStore((s) => s.ballTrails.has(cueBallId));
  const showTrail = useBilliardsStore((s) => s.showTrail);
  const fadeStartRef = useRef(0);

  // Track simulation → stopped transition for fade-out
  useEffect(() => {
    if (isSimulating) {
      fadeStartRef.current = 0;
    }
  }, [isSimulating]);

  const onSimEnd = useCallback(() => {
    if (fadeStartRef.current === 0) {
      fadeStartRef.current = performance.now();
    }
  }, []);

  useEffect(() => {
    if (!isSimulating && hasTrail) {
      onSimEnd();
    }
  }, [isSimulating, hasTrail, onSimEnd]);

  if (!showTrail || (!isSimulating && !hasTrail)) return null;

  return (
    <>
      {LINE_OFFSETS.map((off, i) => (
        <TrailLine
          key={i}
          id={cueBallId}
          fadeStartRef={fadeStartRef}
          offsetX={off.dx}
          offsetZ={off.dz}
          offsetY={off.dy}
        />
      ))}
    </>
  );
}
