"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useBilliardsStore, MAX_OFFSET } from "./billiards-store";

const BALL_RADIUS = 0.03075;
const DOT_RADIUS = BALL_RADIUS * 0.08;
const RING_INNER = BALL_RADIUS * 0.12;
const RING_OUTER = BALL_RADIUS * 0.18;

interface BilliardsImpactPointProps {
  cueBallId: string;
  visible: boolean;
}

export function BilliardsImpactPoint({ cueBallId, visible }: BilliardsImpactPointProps) {
  const dotRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!visible) return;
    const store = useBilliardsStore.getState();
    const cueBallPos = store.ballPositions.get(cueBallId);
    if (!cueBallPos) return;

    const dirRad = (store.aimDirection * Math.PI) / 180;

    // Impact point on the ball surface facing the cue direction
    // Offset from center based on impactOffsetX (left/right) and impactOffsetY (top/bottom)
    const ox = store.impactOffsetX;
    const oy = store.impactOffsetY;

    // The impact point is on the side of the ball facing away from the cue (the side the cue hits)
    // We place it slightly in front of the ball surface
    const surfaceDist = BALL_RADIUS + 0.001;

    // Perpendicular direction (left/right on ball surface)
    const perpX = -Math.sin(dirRad);
    const perpZ = Math.cos(dirRad);

    // Position: ball center + forward offset + left/right offset + up/down offset
    const px = cueBallPos.x - Math.cos(dirRad) * surfaceDist + perpX * ox;
    const py = BALL_RADIUS + oy;
    const pz = cueBallPos.z - Math.sin(dirRad) * surfaceDist + perpZ * ox;

    if (dotRef.current) {
      dotRef.current.position.set(px, py, pz);
      dotRef.current.lookAt(
        px - Math.cos(dirRad),
        py,
        pz - Math.sin(dirRad),
      );
    }

    if (ringRef.current) {
      ringRef.current.position.set(px, py, pz);
      ringRef.current.lookAt(
        px - Math.cos(dirRad),
        py,
        pz - Math.sin(dirRad),
      );
    }
  });

  if (!visible) return null;

  // Warning color when offset is close to edge (miscue risk)
  const store = useBilliardsStore.getState();
  const offsetRatio = Math.sqrt(store.impactOffsetX ** 2 + store.impactOffsetY ** 2) / MAX_OFFSET;
  const dotColor = offsetRatio > 0.85 ? "#ff0000" : "#ff3333";
  const ringOpacity = offsetRatio > 0.85 ? 0.6 : 0.3;

  return (
    <>
      {/* Red dot at impact point */}
      <mesh ref={dotRef}>
        <circleGeometry args={[DOT_RADIUS, 16]} />
        <meshBasicMaterial color={dotColor} side={THREE.DoubleSide} depthTest={false} />
      </mesh>
      {/* Semi-transparent ring around impact point */}
      <mesh ref={ringRef}>
        <ringGeometry args={[RING_INNER, RING_OUTER, 24]} />
        <meshBasicMaterial
          color={dotColor}
          transparent
          opacity={ringOpacity}
          side={THREE.DoubleSide}
          depthTest={false}
        />
      </mesh>
    </>
  );
}
