"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useBilliardsStore } from "./billiards-store";

const TABLE_WIDTH = 2.844;
const TABLE_HEIGHT = 1.422;
const BALL_RADIUS = 0.03075;
const BOUND_W = TABLE_WIDTH / 2 - BALL_RADIUS;
const BOUND_H = TABLE_HEIGHT / 2 - BALL_RADIUS;
const LINE_Y = BALL_RADIUS;
const HIT_RADIUS = BALL_RADIUS * 2;
const AFTER_HIT_LENGTH = 0.15;

// Mini simulation constants (simplified physics for preview)
const SIM_DT = 0.002; // 2ms substep
const SIM_STEPS = 600; // total ~1.2s of preview
const K_SWERVE = 0.003;
const SLIDING_FRICTION = 0.2;
const GRAVITY = 9.81;
const CUSHION_E = 0.75;
const CUSHION_FRICTION = 0.14;
const STOP_THRESHOLD = 0.05;

// Max points for line geometry
const MAX_POINTS = 200;

interface BilliardsGuidelineProps {
  cueBallId: string;
  visible: boolean;
}

/** Mini physics simulation for guideline prediction with spin effects */
function simulateGuidePath(
  startX: number, startZ: number,
  dirRad: number, speed: number,
  spinX: number, spinY: number, spinZ: number,
  otherBalls: { x: number; z: number }[],
): { points: number[]; hitBall: boolean; hitX: number; hitZ: number } {
  let x = startX;
  let z = startZ;
  let vx = speed * Math.cos(dirRad);
  let vz = speed * Math.sin(dirRad);
  void spinX; // spinX reserved for future rolling-spin throw
  let sZ = spinZ;

  const points: number[] = [x, LINE_Y, z];
  let hitBall = false;
  let hitX = 0;
  let hitZ = 0;
  let ballHitProcessed = false;

  for (let i = 0; i < SIM_STEPS; i++) {
    const spd = Math.sqrt(vx * vx + vz * vz);
    if (spd < STOP_THRESHOLD) break;

    // Swerve (curve from side spin)
    if (Math.abs(sZ) > 0.01 && spd > STOP_THRESHOLD) {
      vx += K_SWERVE * sZ * (-vz / spd) * SIM_DT;
      vz += K_SWERVE * sZ * (vx / spd) * SIM_DT;
    }

    // Friction deceleration
    const decel = SLIDING_FRICTION * GRAVITY * SIM_DT;
    const newSpd = Math.max(0, spd - decel);
    if (spd > 0) {
      vx *= newSpd / spd;
      vz *= newSpd / spd;
    }

    // SpinZ decay
    if (Math.abs(sZ) > 0.01) {
      const spinDecel = (5 * 0.02 * GRAVITY) / (2 * BALL_RADIUS) * SIM_DT;
      if (Math.abs(sZ) <= spinDecel) sZ = 0;
      else sZ -= Math.sign(sZ) * spinDecel;
    }

    // Position update
    x += vx * SIM_DT;
    z += vz * SIM_DT;

    // Cushion collisions with throw effect
    if (x < -BOUND_W) {
      x = -BOUND_W;
      const throwVt = sZ * CUSHION_FRICTION * 0.3;
      vx = -vx * CUSHION_E;
      vz = vz * (1 - CUSHION_FRICTION) + throwVt;
      sZ *= 0.7;
    } else if (x > BOUND_W) {
      x = BOUND_W;
      const throwVt = -sZ * CUSHION_FRICTION * 0.3;
      vx = -vx * CUSHION_E;
      vz = vz * (1 - CUSHION_FRICTION) + throwVt;
      sZ *= 0.7;
    }
    if (z < -BOUND_H) {
      z = -BOUND_H;
      const throwVt = sZ * CUSHION_FRICTION * 0.3;
      vz = -vz * CUSHION_E;
      vx = vx * (1 - CUSHION_FRICTION) + throwVt;
      sZ *= 0.7;
    } else if (z > BOUND_H) {
      z = BOUND_H;
      const throwVt = -sZ * CUSHION_FRICTION * 0.3;
      vz = -vz * CUSHION_E;
      vx = vx * (1 - CUSHION_FRICTION) + throwVt;
      sZ *= 0.7;
    }

    // Ball collision check
    if (!ballHitProcessed) {
      for (const ball of otherBalls) {
        const dx = x - ball.x;
        const dz = z - ball.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist <= HIT_RADIUS) {
          hitBall = true;
          hitX = x;
          hitZ = z;
          ballHitProcessed = true;

          // Deflect: cue ball gets tangent component (equal mass elastic)
          const nx = dx / dist;
          const nz = dz / dist;
          const dot = vx * nx + vz * nz;
          vx -= dot * nx;
          vz -= dot * nz;

          // Add short extension after hit
          const postSpd = Math.sqrt(vx * vx + vz * vz);
          if (postSpd > 0.01) {
            const extLen = Math.min(AFTER_HIT_LENGTH, postSpd * 0.15);
            points.push(x, LINE_Y, z);
            points.push(x + (vx / postSpd) * extLen, LINE_Y, z + (vz / postSpd) * extLen);
          } else {
            points.push(x, LINE_Y, z);
          }
          break;
        }
      }
      if (ballHitProcessed) break;
    }

    // Sample points (every 10 steps to keep line smooth but not too dense)
    if (i % 10 === 0 && points.length < MAX_POINTS * 3) {
      points.push(x, LINE_Y, z);
    }
  }

  // Add final point
  if (!ballHitProcessed && points.length < MAX_POINTS * 3) {
    points.push(x, LINE_Y, z);
  }

  return { points, hitBall, hitX, hitZ };
}

