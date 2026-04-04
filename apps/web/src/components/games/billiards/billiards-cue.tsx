"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useBilliardsStore } from "./billiards-store";

const BALL_RADIUS = 0.03075;

// Cue dimensions
const SHAFT_LENGTH = 1.05;
const FERRULE_LENGTH = 0.025;
const TIP_LENGTH = 0.015;
const GRIP_LENGTH = 0.42;
const WRAP_LENGTH = 0.3;
const CUE_TOTAL_LENGTH = TIP_LENGTH + FERRULE_LENGTH + SHAFT_LENGTH + WRAP_LENGTH + GRIP_LENGTH;

const TIP_RADIUS = 0.0065;
const FERRULE_RADIUS = 0.0068;
const SHAFT_TOP_RADIUS = 0.007;
const SHAFT_BOTTOM_RADIUS = 0.0125;
const WRAP_RADIUS = 0.013;
const GRIP_RADIUS = 0.0145;
const BUTT_CAP_RADIUS = 0.016;

const PULL_BACK_MAX = 0.3;
const CUE_ELEVATION_DEG = 4; // slight upward angle to avoid table clipping
const SHOT_ANIM_DURATION = 200; // ms
const SHOT_ANIM_FORWARD = 0.1; // m forward stroke

// Power gauge dimensions
const GAUGE_WIDTH = 0.15;
const GAUGE_HEIGHT = 0.012;

interface BilliardsCueProps {
  cueBallId: string;
  visible: boolean;
}

function powerColor(power: number): THREE.Color {
  if (power < 0.3) return new THREE.Color(0x22c55e); // green
  if (power < 0.7) return new THREE.Color(0xeab308); // yellow
  return new THREE.Color(0xef4444); // red
}

