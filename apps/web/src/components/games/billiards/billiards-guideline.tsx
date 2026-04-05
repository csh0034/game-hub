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

// ─── Mini simulation constants (matching server billiards-physics.ts) ───
const SIM_DT = 0.002;
const SIM_STEPS = 600;
const GRAVITY = 9.81;
const STOP_THRESHOLD = 0.05;

// Friction (server match)
const SLIDING_FRICTION = 0.2;
const ROLLING_FRICTION = 0.01;
const ROLLING_HERTZ_COEFF = 0.003;
const SLIP_THRESHOLD = 0.01;

// Swerve — separate sliding/rolling (server match)
const K_SWERVE_SLIDING = 0.0040;
const K_SWERVE_ROLLING = 0.0015;
const SWERVE_SPIN_CAP = 250;

// Spin (server match)
const INITIAL_SPIN_SCALE = 2.5;
const CUE_ELEVATION_RAD = (5 * Math.PI) / 180;
const SPIN_Z_FRICTION = 0.011;
const SQUIRT_COEFFICIENT = 0.035;
const MAX_SQUIRT_RAD = (2 * Math.PI) / 180;

// Cushion — sigmoid restitution (server match)
const CUSHION_E_LOW = 0.86;
const CUSHION_E_HIGH = 0.52;
const CUSHION_V_MID = 2.0;
const CUSHION_K = 2.2;
const CUSHION_CONTACT_FRICTION = 0.14;
const CUSHION_MAX_SPIN = 80.0;
const CUSHION_MAX_THROW_DEG = 6;
const CUSHION_MAX_THROW_TAN = Math.tan((CUSHION_MAX_THROW_DEG * Math.PI) / 180);
const CUSHION_REF_SPEED = 5.9577;
const CUSHION_COMPRESSION_DAMPING = 0.03;
const CUSHION_HEIGHT = 0.03575;

// Speed mapping (server match)
const MIN_DRAG = 10;
const MAX_DRAG = 400;
const MIN_SPEED = 1.0;
const MAX_SPEED = 13.89;

const MAX_POINTS = 200;

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function dragToSpeed(power: number): number {
  const dragPx = MIN_DRAG + power * (MAX_DRAG - MIN_DRAG);
  const ratio = (dragPx - MIN_DRAG) / (MAX_DRAG - MIN_DRAG);
  return MIN_SPEED + ratio * (MAX_SPEED - MIN_SPEED);
}

function cushionRestitution(vnAbs: number): number {
  const t = 1 / (1 + Math.exp(-CUSHION_K * (vnAbs - CUSHION_V_MID)));
  return CUSHION_E_LOW + (CUSHION_E_HIGH - CUSHION_E_LOW) * t;
}

interface BilliardsGuidelineProps {
  cueBallId: string;
  visible: boolean;
}

