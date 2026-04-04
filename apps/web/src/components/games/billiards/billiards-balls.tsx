"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useBilliardsStore } from "./billiards-store";

const BALL_RADIUS = 0.03075;
const BALL_Y = BALL_RADIUS;
const SPIN_DOT_RADIUS = BALL_RADIUS * 0.08;
const BROADCAST_INTERVAL_MS = 50;

// Table boundaries for clamping extrapolated positions
const TABLE_WIDTH = 2.844;
const TABLE_HEIGHT = 1.422;
const BOUND_W = TABLE_WIDTH / 2 - BALL_RADIUS;
const BOUND_H = TABLE_HEIGHT / 2 - BALL_RADIUS;

const BALL_COLORS: Record<string, string> = {
  cue: "#ffffff",
  red: "#ff0000",
  yellow: "#ffd700",
};

function Ball({ id }: { id: string }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!groupRef.current) return;
    const store = useBilliardsStore.getState();
    const interp = store.ballInterp.get(id);
    if (!interp) return;

    const elapsed = performance.now() - store.frameTime;
    const frameDuration = store.frameTime - store.prevFrameTime;
    const dt = frameDuration > 0 ? frameDuration : BROADCAST_INTERVAL_MS;
    const t = elapsed / dt;

    let x: number;
    let z: number;

    if (t <= 1.0) {
      // Lerp between previous and current frame
      x = interp.prevX + (interp.currX - interp.prevX) * t;
      z = interp.prevZ + (interp.currZ - interp.prevZ) * t;
    } else {
      // Extrapolate beyond current frame using velocity
      const overTime = (elapsed - dt) / 1000; // seconds past current frame
      x = interp.currX + interp.vx * overTime;
      z = interp.currZ + interp.vz * overTime;
      // Clamp to table boundaries to prevent visual penetration
      x = Math.max(-BOUND_W, Math.min(BOUND_W, x));
      z = Math.max(-BOUND_H, Math.min(BOUND_H, z));
    }

    groupRef.current.position.x = x;
    groupRef.current.position.z = z;

    // Apply spin-based rotation using server spin data
    const frameTimeSec = dt / 1000;
    const interpDt = frameTimeSec / 60;

    if (Math.abs(interp.spinX) > 0.01 || Math.abs(interp.spinY) > 0.01 || Math.abs(interp.spinZ) > 0.01) {
      const wx = interp.spinX * interpDt;
      const wy = interp.spinZ * interpDt;
      const wz = -interp.spinY * interpDt;

      const angle = Math.sqrt(wx * wx + wy * wy + wz * wz);
      if (angle > 1e-6) {
        const axis = new THREE.Vector3(wx / angle, wy / angle, wz / angle);
        const q = new THREE.Quaternion().setFromAxisAngle(axis, angle);
        groupRef.current.quaternion.premultiply(q);
      }
    }
  });

  const color = BALL_COLORS[id] ?? "#ffffff";
  return (
    <group ref={groupRef} position={[0, BALL_Y, 0]}>
      {/* Ball sphere */}
      <mesh castShadow>
        <sphereGeometry args={[BALL_RADIUS, 32, 32]} />
        <meshPhysicalMaterial
          color={color}
          roughness={0.05}
          metalness={0.1}
          clearcoat={1.0}
          clearcoatRoughness={0.05}
        />
      </mesh>

      {/* Spin visualization: red dot on top */}
      <mesh position={[0, BALL_RADIUS - SPIN_DOT_RADIUS * 0.3, 0]}>
        <sphereGeometry args={[SPIN_DOT_RADIUS, 8, 8]} />
        <meshBasicMaterial color="#cc0000" />
      </mesh>
    </group>
  );
}

export function BilliardsBalls() {
  return (
    <>
      <Ball id="cue" />
      <Ball id="red" />
      <Ball id="yellow" />
    </>
  );
}