export function BilliardsGuideline({ cueBallId, visible }: BilliardsGuidelineProps) {
  const lineRef = useRef<THREE.Line>(null);
  const hitMarkerRef = useRef<THREE.Mesh>(null);
  const geometryRef = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(MAX_POINTS * 3), 3));
    return geo;
  }, []);
  const materialRef = useMemo(
    () => new THREE.LineDashedMaterial({ color: "#ffffff", opacity: 0.5, transparent: true, dashSize: 0.02, gapSize: 0.01 }),
    [],
  );
  const lineObject = useMemo(() => {
    const line = new THREE.Line(geometryRef, materialRef);
    line.computeLineDistances();
    return line;
  }, [geometryRef, materialRef]);

  useFrame(() => {
    if (!lineRef.current || !visible) return;
    const store = useBilliardsStore.getState();
    const cueBallPos = store.ballPositions.get(cueBallId);
    if (!cueBallPos) return;

    const dirRad = (store.aimDirection * Math.PI) / 180;

    // Compute initial spin from impact offset (simplified version of server formula)
    const R = BALL_RADIUS;
    const R2 = R * R;
    const previewSpeed = 3.0; // moderate speed for preview trajectory
    const spinScale = 3.5;
    const spinX = (spinScale * previewSpeed * store.impactOffsetY) / (2 * R2);
    const spinZ = (spinScale * previewSpeed * store.impactOffsetX) / (2 * R2);

    // Apply squirt to direction
    const normalizedOffset = Math.max(-1, Math.min(1, store.impactOffsetX / R));
    const squirtRad = Math.max(-Math.PI / 180, Math.min(Math.PI / 180, normalizedOffset * 0.018));
    const adjustedDirRad = dirRad + squirtRad;

    // Collect other ball positions
    const otherBalls: { x: number; z: number }[] = [];
    for (const [id, pos] of store.ballPositions) {
      if (id !== cueBallId) otherBalls.push(pos);
    }

    const { points, hitBall, hitX, hitZ } = simulateGuidePath(
      cueBallPos.x, cueBallPos.z,
      adjustedDirRad, previewSpeed,
      spinX, 0, spinZ,
      otherBalls,
    );

    // Update line geometry
    const posAttr = geometryRef.getAttribute("position") as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    arr.fill(0);
    for (let i = 0; i < points.length && i < MAX_POINTS * 3; i++) {
      arr[i] = points[i];
    }
    posAttr.needsUpdate = true;
    geometryRef.setDrawRange(0, Math.floor(points.length / 3));
    lineObject.computeLineDistances();

    // Hit marker
    if (hitMarkerRef.current) {
      hitMarkerRef.current.visible = hitBall;
      if (hitBall) {
        hitMarkerRef.current.position.set(hitX, LINE_Y + 0.001, hitZ);
      }
    }
  });

  if (!visible) return null;

  return (
    <>
      <primitive object={lineObject} ref={lineRef} />
      <mesh ref={hitMarkerRef} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[BALL_RADIUS * 0.8, BALL_RADIUS * 1.2, 24]} />
        <meshBasicMaterial color="#ff4444" opacity={0.7} transparent side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}
