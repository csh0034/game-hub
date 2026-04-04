"use client";

import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useBilliardsStore } from "./billiards-store";

const FOLLOW_LERP = 0.05;
const DEFAULT_DISTANCE = 2.5;
const MIN_DISTANCE = 1.2;
const MAX_DISTANCE = 6.0;
const DEFAULT_POLAR = 0.55; // radians from top (~31°)
const MIN_POLAR = 0.15;
const MAX_POLAR = 1.2;
const LOOK_AHEAD = 0.3;
const ZOOM_SPEED = 0.15;
const AIM_ORBIT_SPEED = 0.12; // degrees per px
const POLAR_ORBIT_SPEED = 0.003; // radians per px

interface BilliardsCameraProps {
  cueBallId: string;
  isAiming: boolean;
  isMyTurn: boolean;
}

export function BilliardsCamera({ cueBallId, isAiming, isMyTurn }: BilliardsCameraProps) {
  const prevTurnRef = useRef("");
  const currentPos = useRef(new THREE.Vector3(0, 2, 2.5));
  const currentLook = useRef(new THREE.Vector3(0, 0, 0));

  const polarAngle = useRef(DEFAULT_POLAR);
  const distance = useRef(DEFAULT_DISTANCE);
  const azimuthAngle = useRef(0); // for free orbit during simulation

  const followMode = isAiming && isMyTurn;
  const freeOrbitMode = !isAiming && isMyTurn; // my turn simulation

  useEffect(() => {
    let isRightDragging = false;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 2) isRightDragging = true;
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 2) isRightDragging = false;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isRightDragging) return;

      if (Math.abs(e.movementX) > 0) {
        if (followMode) {
          // Aiming: change aim direction
          const store = useBilliardsStore.getState();
          store.setAimDirection(store.aimDirection + e.movementX * AIM_ORBIT_SPEED);
        } else {
          // Free orbit: rotate azimuth
          azimuthAngle.current += e.movementX * 0.005;
        }
      }

      if (Math.abs(e.movementY) > 0) {
        polarAngle.current = Math.max(MIN_POLAR, Math.min(MAX_POLAR,
          polarAngle.current - e.movementY * POLAR_ORBIT_SPEED,
        ));
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 1 : -1;
      distance.current = Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE,
        distance.current + delta * ZOOM_SPEED,
      ));
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("contextmenu", onContextMenu);

    return () => {
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("contextmenu", onContextMenu);
    };
  }, [followMode]);

  useFrame((state) => {
    const store = useBilliardsStore.getState();
    const cam = state.camera;

    // Not my turn — let OrbitControls handle it
    if (!isMyTurn) {
      prevTurnRef.current = "";
      return;
    }

    // --- Free orbit during my simulation ---
    if (freeOrbitMode) {
      // Orbit around the saved lookAt point using polar/azimuth/distance
      const center = currentLook.current;
      const polar = polarAngle.current;
      const azimuth = azimuthAngle.current;
      const dist = distance.current;

      const x = center.x + Math.sin(polar) * Math.cos(azimuth) * dist;
      const y = center.y + Math.cos(polar) * dist;
      const z = center.z + Math.sin(polar) * Math.sin(azimuth) * dist;

      currentPos.current.set(x, y, z);
      cam.position.copy(currentPos.current);
      cam.lookAt(currentLook.current);
      return;
    }

    // --- Follow mode (aiming) ---

    const cueBallPos = store.ballPositions.get(cueBallId);
    if (!cueBallPos) return;

    // Auto-aim on first frame of my turn
    if (prevTurnRef.current === "") {
      let nearestDist = Infinity;
      let nearestPos: { x: number; z: number } | null = null;
      for (const [id, pos] of store.ballPositions) {
        if (id === cueBallId) continue;
        const dx = pos.x - cueBallPos.x;
        const dz = pos.z - cueBallPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < nearestDist) { nearestDist = dist; nearestPos = pos; }
      }
      if (nearestPos) {
        const dx = nearestPos.x - cueBallPos.x;
        const dz = nearestPos.z - cueBallPos.z;
        store.setAimDirection((Math.atan2(dz, dx) * 180) / Math.PI);
      }
      prevTurnRef.current = "initialized";
    }

    // Camera: spherical behind cue ball
    const aimRad = (store.aimDirection * Math.PI) / 180;
    const azimuth = aimRad + Math.PI;
    const polar = polarAngle.current;
    const dist = distance.current;

    const targetX = cueBallPos.x + Math.sin(polar) * Math.cos(azimuth) * dist;
    const targetY = Math.cos(polar) * dist;
    const targetZ = cueBallPos.z + Math.sin(polar) * Math.sin(azimuth) * dist;

    const lookX = cueBallPos.x + Math.cos(aimRad) * LOOK_AHEAD;
    const lookZ = cueBallPos.z + Math.sin(aimRad) * LOOK_AHEAD;

    currentPos.current.lerp(new THREE.Vector3(targetX, targetY, targetZ), FOLLOW_LERP);
    currentLook.current.lerp(new THREE.Vector3(lookX, 0, lookZ), FOLLOW_LERP);

    // Save azimuth for seamless transition to free orbit
    azimuthAngle.current = azimuth;

    cam.position.copy(currentPos.current);
    cam.lookAt(currentLook.current);
  });

  return null;
}