/** Mini physics simulation matching server billiards-physics.ts */
function simulateGuidePath(
  startX: number, startZ: number,
  dirRad: number, speed: number,
  sX: number, sY: number, sZ: number,
  otherBalls: { x: number; z: number }[],
): { points: number[]; hitBall: boolean; hitX: number; hitZ: number } {
  let x = startX;
  let z = startZ;
  let vx = speed * Math.cos(dirRad);
  let vz = speed * Math.sin(dirRad);
  let spinX = sX;
  let spinY = sY;
  let spinZ = sZ;

  const points: number[] = [x, LINE_Y, z];
  let hitBall = false;
  let hitX = 0;
  let hitZ = 0;
  let ballHitProcessed = false;

  for (let i = 0; i < SIM_STEPS; i++) {
    const spd = Math.sqrt(vx * vx + vz * vz);
    if (spd < STOP_THRESHOLD) break;

    // ─── SpinZ decay (server match: SPIN_Z_FRICTION = 0.011) ───
    if (Math.abs(spinZ) > 0.01) {
      const spinDecel = (5 * SPIN_Z_FRICTION * GRAVITY) / (2 * BALL_RADIUS) * SIM_DT;
      if (Math.abs(spinZ) <= spinDecel) spinZ = 0;
      else spinZ -= Math.sign(spinZ) * spinDecel;
    }

    // ─── Classify ball state: sliding vs rolling ───
    const vSlipX = vx + BALL_RADIUS * spinY;
    const vSlipZ = vz - BALL_RADIUS * spinX;
    const vSlip = Math.sqrt(vSlipX * vSlipX + vSlipZ * vSlipZ);
    const isSliding = vSlip > SLIP_THRESHOLD;

    if (isSliding) {
      // Sliding friction (server match)
      const slipDirX = vSlipX / vSlip;
      const slipDirZ = vSlipZ / vSlip;
      const linearDelta = SLIDING_FRICTION * GRAVITY * SIM_DT;
      const angularDelta = (5 * SLIDING_FRICTION * GRAVITY) / (2 * BALL_RADIUS) * SIM_DT;

      vx -= linearDelta * slipDirX;
      vz -= linearDelta * slipDirZ;
      spinY -= angularDelta * slipDirX;
      spinX += angularDelta * slipDirZ;

      // Swerve (sliding: stronger)
      if (Math.abs(spinZ) > 0.01) {
        const cappedSZ = clamp(spinZ, -SWERVE_SPIN_CAP, SWERVE_SPIN_CAP);
        const svx = K_SWERVE_SLIDING * cappedSZ * (-vz) * SIM_DT;
        const svz = K_SWERVE_SLIDING * cappedSZ * (vx) * SIM_DT;
        vx += svx;
        vz += svz;
      }
    } else {
      // Rolling friction with Hertzian correction (server match)
      const spdNow = Math.sqrt(vx * vx + vz * vz);
      if (spdNow > STOP_THRESHOLD) {
        const hertzFactor = 1 + ROLLING_HERTZ_COEFF / Math.max(spdNow, 0.05);
        const muR = ROLLING_FRICTION * hertzFactor;
        const spdAfter = Math.max(0, spdNow - muR * GRAVITY * SIM_DT);
        const ratio = spdAfter / spdNow;
        vx *= ratio;
        vz *= ratio;
        spinY = -vx / BALL_RADIUS;
        spinX = vz / BALL_RADIUS;
      }

      // Swerve (rolling: weaker)
      if (Math.abs(spinZ) > 0.01) {
        const cappedSZ = clamp(spinZ, -SWERVE_SPIN_CAP, SWERVE_SPIN_CAP);
        const svx = K_SWERVE_ROLLING * cappedSZ * (-vz) * SIM_DT;
        const svz = K_SWERVE_ROLLING * cappedSZ * (vx) * SIM_DT;
        vx += svx;
        vz += svz;
      }
    }

    // Position update
    x += vx * SIM_DT;
    z += vz * SIM_DT;

    // ─── Cushion collisions with sigmoid restitution + proportional throw ───
    if (x < -BOUND_W) {
      x = -BOUND_W;
      resolveCushionGuideX(vx, vz, spinX, spinZ, -1, (rvx, rvz, rsx, rsz) => {
        vx = rvx; vz = rvz; spinX = rsx; spinZ = rsz;
      });
    } else if (x > BOUND_W) {
      x = BOUND_W;
      resolveCushionGuideX(vx, vz, spinX, spinZ, 1, (rvx, rvz, rsx, rsz) => {
        vx = rvx; vz = rvz; spinX = rsx; spinZ = rsz;
      });
    }
    if (z < -BOUND_H) {
      z = -BOUND_H;
      resolveCushionGuideZ(vx, vz, spinY, spinZ, -1, (rvx, rvz, rsy, rsz) => {
        vx = rvx; vz = rvz; spinY = rsy; spinZ = rsz;
      });
    } else if (z > BOUND_H) {
      z = BOUND_H;
      resolveCushionGuideZ(vx, vz, spinY, spinZ, 1, (rvx, rvz, rsy, rsz) => {
        vx = rvx; vz = rvz; spinY = rsy; spinZ = rsz;
      });
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

          const nx = dx / dist;
          const nz = dz / dist;
          const dot = vx * nx + vz * nz;
          vx -= dot * nx;
          vz -= dot * nz;

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

    if (i % 10 === 0 && points.length < MAX_POINTS * 3) {
      points.push(x, LINE_Y, z);
    }
  }

  if (!ballHitProcessed && points.length < MAX_POINTS * 3) {
    points.push(x, LINE_Y, z);
  }

  return { points, hitBall, hitX, hitZ };
}

/** Cushion X-wall: sigmoid restitution + proportional throw (server match) */
function resolveCushionGuideX(
  vx: number, vz: number, spinXVal: number, spinZVal: number,
  wallSign: number,
  apply: (vx: number, vz: number, spinX: number, spinZ: number) => void,
): void {
  const vn = vx * wallSign;
  const vnAbs = Math.abs(vn);
  if (vnAbs < 0.03) { apply(-vn * 0.7 * wallSign, vz, spinXVal, spinZVal); return; }

  const speed = Math.sqrt(vx * vx + vz * vz);
  const cosInc = speed > 1e-6 ? vnAbs / speed : 1.0;
  const angleCorr = 1 - 0.25 * (1 - cosInc * cosInc);
  const contactTimeDamp = 1 - 0.015 * Math.min(1.0 / Math.max(vnAbs, 0.1), 5.0);
  const eBase = cushionRestitution(vnAbs) * angleCorr * contactTimeDamp;
  const eEff = clamp(eBase, 0.05, 0.98);

  const vnPost = -vn * eEff;
  const newVx = vnPost * wallSign;

  // Throw (proportional to spin, server match)
  const R = BALL_RADIUS;
  const h = CUSHION_HEIGHT - R;
  const dHoriz = Math.sqrt(Math.max(0, R * R - h * h));
  const effectiveSpin = spinZVal * dHoriz / R + spinXVal;
  const baseTan = CUSHION_CONTACT_FRICTION * (1 + eEff) / eEff;
  const vnPostAbs = Math.max(Math.abs(vnPost), 0.1);
  const speedScale = Math.min(Math.pow(CUSHION_REF_SPEED / vnPostAbs, 0.5), 3.5);
  const spinScale = clamp(Math.abs(effectiveSpin) / CUSHION_MAX_SPIN, 0, 1);
  const baseThrowTan = clamp(baseTan * speedScale, 0, CUSHION_MAX_THROW_TAN);
  const throwTan = baseThrowTan * spinScale;
  const throwDir = effectiveSpin > 0 ? 1 : effectiveSpin < 0 ? -1 : 0;
  const throwVt = throwDir * throwTan * Math.abs(vnPost);

  let newVz = vz * (1 - CUSHION_CONTACT_FRICTION) + throwVt;

  // Compression damping
  const comprDepth = clamp(vnAbs / 8.0, 0, 1);
  newVz *= (1 - CUSHION_COMPRESSION_DAMPING * comprDepth);

  // Spin drain
  let newSpinZ = spinZVal;
  if (Math.abs(effectiveSpin) > 0.01) {
    const drain = Math.abs(throwVt) / (R * 2);
    newSpinZ -= Math.sign(newSpinZ) * Math.min(drain, Math.abs(newSpinZ));
  }

  apply(newVx, newVz, spinXVal, newSpinZ);
}

/** Cushion Z-wall: sigmoid restitution + proportional throw (server match) */
function resolveCushionGuideZ(
  vx: number, vz: number, spinYVal: number, spinZVal: number,
  wallSign: number,
  apply: (vx: number, vz: number, spinY: number, spinZ: number) => void,
): void {
  const vn = vz * wallSign;
  const vnAbs = Math.abs(vn);
  if (vnAbs < 0.03) { apply(vx, -vn * 0.7 * wallSign, spinYVal, spinZVal); return; }

  const speed = Math.sqrt(vx * vx + vz * vz);
  const cosInc = speed > 1e-6 ? vnAbs / speed : 1.0;
  const angleCorr = 1 - 0.25 * (1 - cosInc * cosInc);
  const contactTimeDamp = 1 - 0.015 * Math.min(1.0 / Math.max(vnAbs, 0.1), 5.0);
  const eBase = cushionRestitution(vnAbs) * angleCorr * contactTimeDamp;
  const eEff = clamp(eBase, 0.05, 0.98);

  const vnPost = -vn * eEff;
  const newVz = vnPost * wallSign;

  // Throw
  const R = BALL_RADIUS;
  const h = CUSHION_HEIGHT - R;
  const dHoriz = Math.sqrt(Math.max(0, R * R - h * h));
  const effectiveSpin = spinZVal * dHoriz / R + spinYVal;
  const baseTan = CUSHION_CONTACT_FRICTION * (1 + eEff) / eEff;
  const vnPostAbs = Math.max(Math.abs(vnPost), 0.1);
  const speedScale = Math.min(Math.pow(CUSHION_REF_SPEED / vnPostAbs, 0.5), 3.5);
  const spinScale = clamp(Math.abs(effectiveSpin) / CUSHION_MAX_SPIN, 0, 1);
  const baseThrowTan = clamp(baseTan * speedScale, 0, CUSHION_MAX_THROW_TAN);
  const throwTan = baseThrowTan * spinScale;
  const throwDir = effectiveSpin > 0 ? 1 : effectiveSpin < 0 ? -1 : 0;
  const throwVt = throwDir * throwTan * Math.abs(vnPost);

  let newVx = vx * (1 - CUSHION_CONTACT_FRICTION) + throwVt;

  const comprDepth = clamp(vnAbs / 8.0, 0, 1);
  newVx *= (1 - CUSHION_COMPRESSION_DAMPING * comprDepth);

  let newSpinZ = spinZVal;
  if (Math.abs(effectiveSpin) > 0.01) {
    const drain = Math.abs(throwVt) / (R * 2);
    newSpinZ -= Math.sign(newSpinZ) * Math.min(drain, Math.abs(newSpinZ));
  }

  apply(newVx, newVz, spinYVal, newSpinZ);
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
    const R = BALL_RADIUS;
    const R2 = R * R;

    // Use actual power for speed (server match: dragToSpeed)
    const previewPower = Math.max(store.power, 0.05);
    const previewSpeed = dragToSpeed(previewPower);

    // Compute initial spin with direction rotation (server match)
    const backspinMag = (INITIAL_SPIN_SCALE * previewSpeed * store.impactOffsetY) / (2 * R2);
    const spinXInit = backspinMag * Math.sin(dirRad);
    const spinYInit = -backspinMag * Math.cos(dirRad);
    const spinZInit = (INITIAL_SPIN_SCALE * previewSpeed * store.impactOffsetX) / (2 * R2);
    const spinYFinal = spinYInit + spinZInit * Math.sin(CUE_ELEVATION_RAD);

    // Squirt (server match)
    const normalizedOffset = clamp(store.impactOffsetX / R, -1, 1);
    const squirtRad = clamp(normalizedOffset * SQUIRT_COEFFICIENT, -MAX_SQUIRT_RAD, MAX_SQUIRT_RAD);
    const adjustedDirRad = dirRad + squirtRad;

    const otherBalls: { x: number; z: number }[] = [];
    for (const [id, pos] of store.ballPositions) {
      if (id !== cueBallId) otherBalls.push(pos);
    }

    const { points, hitBall, hitX, hitZ } = simulateGuidePath(
      cueBallPos.x, cueBallPos.z,
      adjustedDirRad, previewSpeed,
      spinXInit, spinYFinal, spinZInit,
      otherBalls,
    );

    const posAttr = geometryRef.getAttribute("position") as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    arr.fill(0);
    for (let i = 0; i < points.length && i < MAX_POINTS * 3; i++) {
      arr[i] = points[i];
    }
    posAttr.needsUpdate = true;
    geometryRef.setDrawRange(0, Math.floor(points.length / 3));
    lineObject.computeLineDistances();

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
