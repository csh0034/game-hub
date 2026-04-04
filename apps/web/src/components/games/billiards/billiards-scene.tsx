"use client";

import { useCallback, useEffect, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { BilliardsTable } from "./billiards-table";
import { BilliardsBalls } from "./billiards-balls";
import { BilliardsCue } from "./billiards-cue";
import { BilliardsGuideline } from "./billiards-guideline";
import { BilliardsImpactPoint } from "./billiards-impact-point";
import { BilliardsTrail } from "./billiards-trail";
import { BilliardsCushionFx } from "./billiards-cushion-fx";
import { BilliardsCamera } from "./billiards-camera";
import { useBilliardsStore } from "./billiards-store";

const AIM_STEP_DEG = 1;
const AIM_FINE_STEP_DEG = 0.2;
const IMPACT_STEP = 0.005;
const IMPACT_FINE_STEP = 0.001;

interface BilliardsSceneProps {
  cueBallId: string;
  isAiming: boolean;
  isMyTurn: boolean;
}

export function BilliardsScene({ cueBallId, isAiming, isMyTurn }: BilliardsSceneProps) {
  const showCue = isAiming && isMyTurn;
  const powerRef = useRef<{ startY: number; active: boolean } | null>(null);

  // Keyboard controls: arrow keys for direction, WASD for impact point
  useEffect(() => {
    if (!isMyTurn || !isAiming) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const store = useBilliardsStore.getState();
      const fine = e.shiftKey;

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          store.setAimDirection(store.aimDirection - (fine ? AIM_FINE_STEP_DEG : AIM_STEP_DEG));
          break;
        case "ArrowRight":
          e.preventDefault();
          store.setAimDirection(store.aimDirection + (fine ? AIM_FINE_STEP_DEG : AIM_STEP_DEG));
          break;
        case "w":
        case "W":
          e.preventDefault();
          store.setImpactOffset(0, fine ? IMPACT_FINE_STEP : IMPACT_STEP);
          break;
        case "s":
        case "S":
          e.preventDefault();
          store.setImpactOffset(0, fine ? -IMPACT_FINE_STEP : -IMPACT_STEP);
          break;
        case "a":
        case "A":
          e.preventDefault();
          store.setImpactOffset(fine ? -IMPACT_FINE_STEP : -IMPACT_STEP, 0);
          break;
        case "d":
        case "D":
          e.preventDefault();
          store.setImpactOffset(fine ? IMPACT_FINE_STEP : IMPACT_STEP, 0);
          break;
        case "r":
        case "R":
          e.preventDefault();
          store.resetImpactOffset();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMyTurn, isAiming]);

  // Left click: power only (drag down = power, release = shot)
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0 || !isMyTurn || !isAiming) return;
      powerRef.current = { startY: e.clientY, active: false };
    },
    [isMyTurn, isAiming],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (e.buttons !== 1 || !isMyTurn || !isAiming) return;
      if (!powerRef.current) return;

      const store = useBilliardsStore.getState();
      const dy = e.clientY - powerRef.current.startY;

      if (!powerRef.current.active && dy > 10) {
        powerRef.current.active = true;
        powerRef.current.startY = e.clientY;
        store.setDragging(true, e.clientY);
      }

      if (powerRef.current.active) {
        const powerDy = e.clientY - store.dragStartY;
        const power = Math.max(0, Math.min(1, powerDy / 200));
        store.setPower(power);
      }
    },
    [isMyTurn, isAiming],
  );

  const handlePointerUp = useCallback(() => {
    const store = useBilliardsStore.getState();
    const wasActive = powerRef.current?.active ?? false;
    powerRef.current = null;

    if (!wasActive) {
      store.setDragging(false);
      return;
    }

    store.setDragging(false);

    if (store.power > 0.05) {
      store.startShotAnim();
      window.dispatchEvent(
        new CustomEvent("billiards-shot", {
          detail: { directionDeg: store.aimDirection, power: store.power, impactOffsetX: store.impactOffsetX, impactOffsetY: store.impactOffsetY },
        }),
      );
    }
    store.setPower(0);
  }, []);

  return (
    <div
      className="h-full w-full"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <Canvas shadows gl={{ antialias: true, alpha: false }}>
        <PerspectiveCamera makeDefault fov={50} position={[0, 3.5, 1.5]} />
        <SyncOrbitControls enabled={!isMyTurn} />

        {/* Lighting */}
        <ambientLight intensity={0.4} />
        <spotLight
          position={[0, 10, 0]}
          intensity={1.2}
          angle={Math.PI / 3}
          penumbra={0.3}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-bias={-0.0005}
          shadow-normalBias={0.04}
        />
        <directionalLight position={[5, 5, 5]} intensity={0.5} />

        {/* Camera system */}
        <BilliardsCamera cueBallId={cueBallId} isAiming={isAiming} isMyTurn={isMyTurn} />

        {/* Scene */}
        <BilliardsTable />
        <BilliardsCushionFx />
        <BilliardsBalls />
        <BilliardsTrail cueBallId={cueBallId} />
        <BilliardsCue cueBallId={cueBallId} visible={showCue} />
        <BilliardsGuideline cueBallId={cueBallId} visible={showCue} />
        <BilliardsImpactPoint cueBallId={cueBallId} visible={showCue} />
      </Canvas>
    </div>
  );
}

function SyncOrbitControls({ enabled }: { enabled: boolean }) {
  const controlsRef = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  const wasDisabled = useRef(false);

  useFrame(({ camera }) => {
    if (!controlsRef.current) return;

    // When transitioning from disabled → enabled, sync OrbitControls to current camera
    if (enabled && wasDisabled.current) {
      const controls = controlsRef.current;
      // Compute target from camera direction
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      controls.target.copy(camera.position).add(dir.multiplyScalar(2.5));
      controls.target.y = 0;
      // Save as reset state and reset to clear all internal velocities/deltas
      controls.saveState();
      controls.reset();
      // Restore exact camera position (reset may have moved it)
      camera.position.copy(controls.object.position);
    }
    wasDisabled.current = !enabled;
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enabled={enabled}
      enablePan={false}
      enableZoom={true}
      minDistance={1.2}
      maxDistance={6}
      maxPolarAngle={Math.PI / 2.5}
      mouseButtons={{ LEFT: undefined as never, MIDDLE: undefined as never, RIGHT: 0 }}
    />
  );
}
