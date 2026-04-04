"use client";

const TABLE_WIDTH = 2.844;
const TABLE_HEIGHT = 1.422;
const FRAME_THICKNESS = 0.15;
const FRAME_HEIGHT = 0.037; // standard rail height (~3.7cm above cloth)
const CLOTH_Y = 0;
const CUSHION_THICKNESS = 0.05;

// Colors from billiards-ui.md spec
const CLOTH_COLOR = "#1d4ed8";
const FRAME_COLOR = "#3a2a1f";
const BODY_COLOR = "#2b1d15";
const DIAMOND_COLOR = "#d7d0c2";
const POCKET_COLOR = "#1a1a1a";

const CUSHION_GAP = 0;

function Diamond({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.008, 0.008, 0.003, 16]} />
      <meshStandardMaterial color={DIAMOND_COLOR} />
    </mesh>
  );
}

function Diamonds() {
  const diamonds: [number, number, number][] = [];
  const y = CLOTH_Y + FRAME_HEIGHT;

  // Long sides (9 diamonds each)
  for (let i = 0; i < 9; i++) {
    const x = -TABLE_WIDTH / 2 + (TABLE_WIDTH / 8) * (i + 0.5) - TABLE_WIDTH / 16;
    diamonds.push([x, y, TABLE_HEIGHT / 2 + FRAME_THICKNESS / 2]);
    diamonds.push([x, y, -TABLE_HEIGHT / 2 - FRAME_THICKNESS / 2]);
  }

  // Short sides (5 diamonds each)
  for (let i = 0; i < 5; i++) {
    const z = -TABLE_HEIGHT / 2 + (TABLE_HEIGHT / 4) * (i + 0.5) - TABLE_HEIGHT / 8;
    diamonds.push([TABLE_WIDTH / 2 + FRAME_THICKNESS / 2, y, z]);
    diamonds.push([-TABLE_WIDTH / 2 - FRAME_THICKNESS / 2, y, z]);
  }

  return (
    <>
      {diamonds.map((pos, i) => (
        <Diamond key={i} position={pos} />
      ))}
    </>
  );
}

export function BilliardsTable() {
  // Frame inner edge (where cushion area begins)
  const frameInnerZ = TABLE_HEIGHT / 2 + CUSHION_THICKNESS + CUSHION_GAP;
  const frameInnerX = TABLE_WIDTH / 2 + CUSHION_THICKNESS + CUSHION_GAP;
  const frameDepth = FRAME_THICKNESS - CUSHION_THICKNESS - CUSHION_GAP;

  return (
    <group>
      {/* Cloth (playing surface) */}
      <mesh position={[0, CLOTH_Y, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[TABLE_WIDTH, TABLE_HEIGHT]} />
        <meshStandardMaterial color={CLOTH_COLOR} roughness={0.85} />
      </mesh>

      {/* Frame (4 sides) — pushed outward past cushion+gap to avoid overlap */}
      {/* Top */}
      <mesh position={[0, CLOTH_Y + FRAME_HEIGHT / 2, -frameInnerZ - frameDepth / 2]}>
        <boxGeometry args={[TABLE_WIDTH + FRAME_THICKNESS * 2, FRAME_HEIGHT, frameDepth]} />
        <meshStandardMaterial color={FRAME_COLOR} />
      </mesh>
      {/* Bottom */}
      <mesh position={[0, CLOTH_Y + FRAME_HEIGHT / 2, frameInnerZ + frameDepth / 2]}>
        <boxGeometry args={[TABLE_WIDTH + FRAME_THICKNESS * 2, FRAME_HEIGHT, frameDepth]} />
        <meshStandardMaterial color={FRAME_COLOR} />
      </mesh>
      {/* Left */}
      <mesh position={[-frameInnerX - frameDepth / 2, CLOTH_Y + FRAME_HEIGHT / 2, 0]}>
        <boxGeometry args={[frameDepth, FRAME_HEIGHT, TABLE_HEIGHT + FRAME_THICKNESS * 2]} />
        <meshStandardMaterial color={FRAME_COLOR} />
      </mesh>
      {/* Right */}
      <mesh position={[frameInnerX + frameDepth / 2, CLOTH_Y + FRAME_HEIGHT / 2, 0]}>
        <boxGeometry args={[frameDepth, FRAME_HEIGHT, TABLE_HEIGHT + FRAME_THICKNESS * 2]} />
        <meshStandardMaterial color={FRAME_COLOR} />
      </mesh>

      {/* Diamond markers */}
      <Diamonds />
    </group>
  );
}