export function BilliardsCue({ cueBallId, visible }: BilliardsCueProps) {
  const groupRef = useRef<THREE.Group>(null);
  const gaugeRef = useRef<THREE.Mesh>(null);
  const gaugeBgRef = useRef<THREE.Mesh>(null);
  const gaugeMat = useMemo(() => new THREE.MeshBasicMaterial({ color: 0x22c55e, depthTest: false }), []);

  const elevationRad = useMemo(() => (CUE_ELEVATION_DEG * Math.PI) / 180, []);

  // Pre-create geometries
  const tipGeo = useMemo(() => new THREE.CylinderGeometry(TIP_RADIUS * 0.85, TIP_RADIUS, TIP_LENGTH, 16), []);
  const ferruleGeo = useMemo(() => new THREE.CylinderGeometry(FERRULE_RADIUS, FERRULE_RADIUS, FERRULE_LENGTH, 16), []);
  const shaftGeo = useMemo(() => new THREE.CylinderGeometry(SHAFT_TOP_RADIUS, SHAFT_BOTTOM_RADIUS, SHAFT_LENGTH, 16), []);
  const wrapGeo = useMemo(() => new THREE.CylinderGeometry(WRAP_RADIUS, WRAP_RADIUS, WRAP_LENGTH, 16), []);
  const gripGeo = useMemo(() => new THREE.CylinderGeometry(GRIP_RADIUS, BUTT_CAP_RADIUS, GRIP_LENGTH, 16), []);
  const buttCapGeo = useMemo(() => new THREE.CylinderGeometry(BUTT_CAP_RADIUS, BUTT_CAP_RADIUS * 0.9, 0.012, 16), []);

  // Materials
  const tipMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#5ba3d9", roughness: 0.9, depthTest: false }), []);
  const ferruleMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#f0ece0", roughness: 0.3, metalness: 0.1, depthTest: false }), []);
  const shaftMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#e8c882",
        roughness: 0.35,
        metalness: 0.05,
        depthTest: false,
      }),
    [],
  );
  const wrapMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#4a3a5c", roughness: 0.7, depthTest: false }), []);
  const gripMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#6b3a2a",
        roughness: 0.4,
        metalness: 0.05,
        depthTest: false,
      }),
    [],
  );
  const buttCapMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#8c7b6b", roughness: 0.5, metalness: 0.3, depthTest: false }), []);

  // Y offsets (tip is at top, butt at bottom)
  const tipY = CUE_TOTAL_LENGTH / 2 - TIP_LENGTH / 2;
  const ferruleY = tipY - TIP_LENGTH / 2 - FERRULE_LENGTH / 2;
  const shaftY = ferruleY - FERRULE_LENGTH / 2 - SHAFT_LENGTH / 2;
  const wrapY = shaftY - SHAFT_LENGTH / 2 - WRAP_LENGTH / 2;
  const gripY = wrapY - WRAP_LENGTH / 2 - GRIP_LENGTH / 2;
  const buttCapY = gripY - GRIP_LENGTH / 2 - 0.006;

  useFrame(() => {
    if (!groupRef.current || !visible) return;
    const store = useBilliardsStore.getState();
    const cueBallPos = store.ballPositions.get(cueBallId);
    if (!cueBallPos) return;

    const dirRad = (store.aimDirection * Math.PI) / 180;
    const pullBack = store.isDragging ? store.power * PULL_BACK_MAX : 0;

    // § Shot animation: 200ms sin curve forward stroke
    let shotOffset = 0;
    if (store.shotAnimStartTime > 0) {
      const elapsed = performance.now() - store.shotAnimStartTime;
      if (elapsed < SHOT_ANIM_DURATION) {
        const t = elapsed / SHOT_ANIM_DURATION;
        shotOffset = Math.sin(t * Math.PI) * SHOT_ANIM_FORWARD;
      } else {
        store.shotAnimStartTime = 0; // reset directly (avoid set call in frame)
      }
    }

    // Position cue behind the ball with slight elevation
    const horizontalDist = BALL_RADIUS + CUE_TOTAL_LENGTH / 2 + 0.06 + pullBack - shotOffset;
    const cueBaseY = BALL_RADIUS + Math.sin(elevationRad) * (CUE_TOTAL_LENGTH / 2 + 0.06 + pullBack);

    groupRef.current.position.set(
      cueBallPos.x - Math.cos(dirRad) * horizontalDist * Math.cos(elevationRad),
      cueBaseY,
      cueBallPos.z - Math.sin(dirRad) * horizontalDist * Math.cos(elevationRad),
    );

    // Orient cue: point at ball with slight downward tilt
    groupRef.current.rotation.set(0, 0, 0);
    groupRef.current.lookAt(cueBallPos.x, BALL_RADIUS, cueBallPos.z);
    groupRef.current.rotateX(Math.PI / 2);

    // § Power gauge visibility & scale
    if (gaugeRef.current && gaugeBgRef.current) {
      const showGauge = store.isDragging && store.power > 0.01;
      gaugeRef.current.visible = showGauge;
      gaugeBgRef.current.visible = showGauge;
      if (showGauge) {
        gaugeRef.current.scale.x = store.power;
        gaugeRef.current.position.x = -GAUGE_WIDTH * (1 - store.power) / 2;
        gaugeMat.color.copy(powerColor(store.power));
      }
    }
  });

  if (!visible) return null;

  return (
    <group ref={groupRef}>
      {/* Tip (leather) */}
      <mesh geometry={tipGeo} material={tipMat} position={[0, tipY, 0]} renderOrder={10} />
      {/* Ferrule (white plastic/ivory) */}
      <mesh geometry={ferruleGeo} material={ferruleMat} position={[0, ferruleY, 0]} renderOrder={10} />
      {/* Shaft (maple wood) */}
      <mesh geometry={shaftGeo} material={shaftMat} position={[0, shaftY, 0]} renderOrder={10} />
      {/* Wrap (linen/leather) */}
      <mesh geometry={wrapGeo} material={wrapMat} position={[0, wrapY, 0]} renderOrder={10} />
      {/* Grip (hardwood butt) */}
      <mesh geometry={gripGeo} material={gripMat} position={[0, gripY, 0]} renderOrder={10} />
      {/* Butt cap (rubber) */}
      <mesh geometry={buttCapGeo} material={buttCapMat} position={[0, buttCapY, 0]} renderOrder={10} />

      {/* Power gauge (background) */}
      <mesh ref={gaugeBgRef} position={[0, tipY + 0.04, 0.02]} visible={false} renderOrder={1}>
        <planeGeometry args={[GAUGE_WIDTH, GAUGE_HEIGHT]} />
        <meshBasicMaterial color="#333333" transparent opacity={0.6} depthTest={false} />
      </mesh>
      {/* Power gauge (fill) */}
      <mesh ref={gaugeRef} position={[0, tipY + 0.04, 0.021]} visible={false} renderOrder={2}>
        <planeGeometry args={[GAUGE_WIDTH, GAUGE_HEIGHT * 0.8]} />
        <primitive object={gaugeMat} attach="material" />
      </mesh>
    </group>
  );
}
