"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";
import { useBilliardsStore } from "./billiards-store";

const TABLE_WIDTH = 2.844;
const TABLE_HEIGHT = 1.422;
const CUSHION_HEIGHT = 0.037; // match FRAME_HEIGHT
const CUSHION_THICKNESS = 0.05;
const CLOTH_Y = 0;
const CUSHION_COLOR = "#2d57dc";

// Cushion center positions (no overlap with frame — frame starts after CUSHION_THICKNESS + gap)
const CUSHION_OFFSET_Z = TABLE_HEIGHT / 2 + CUSHION_THICKNESS / 2;
const CUSHION_OFFSET_X = TABLE_WIDTH / 2 + CUSHION_THICKNESS / 2;

// Spring-damper parameters
const SPRING_K = 15;
const DAMPING = 0.75;
const MIN_DEFORM = 0.05;
const MAX_DEFORM = 0.35;

interface CushionState {
  deformation: number;
  velocity: number;
}

function deformFromSpeed(speed: number): number {
  const t = Math.max(0, Math.min(1, (speed - 1) / 9));
  return MIN_DEFORM + t * (MAX_DEFORM - MIN_DEFORM);
}

export function BilliardsCushionFx() {
  const cushionRefs = useRef<Record<string, Mesh | null>>({
    top: null, bottom: null, left: null, right: null,
  });

  const states = useRef<Record<string, CushionState>>({
    top: { deformation: 0, velocity: 0 },
    bottom: { deformation: 0, velocity: 0 },
    left: { deformation: 0, velocity: 0 },
    right: { deformation: 0, velocity: 0 },
  });

  const processedHits = useRef(0);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const hits = useBilliardsStore.getState().cushionHits;

    for (let i = processedHits.current; i < hits.length; i++) {
      const hit = hits[i];
      const st = states.current[hit.side];
      if (st) {
        st.deformation = deformFromSpeed(hit.speed);
        st.velocity = 0;
      }
    }
    processedHits.current = hits.length;

    for (const side of ["top", "bottom", "left", "right"] as const) {
      const st = states.current[side];
      const mesh = cushionRefs.current[side];
      if (!st || !mesh) continue;

      if (Math.abs(st.deformation) < 0.001 && Math.abs(st.velocity) < 0.001) {
        mesh.scale.set(1, 1, 1);
        continue;
      }

      const force = -SPRING_K * st.deformation - DAMPING * st.velocity;
      st.velocity += force * dt;
      st.deformation += st.velocity * dt;

      if (Math.abs(st.deformation) < 0.001) {
        st.deformation = 0;
        st.velocity = 0;
      }

      const compression = 1 - Math.abs(st.deformation);
      if (side === "top" || side === "bottom") {
        mesh.scale.set(1, 1, compression);
      } else {
        mesh.scale.set(compression, 1, 1);
      }
    }
  });

  return (
    <>
      <mesh
        ref={(el) => { cushionRefs.current.top = el; }}
        position={[0, CLOTH_Y + CUSHION_HEIGHT / 2, -CUSHION_OFFSET_Z]}
      >
        <boxGeometry args={[TABLE_WIDTH, CUSHION_HEIGHT, CUSHION_THICKNESS]} />
        <meshStandardMaterial color={CUSHION_COLOR} />
      </mesh>
      <mesh
        ref={(el) => { cushionRefs.current.bottom = el; }}
        position={[0, CLOTH_Y + CUSHION_HEIGHT / 2, CUSHION_OFFSET_Z]}
      >
        <boxGeometry args={[TABLE_WIDTH, CUSHION_HEIGHT, CUSHION_THICKNESS]} />
        <meshStandardMaterial color={CUSHION_COLOR} />
      </mesh>
      <mesh
        ref={(el) => { cushionRefs.current.left = el; }}
        position={[-CUSHION_OFFSET_X, CLOTH_Y + CUSHION_HEIGHT / 2, 0]}
      >
        <boxGeometry args={[CUSHION_THICKNESS, CUSHION_HEIGHT, TABLE_HEIGHT]} />
        <meshStandardMaterial color={CUSHION_COLOR} />
      </mesh>
      <mesh
        ref={(el) => { cushionRefs.current.right = el; }}
        position={[CUSHION_OFFSET_X, CLOTH_Y + CUSHION_HEIGHT / 2, 0]}
      >
        <boxGeometry args={[CUSHION_THICKNESS, CUSHION_HEIGHT, TABLE_HEIGHT]} />
        <meshStandardMaterial color={CUSHION_COLOR} />
      </mesh>
      {/* Corner fillers — fill gaps where cushions meet */}
      {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([sx, sz], i) => (
        <mesh
          key={`cushion-corner-${i}`}
          position={[
            sx * CUSHION_OFFSET_X,
            CLOTH_Y + CUSHION_HEIGHT / 2,
            sz * CUSHION_OFFSET_Z,
          ]}
        >
          <boxGeometry args={[CUSHION_THICKNESS, CUSHION_HEIGHT, CUSHION_THICKNESS]} />
          <meshStandardMaterial color={CUSHION_COLOR} />
        </mesh>
      ))}
    </>
  );
}
