import type { BilliardsShotEvent } from "@game-hub/shared-types";

// ─── Table Geometry (meters) ────────────────────────────────────────
export const TABLE_WIDTH = 2.844;
export const TABLE_HEIGHT = 1.422;
export const BALL_RADIUS = 0.03075;
const HALF_W = TABLE_WIDTH / 2;
const HALF_H = TABLE_HEIGHT / 2;
const CUSHION_HEIGHT = 0.037;
export const CUSHION_THICKNESS = 0.05; // m

// ─── Core Physics Constants ─────────────────────────────────────────
const BALL_MASS = 0.21; // kg
const BALL_BALL_RESTITUTION = 0.92; // phenolic resin measured COR (Marlow, Cross)
export const CUSHION_BASE_RESTITUTION = 0.72; // fixed base (replaced by sigmoid in practice)
const SLIDING_FRICTION = 0.2; // μₛ
const ROLLING_FRICTION = 0.01; // μᵣ (Simonis 860 cloth, 0.008~0.012 range)
const GRAVITY = 9.81; // m/s²

// Cushion parameters
const CUSHION_CONTACT_FRICTION = 0.14; // μ for cushion throw
const CUSHION_REF_SPEED = 5.9577; // v_ref for throw calculation
const CUSHION_CONTACT_TIME_EXP = 0.7; // exponent for speedScale
const CUSHION_TORQUE_DAMPING = 0.10; // reduced: 0.35 caused ~20 rad/s spin change per contact
const CUSHION_MAX_SPIN = 7.0; // rad/s for throw normalization (prevents premature saturation)
const CUSHION_MAX_THROW_DEG = 8; // degrees (real max ~5-8°)
const CUSHION_MAX_THROW_TAN = Math.tan((CUSHION_MAX_THROW_DEG * Math.PI) / 180);

// Cushion sigmoid restitution
const CUSHION_E_LOW = 0.88; // low-speed limit
const CUSHION_E_HIGH = 0.52; // high-speed limit (Marlow 1994, Cross 2005 measured)
const CUSHION_V_MID = 2.0; // m/s
const CUSHION_K = 1.5; // steepness

// Cushion side-spin to rolling-spin conversion
const CUSHION_SPIN_CONVERSION = 0.10; // moderate increase from 0.08

// Ball-ball contact friction (spin transfer)
const BALL_BALL_CONTACT_FRICTION = 0.06; // Marlow 2003, Cross 2008 measured

// Swerve (side-spin curve coefficient)
const K_SWERVE = 0.0012; // Magnus force model: scales with speed (effective ~0.004 at 3 m/s)

// Speed limits
const MAX_SPEED = 13.89; // ~50 km/h
const STOP_THRESHOLD = 0.02; // m/s
const STOP_FRAMES_REQUIRED = 5; // 250ms for smoother visual stop

// Spin parameters
const THEORETICAL_SPIN_SCALE = 5.0;
const SPIN_TRANSFER_EFFICIENCY = 0.7;
const INITIAL_SPIN_SCALE = THEORETICAL_SPIN_SCALE * SPIN_TRANSFER_EFFICIENCY; // 3.5
const CUE_ELEVATION_RAD = (3 * Math.PI) / 180; // 3 degrees
const SPIN_Z_FRICTION = 0.015; // μ_spin for spinZ decay (compromise: ~1.3s for 10 rad/s)

// Cue strike parameters
const CUE_MASS = 0.5; // kg
const CUE_TIP_RESTITUTION = 0.7;

// Squirt
const SQUIRT_COEFFICIENT = 0.035; // standard cue ~1.5-3° deflection
const MAX_SQUIRT_RAD = (2 * Math.PI) / 180; // 2 degrees

// Position correction (penetration)
const SLOP = 1e-4;
const CORRECTION_PERCENT = 0.8; // reduced from 0.9 for jitter stability
const MAX_CORRECTION_PER_BALL = BALL_RADIUS * 0.45;

// Energy cap per substep (Joules)
const ENERGY_CAP_DELTA = 0.08;

// ─── Simulation Timing ──────────────────────────────────────────────
const BROADCAST_INTERVAL_MS = 50;
const SUBSTEPS = 12;
const SUBSTEP_DT = BROADCAST_INTERVAL_MS / 1000 / SUBSTEPS;

// Shot input mapping
const MIN_DRAG = 10;
const MAX_DRAG = 400;
const MIN_SPEED = 1.0;

// Max impact offset: 70% of ball radius
const MAX_IMPACT_OFFSET = BALL_RADIUS * 0.7; // 0.021525 m

// State machine thresholds
const ANGULAR_THRESHOLD = 0.2; // rad/s for SPINNING vs STATIONARY
const SLIP_THRESHOLD = 0.01; // m/s

// ─── PhysicsBall (extended with 3-axis spin) ────────────────────────
export interface PhysicsBall {
  id: string;
  x: number;
  z: number;
  vx: number;
  vz: number;
  spinX: number; // Y-direction rolling (couples with vy/vz)
  spinY: number; // X-direction rolling (couples with vx)
  spinZ: number; // Vertical axis spin (side english) → swerve
}

export interface SimulationResult {
  balls: PhysicsBall[];
  events: BilliardsShotEvent[];
  settled: boolean;
}

export interface SimulationFrame {
  balls: { id: string; x: number; z: number; vx: number; vz: number; spinX: number; spinY: number; spinZ: number }[];
  events: BilliardsShotEvent[];
}

// ─── Utility helpers ────────────────────────────────────────────────
function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function sign(v: number): number {
  return v > 0 ? 1 : v < 0 ? -1 : 0;
}

function isNaNOrInfinite(v: number): boolean {
  return Number.isNaN(v) || !Number.isFinite(v);
}

/** Sanitise a single ball: reset any NaN/Inf in position, velocity, or spin to 0. */
function nanGuard(ball: PhysicsBall): void {
  if (isNaNOrInfinite(ball.x)) ball.x = 0;
  if (isNaNOrInfinite(ball.z)) ball.z = 0;
  if (isNaNOrInfinite(ball.vx)) ball.vx = 0;
  if (isNaNOrInfinite(ball.vz)) ball.vz = 0;
  if (isNaNOrInfinite(ball.spinX)) ball.spinX = 0;
  if (isNaNOrInfinite(ball.spinY)) ball.spinY = 0;
  if (isNaNOrInfinite(ball.spinZ)) ball.spinZ = 0;
}

// ─── dragToSpeed ────────────────────────────────────────────────────
// Maps power (0..1) → ball speed (1.0..13.89 m/s)
export function dragToSpeed(power: number): number {
  const dragPx = MIN_DRAG + power * (MAX_DRAG - MIN_DRAG);
  const ratio = (dragPx - MIN_DRAG) / (MAX_DRAG - MIN_DRAG);
  return MIN_SPEED + ratio * (MAX_SPEED - MIN_SPEED);
}

// ─── initBallPositions ──────────────────────────────────────────────
export function initBallPositions(): PhysicsBall[] {
  return [
    { id: "cue", x: -TABLE_WIDTH / 4, z: 0, vx: 0, vz: 0, spinX: 0, spinY: 0, spinZ: 0 },
    { id: "red", x: TABLE_WIDTH / 4, z: 0, vx: 0, vz: 0, spinX: 0, spinY: 0, spinZ: 0 },
    { id: "yellow", x: TABLE_WIDTH / 4, z: TABLE_HEIGHT / 4, vx: 0, vz: 0, spinX: 0, spinY: 0, spinZ: 0 },
  ];
}

// ─── Miscue check ───────────────────────────────────────────────────
// ratio = √(offsetX² + offsetY²) / ballRadius
// ratio ≤ 0.50 → no miscue
// ratio ≥ 0.85 → certain miscue
// 0.50 < ratio < 0.85 → P = t², t = (ratio - 0.5) / 0.35
function checkMiscue(offsetX: number, offsetY: number): boolean {
  const ratio = Math.sqrt(offsetX * offsetX + offsetY * offsetY) / BALL_RADIUS;
  if (ratio <= 0.5) return false;
  if (ratio >= 0.85) return true;
  const t = (ratio - 0.5) / 0.35;
  const probability = t * t * t; // cubic curve: more forgiving at moderate offsets
  return Math.random() < probability;
}

// ─── applyShotToBall (cue strike physics) ───────────────────────────
// directionDeg: direction in degrees, power: 0..1, impactOffsetX/Y: metres from ball centre
export function applyShotToBall(
  ball: PhysicsBall,
  directionDeg: number,
  power: number,
  impactOffsetX = 0,
  impactOffsetY = 0,
): void {
  // § Clamp impact offset to max 70% of ball radius
  const clampedOffsetX = clamp(impactOffsetX, -MAX_IMPACT_OFFSET, MAX_IMPACT_OFFSET);
  const clampedOffsetY = clamp(impactOffsetY, -MAX_IMPACT_OFFSET, MAX_IMPACT_OFFSET);

  // § Miscue check (uses clamped offset)
  if (checkMiscue(clampedOffsetX, clampedOffsetY)) {
    // Miscue: random deflection, reduced power
    const deflection = (Math.random() - 0.5) * (Math.PI / 3); // up to ±30°
    const reducedSpeed = dragToSpeed(power) * 0.3;
    const rad = (directionDeg * Math.PI) / 180 + deflection;
    ball.vx = reducedSpeed * Math.cos(rad);
    ball.vz = reducedSpeed * Math.sin(rad);
    ball.spinX = 0;
    ball.spinY = 0;
    ball.spinZ = 0;
    return;
  }

  // § Target ball speed via collision dynamics
  // 1. dragPx → targetBallSpeed (linear mapping)
  // 2. targetBallSpeed → cueSpeed (reverse collision dynamics)
  // 3. cueSpeed → initialBallSpeed (forward collision dynamics)
  // V_ball = [M_cue × (1 + e_tip) / (M_cue + M_ball)] × V_cue
  const targetBallSpeed = dragToSpeed(power);
  const cueImpactFactor = (CUE_MASS * (1 + CUE_TIP_RESTITUTION)) / (CUE_MASS + BALL_MASS);
  const cueSpeed = targetBallSpeed / cueImpactFactor;
  const ballSpeed = cueImpactFactor * cueSpeed;

  // § Squirt effect (side english deflection)
  // normalizedOffset = clamp(impactOffsetX / ballRadius, -1, 1)
  // squirtAngleRad = clamp(normalizedOffset × 0.018, -π/180, π/180)
  const normalizedOffset = clamp(clampedOffsetX / BALL_RADIUS, -1, 1);
  const squirtAngleRad = clamp(normalizedOffset * SQUIRT_COEFFICIENT, -MAX_SQUIRT_RAD, MAX_SQUIRT_RAD);

  // Direction with squirt correction
  const rad = (directionDeg * Math.PI) / 180 + squirtAngleRad;
  ball.vx = ballSpeed * Math.cos(rad);
  ball.vz = ballSpeed * Math.sin(rad);

  // Clamp speed
  const speed = Math.sqrt(ball.vx * ball.vx + ball.vz * ball.vz);
  if (speed > MAX_SPEED) {
    const s = MAX_SPEED / speed;
    ball.vx *= s;
    ball.vz *= s;
  }

  const R = BALL_RADIUS;
  const R2 = R * R;

  // § Initial angular velocity from impact point (rigid-body impulse theory)
  // omegaX = (3.5 × V_ball × impactOffsetY) / (2 × R²)
  // omegaZ = (3.5 × V_ball × impactOffsetX) / (2 × R²)
  // omegaY = omegaZ × sin(3°)
  const V = Math.sqrt(ball.vx * ball.vx + ball.vz * ball.vz);
  ball.spinX = (INITIAL_SPIN_SCALE * V * clampedOffsetY) / (2 * R2);
  ball.spinZ = (INITIAL_SPIN_SCALE * V * clampedOffsetX) / (2 * R2);
  ball.spinY = ball.spinZ * Math.sin(CUE_ELEVATION_RAD);
}

// ─── 4-state friction model ─────────────────────────────────────────
// States: STATIONARY, SPINNING, SLIDING, ROLLING
// STATIONARY: speed ≤ 0.01 && angularSpeed ≤ 0.2
// SPINNING:   speed ≤ 0.01, angularSpeed > 0.2
// SLIDING:    slip velocity > 0.01
// ROLLING:    otherwise
const BALL_STATE_STATIONARY = 0;
const BALL_STATE_SPINNING = 1;
const BALL_STATE_SLIDING = 2;
const BALL_STATE_ROLLING = 3;

function classifyBall(ball: PhysicsBall): number {
  const speed = Math.sqrt(ball.vx * ball.vx + ball.vz * ball.vz);
  const angularSpeed = Math.sqrt(
    ball.spinX * ball.spinX + ball.spinY * ball.spinY + ball.spinZ * ball.spinZ,
  );

  if (speed <= STOP_THRESHOLD) {
    if (angularSpeed <= ANGULAR_THRESHOLD) return BALL_STATE_STATIONARY;
    return BALL_STATE_SPINNING;
  }

  // Slip velocity: vSlipX = vx + R × spinY, vSlipY = vz - R × spinX
  const vSlipX = ball.vx + BALL_RADIUS * ball.spinY;
  const vSlipY = ball.vz - BALL_RADIUS * ball.spinX;
  const vSlip = Math.sqrt(vSlipX * vSlipX + vSlipY * vSlipY);

  if (vSlip > SLIP_THRESHOLD) return BALL_STATE_SLIDING;
  return BALL_STATE_ROLLING;
}

function applyFriction(ball: PhysicsBall, dt: number): void {
  const state = classifyBall(ball);

  // § spinZ decay (independent of state)
  // μ_spin = 0.02, spinZDecel = (5 × μ_spin × g) / (2 × radius)
  if (Math.abs(ball.spinZ) > 1e-6) {
    const spinZDecel = (5 * SPIN_Z_FRICTION * GRAVITY) / (2 * BALL_RADIUS);
    const spinZDelta = spinZDecel * dt;
    if (Math.abs(ball.spinZ) <= spinZDelta) {
      ball.spinZ = 0;
    } else {
      ball.spinZ -= sign(ball.spinZ) * spinZDelta;
    }
  }

  if (state === BALL_STATE_STATIONARY) {
    ball.vx = 0;
    ball.vz = 0;
    ball.spinX = 0;
    ball.spinY = 0;
    return;
  }

  if (state === BALL_STATE_SPINNING) {
    ball.vx = 0;
    ball.vz = 0;
    // Decay spinX/spinY via cloth friction (same decel as sliding angular)
    const spinDecel = ((5 * SLIDING_FRICTION * GRAVITY) / (2 * BALL_RADIUS)) * dt;
    if (Math.abs(ball.spinX) > spinDecel) {
      ball.spinX -= sign(ball.spinX) * spinDecel;
    } else {
      ball.spinX = 0;
    }
    if (Math.abs(ball.spinY) > spinDecel) {
      ball.spinY -= sign(ball.spinY) * spinDecel;
    } else {
      ball.spinY = 0;
    }
    return;
  }

  if (state === BALL_STATE_SLIDING) {
    // § Slip velocity
    const vSlipX = ball.vx + BALL_RADIUS * ball.spinY;
    const vSlipY = ball.vz - BALL_RADIUS * ball.spinX;
    const vSlip = Math.sqrt(vSlipX * vSlipX + vSlipY * vSlipY);

    if (vSlip < 1e-10) {
      snapToRolling(ball);
      return;
    }

    const slipDirX = vSlipX / vSlip;
    const slipDirY = vSlipY / vSlip;

    // § SLIDING friction integrals
    // linearDelta = μₛ × g × dt
    // angularDelta = (5 × μₛ × g) / (2 × radius) × dt
    const linearDelta = SLIDING_FRICTION * GRAVITY * dt;
    const angularDelta = ((5 * SLIDING_FRICTION * GRAVITY) / (2 * BALL_RADIUS)) * dt;

    // Total slip decrease rate to check if slip dies within this step
    const totalSlipDecrease = linearDelta + BALL_RADIUS * angularDelta;

    if (vSlip <= totalSlipDecrease) {
      // § Slip dies within this step — compute t* and snap to rolling
      // t* = vSlip / totalSlipDecrease(per dt)
      const tStar = vSlip / (totalSlipDecrease / dt);

      // Apply sliding friction for t* duration
      const ld = SLIDING_FRICTION * GRAVITY * tStar;
      const ad = ((5 * SLIDING_FRICTION * GRAVITY) / (2 * BALL_RADIUS)) * tStar;

      ball.vx -= ld * slipDirX;
      ball.vz -= ld * slipDirY;
      ball.spinY -= ad * slipDirX;
      ball.spinX += ad * slipDirY;

      // Snap to rolling (momentum conservation, 5/7 theory)
      snapToRolling(ball);

      // Apply rolling friction for remaining time
      const remainingDt = dt - tStar;
      if (remainingDt > 0) {
        applyRollingFriction(ball, remainingDt);
      }
    } else {
      // Full sliding step
      ball.vx -= linearDelta * slipDirX;
      ball.vz -= linearDelta * slipDirY;
      ball.spinY -= angularDelta * slipDirX;
      ball.spinX += angularDelta * slipDirY;
    }

    // § Swerve effect (Magnus force model: lateral force ∝ spin × speed)
    // At low speed the force naturally vanishes, preventing spiral trajectories
    const speed = Math.sqrt(ball.vx * ball.vx + ball.vz * ball.vz);
    if (speed > STOP_THRESHOLD && Math.abs(ball.spinZ) > 0.01) {
      ball.vx += K_SWERVE * ball.spinZ * (-ball.vz) * dt;
      ball.vz += K_SWERVE * ball.spinZ * (ball.vx) * dt;
    }
    return;
  }

  // BALL_STATE_ROLLING
  applyRollingFriction(ball, dt);

  // Swerve in rolling state too (Magnus force model)
  const speed = Math.sqrt(ball.vx * ball.vx + ball.vz * ball.vz);
  if (speed > STOP_THRESHOLD && Math.abs(ball.spinZ) > 0.01) {
    ball.vx += K_SWERVE * ball.spinZ * (-ball.vz) * dt;
    ball.vz += K_SWERVE * ball.spinZ * (ball.vx) * dt;
  }
}

/** Snap to pure rolling condition (5/7 theory) */
// vxRoll = (5×vx - 2×R×spinY) / 7
// vzRoll = (5×vz + 2×R×spinX) / 7
// spinY_roll = -vx / R, spinX_roll = vz / R
function snapToRolling(ball: PhysicsBall): void {
  const vxRoll = (5 * ball.vx - 2 * BALL_RADIUS * ball.spinY) / 7;
  const vzRoll = (5 * ball.vz + 2 * BALL_RADIUS * ball.spinX) / 7;
  ball.vx = vxRoll;
  ball.vz = vzRoll;
  ball.spinY = -ball.vx / BALL_RADIUS;
  ball.spinX = ball.vz / BALL_RADIUS;
}

/** Apply rolling friction deceleration */
// speedAfter = max(0, speed - μᵣ × g × dt)
function applyRollingFriction(ball: PhysicsBall, dt: number): void {
  const speed = Math.sqrt(ball.vx * ball.vx + ball.vz * ball.vz);
  if (speed < STOP_THRESHOLD) {
    ball.vx = 0;
    ball.vz = 0;
    ball.spinX = 0;
    ball.spinY = 0;
    return;
  }

  const speedAfter = Math.max(0, speed - ROLLING_FRICTION * GRAVITY * dt);
  const ratio = speedAfter / speed;
  ball.vx *= ratio;
  ball.vz *= ratio;

  // Maintain rolling condition: spinY = -vx/R, spinX = vz/R
  ball.spinY = -ball.vx / BALL_RADIUS;
  ball.spinX = ball.vz / BALL_RADIUS;
}

// ─── Ball-ball collision (CCD) ──────────────────────────────────────

/** Sweep CCD for two balls. Returns t in [0,1] or -1 if no collision.
 *  Solves a×t² + b×t + c = 0 where positions are linearly interpolated. */
function sweepBallBallTime(
  ax: number, az: number, avx: number, avz: number,
  bx: number, bz: number, bvx: number, bvz: number,
  dt: number,
): number {
  // Relative position and displacement over the substep
  const dx = bx - ax;
  const dz = bz - az;
  const dvx = (bvx - avx) * dt;
  const dvz = (bvz - avz) * dt;
  const minDist = BALL_RADIUS * 2;

  // a × t² + b × t + c = 0
  const a = dvx * dvx + dvz * dvz;
  const b = 2 * (dx * dvx + dz * dvz);
  const c = dx * dx + dz * dz - minDist * minDist;

  // Already overlapping
  if (c <= 0) return 0;

  if (a < 1e-14) return -1; // no relative motion

  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return -1;

  const sqrtD = Math.sqrt(discriminant);
  const t = (-b - sqrtD) / (2 * a);

  if (t >= 0 && t <= 1) return t;
  return -1;
}

function resolveBallBallCollision(a: PhysicsBall, b: PhysicsBall): boolean {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  const minDist = BALL_RADIUS * 2;

  if (dist < 1e-8) return false;

  // Normal vector
  const nx = dx / dist;
  const nz = dz / dist;

  // Relative velocity along normal
  // vRel_n = (relV · n̂)
  const relVn = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
  if (relVn > 0) return false; // separating

  // Phenolic resin balls maintain near-constant COR across speed range
  const eEff = BALL_BALL_RESTITUTION;

  // § Normal impulse: impulseN = -(1 + e) × vRel_n / invMassSum
  const invMassSum = 1 / BALL_MASS + 1 / BALL_MASS;
  const impulseN = -(1 + eEff) * relVn / invMassSum;
  const impPerMass = impulseN / BALL_MASS;

  a.vx -= impPerMass * nx;
  a.vz -= impPerMass * nz;
  b.vx += impPerMass * nx;
  b.vz += impPerMass * nz;

  // § Tangential impulse (spin transfer, Coulomb friction μ=0.05)
  const tx = -nz; // tangent vector (perpendicular to normal)
  const tz = nx;

  // tangentRelVel = (relV · t̂) + R × (spinZ1 + spinZ2)
  const relVt = (b.vx - a.vx) * tx + (b.vz - a.vz) * tz;
  const tangentRelVel = relVt + BALL_RADIUS * (a.spinZ + b.spinZ);

  // tangentEffMass = invMassSum + 2R²/I, where I = (2/5)mR² → 2R²/I = 5/m
  const tangentEffMass = invMassSum + 5 / BALL_MASS;
  const impulseTRaw = -tangentRelVel / tangentEffMass;
  const maxFrictionImpulse = BALL_BALL_CONTACT_FRICTION * Math.abs(impulseN);
  const impulseT = clamp(impulseTRaw, -maxFrictionImpulse, maxFrictionImpulse);

  a.vx -= (impulseT / BALL_MASS) * tx;
  a.vz -= (impulseT / BALL_MASS) * tz;
  b.vx += (impulseT / BALL_MASS) * tx;
  b.vz += (impulseT / BALL_MASS) * tz;

  // spinDelta = (-5 × impulseT) / (2 × m × R)
  const spinDelta = (-5 * impulseT) / (2 * BALL_MASS * BALL_RADIUS);
  a.spinZ += spinDelta;
  b.spinZ -= spinDelta;

  // § spinX/spinY vertical slip correction
  // Rolling spins create vertical relative surface velocity at the contact point.
  // The resulting friction torque acts on horizontal axes (spinX/spinY), not spinZ.
  const vertSlip = BALL_RADIUS * ((a.spinX + b.spinX) * nz - (a.spinY + b.spinY) * nx);
  if (Math.abs(vertSlip) > 1e-6) {
    const vertImpulseRaw = -vertSlip / tangentEffMass;
    const vertImpulse = clamp(vertImpulseRaw, -maxFrictionImpulse, maxFrictionImpulse);
    const vertSpinDelta = (-5 * vertImpulse) / (2 * BALL_MASS * BALL_RADIUS);
    a.spinX += vertSpinDelta * nz;
    a.spinY -= vertSpinDelta * nx;
    b.spinX -= vertSpinDelta * nz;
    b.spinY += vertSpinDelta * nx;
  }

  // § Rolling spin transfer via contact friction
  // Strong top/back spin transfers to the other ball through contact point friction
  const rollSpinRelN = (b.spinX - a.spinX) * nx + (b.spinY - a.spinY) * nz;
  if (Math.abs(rollSpinRelN) > 1e-6) {
    const rollImpulseRaw = -BALL_RADIUS * rollSpinRelN / tangentEffMass;
    const rollImpulse = clamp(rollImpulseRaw, -maxFrictionImpulse * 0.5, maxFrictionImpulse * 0.5);
    const rollSpinDelta = (-5 * rollImpulse) / (2 * BALL_MASS * BALL_RADIUS);
    a.spinX -= rollSpinDelta * nx;
    a.spinY -= rollSpinDelta * nz;
    b.spinX += rollSpinDelta * nx;
    b.spinY += rollSpinDelta * nz;
  }

  // § Position correction (penetration prevention)
  // slop = 1e-4, percent = 0.9, maxCorrectionPerBall = R × 0.45
  const overlap = minDist - dist;
  if (overlap > SLOP) {
    const correction = Math.min(
      ((overlap - SLOP) / 2) * CORRECTION_PERCENT,
      MAX_CORRECTION_PER_BALL,
    );
    a.x -= correction * nx;
    a.z -= correction * nz;
    b.x += correction * nx;
    b.z += correction * nz;
  }

  return true;
}

// ─── Cushion collision (sweep + sigmoid restitution + throw) ────────

/** Velocity-dependent cushion restitution (sigmoid model)
 *  t = 1 / (1 + exp(-k × (|vn| - v_mid)))
 *  e(|vn|) = e_low + (e_high - e_low) × t */
function cushionRestitution(vnAbs: number): number {
  const t = 1 / (1 + Math.exp(-CUSHION_K * (vnAbs - CUSHION_V_MID)));
  return CUSHION_E_LOW + (CUSHION_E_HIGH - CUSHION_E_LOW) * t;
}

/** Process cushion collision for X-axis wall.
 *  wallSign: -1 for left wall (ball.x < 0), +1 for right wall (ball.x > 0) */
function resolveCushionX(ball: PhysicsBall, wallSign: number): void {
  const vn = ball.vx * wallSign; // positive = approaching wall
  const vnAbs = Math.abs(vn);

  // Skip full cushion physics for very low speed — reflect with higher restitution
  if (vnAbs < 0.03) {
    ball.vx = -vn * 0.7 * wallSign;
    if (Math.abs(ball.vx) < STOP_THRESHOLD) ball.vx = 0;
    return;
  }

  // § Sigmoid base restitution with incidence angle correction
  const speed = Math.sqrt(ball.vx * ball.vx + ball.vz * ball.vz);
  const cosIncidence = speed > 1e-6 ? vnAbs / speed : 1.0;
  const angleCorrection = 1 - 0.12 * (1 - cosIncidence * cosIncidence);
  const eBase = cushionRestitution(vnAbs) * angleCorrection;

  // § Spin-based restitution boost
  // For X-walls, longitudinal spin along wall direction is spinX
  const maxSpinMag = Math.max(
    Math.abs(ball.spinX), Math.abs(ball.spinY), Math.abs(ball.spinZ), 0.01,
  );
  const longitudinalRatio = clamp(ball.spinX / maxSpinMag, -1, 1);
  const restitutionBoost = clamp(-sign(vn) * longitudinalRatio * 0.06, -0.06, 0.06);
  const eEff = clamp(eBase * (1 + restitutionBoost), 0.05, 0.98);

  // Reflect normal velocity
  const vnPost = -vn * eEff;
  ball.vx = vnPost * wallSign;

  // § Cushion contact geometry: h = cushionHeight - ballRadius, d = √(R² - h²)
  const h = CUSHION_HEIGHT - BALL_RADIUS;
  const R = BALL_RADIUS;
  const dHoriz = Math.sqrt(Math.max(0, R * R - h * h));

  // § Throw angle calculation
  // For X-wall, tangential direction is Z; effectiveSpin combines spinZ and rolling
  const effectiveSpin = ball.spinZ * dHoriz / R + ball.spinX;
  // baseTan = μ × (1 + e_eff) / e_eff
  const baseTan = CUSHION_CONTACT_FRICTION * (1 + eEff) / eEff;
  const minSpeed = 0.1;
  const vnPostAbs = Math.max(Math.abs(vnPost), minSpeed);
  // speedScale = min((v_ref / max(|vn_post|, minSpeed))^0.7, 5.0)
  const speedScale = Math.min(
    Math.pow(CUSHION_REF_SPEED / vnPostAbs, CUSHION_CONTACT_TIME_EXP), 5.0,
  );
  // spinScale = clamp(|effectiveSpin| / maxSpin, 0, 1)
  const spinScale = clamp(Math.abs(effectiveSpin) / CUSHION_MAX_SPIN, 0, 1);
  const rawThrowTan = baseTan * speedScale * spinScale;
  // throwTan = clamp(rawThrowTan, 0, tan(25°))
  const throwTan = clamp(rawThrowTan, 0, CUSHION_MAX_THROW_TAN);
  const throwDirection = sign(effectiveSpin);
  // throwVt = throwDirection × throwTan × |vn_post|
  const throwVt = throwDirection * throwTan * Math.abs(vnPost);

  // postVt = vt_pre × (1 - μ) + throwVt
  const vtPre = ball.vz;
  ball.vz = vtPre * (1 - CUSHION_CONTACT_FRICTION) + throwVt;

  // § Cushion contact torque
  // I = (2/5) × m × R², normalImpulse = m × (1 + e_eff) × |vn|
  // contactTorqueSpinDelta = (h × normalImpulse / I) × 0.35
  const I = (2 / 5) * BALL_MASS * R * R;
  const normalImpulse = BALL_MASS * (1 + eEff) * vnAbs;
  const contactTorqueSpinDelta = (h * normalImpulse / I) * CUSHION_TORQUE_DAMPING;
  ball.spinX += contactTorqueSpinDelta * sign(-vn);

  // § Side-spin ↔ rolling spin conversion
  const conversion = CUSHION_CONTACT_FRICTION * CUSHION_SPIN_CONVERSION * ball.spinZ;
  ball.spinX += conversion;

  // § Throw spin drain (energy conservation)
  if (Math.abs(effectiveSpin) > 0.01) {
    const spinDrain = Math.abs(throwVt) / (R * 2);
    ball.spinZ -= sign(ball.spinZ) * Math.min(spinDrain, Math.abs(ball.spinZ));
  }

  // § Speed-dependent rolling spin blending
  const blendSpeed = Math.sqrt(ball.vx * ball.vx + ball.vz * ball.vz);
  const keepRatio = clamp(0.60 + 0.25 * (blendSpeed / 3.0), 0.60, 0.85);
  const targetSpinX = ball.vz / R;
  ball.spinX = ball.spinX * keepRatio + targetSpinX * (1 - keepRatio);
  const targetSpinY = -ball.vx / R;
  ball.spinY = ball.spinY * keepRatio + targetSpinY * (1 - keepRatio);
}

/** Process cushion collision for Z-axis wall.
 *  wallSign: -1 for bottom wall, +1 for top wall */
function resolveCushionZ(ball: PhysicsBall, wallSign: number): void {
  const vn = ball.vz * wallSign;
  const vnAbs = Math.abs(vn);

  // Skip full cushion physics for very low speed — reflect with higher restitution
  if (vnAbs < 0.03) {
    ball.vz = -vn * 0.7 * wallSign;
    if (Math.abs(ball.vz) < STOP_THRESHOLD) ball.vz = 0;
    return;
  }

  // § Sigmoid base restitution with incidence angle correction
  const speed = Math.sqrt(ball.vx * ball.vx + ball.vz * ball.vz);
  const cosIncidence = speed > 1e-6 ? vnAbs / speed : 1.0;
  const angleCorrection = 1 - 0.12 * (1 - cosIncidence * cosIncidence);
  const eBase = cushionRestitution(vnAbs) * angleCorrection;

  const maxSpinMag = Math.max(
    Math.abs(ball.spinX), Math.abs(ball.spinY), Math.abs(ball.spinZ), 0.01,
  );
  const longitudinalRatio = clamp(ball.spinY / maxSpinMag, -1, 1);
  const restitutionBoost = clamp(-sign(vn) * longitudinalRatio * 0.06, -0.06, 0.06);
  const eEff = clamp(eBase * (1 + restitutionBoost), 0.05, 0.98);

  const vnPost = -vn * eEff;
  ball.vz = vnPost * wallSign;

  const h = CUSHION_HEIGHT - BALL_RADIUS;
  const R = BALL_RADIUS;
  const dHoriz = Math.sqrt(Math.max(0, R * R - h * h));

  // For Z-wall, tangential direction is X; effectiveSpin from spinZ and spinY
  const effectiveSpin = ball.spinZ * dHoriz / R + ball.spinY;
  const baseTan = CUSHION_CONTACT_FRICTION * (1 + eEff) / eEff;
  const minSpeed = 0.1;
  const vnPostAbs = Math.max(Math.abs(vnPost), minSpeed);
  const speedScale = Math.min(
    Math.pow(CUSHION_REF_SPEED / vnPostAbs, CUSHION_CONTACT_TIME_EXP), 5.0,
  );
  const spinScale = clamp(Math.abs(effectiveSpin) / CUSHION_MAX_SPIN, 0, 1);
  const rawThrowTan = baseTan * speedScale * spinScale;
  const throwTan = clamp(rawThrowTan, 0, CUSHION_MAX_THROW_TAN);
  const throwDirection = sign(effectiveSpin);
  const throwVt = throwDirection * throwTan * Math.abs(vnPost);

  const vtPre = ball.vx;
  ball.vx = vtPre * (1 - CUSHION_CONTACT_FRICTION) + throwVt;

  const I = (2 / 5) * BALL_MASS * R * R;
  const normalImpulse = BALL_MASS * (1 + eEff) * vnAbs;
  const contactTorqueSpinDelta = (h * normalImpulse / I) * CUSHION_TORQUE_DAMPING;
  ball.spinY += contactTorqueSpinDelta * sign(-vn);

  // § Side-spin ↔ rolling spin conversion
  const conversionVal = CUSHION_CONTACT_FRICTION * CUSHION_SPIN_CONVERSION * ball.spinZ;
  ball.spinY += conversionVal;

  if (Math.abs(effectiveSpin) > 0.01) {
    const spinDrain = Math.abs(throwVt) / (R * 2);
    ball.spinZ -= sign(ball.spinZ) * Math.min(spinDrain, Math.abs(ball.spinZ));
  }

  // § Speed-dependent rolling spin blending
  const blendSpeed = Math.sqrt(ball.vx * ball.vx + ball.vz * ball.vz);
  const keepRatio = clamp(0.60 + 0.25 * (blendSpeed / 3.0), 0.60, 0.85);
  const targetSpinY = -ball.vx / R;
  ball.spinY = ball.spinY * keepRatio + targetSpinY * (1 - keepRatio);
  const targetSpinX = ball.vz / R;
  ball.spinX = ball.spinX * keepRatio + targetSpinX * (1 - keepRatio);
}

/** Sweep-based cushion collision detection and resolution.
 *  Checks if ball crossed boundary between prevPos and current pos.
 *  When both axes cross simultaneously, the earlier crossing is processed first. */
function handleCushionCollisions(
  ball: PhysicsBall, prevX: number, prevZ: number,
): boolean {
  let hit = false;
  const boundX = HALF_W - BALL_RADIUS;
  const boundZ = HALF_H - BALL_RADIUS;

  // Detect crossings and compute parametric crossing time t ∈ [0,1]
  let tX = Infinity;
  let xWallSign = 0;
  const dx = ball.x - prevX;
  if (dx !== 0) {
    if (prevX > -boundX && ball.x <= -boundX) {
      tX = (-boundX - prevX) / dx;
      xWallSign = -1;
    } else if (prevX < boundX && ball.x >= boundX) {
      tX = (boundX - prevX) / dx;
      xWallSign = 1;
    }
  }

  let tZ = Infinity;
  let zWallSign = 0;
  const dz = ball.z - prevZ;
  if (dz !== 0) {
    if (prevZ > -boundZ && ball.z <= -boundZ) {
      tZ = (-boundZ - prevZ) / dz;
      zWallSign = -1;
    } else if (prevZ < boundZ && ball.z >= boundZ) {
      tZ = (boundZ - prevZ) / dz;
      zWallSign = 1;
    }
  }

  // Process crossings in chronological order (earlier axis first)
  if (tX <= tZ) {
    if (xWallSign !== 0) {
      ball.x = xWallSign === -1 ? -boundX : boundX;
      resolveCushionX(ball, xWallSign);
      hit = true;
    }
    if (zWallSign !== 0) {
      ball.z = zWallSign === -1 ? -boundZ : boundZ;
      resolveCushionZ(ball, zWallSign);
      hit = true;
    }
  } else {
    if (zWallSign !== 0) {
      ball.z = zWallSign === -1 ? -boundZ : boundZ;
      resolveCushionZ(ball, zWallSign);
      hit = true;
    }
    if (xWallSign !== 0) {
      ball.x = xWallSign === -1 ? -boundX : boundX;
      resolveCushionX(ball, xWallSign);
      hit = true;
    }
  }

  return hit;
}

/** Fallback: clamp position to boundaries if still outside (after sweep CCD) */
function fallbackCushion(ball: PhysicsBall): boolean {
  let hit = false;
  const boundX = HALF_W - BALL_RADIUS;
  const boundZ = HALF_H - BALL_RADIUS;

  if (ball.x < -boundX) {
    ball.x = -boundX;
    resolveCushionX(ball, -1);
    hit = true;
  } else if (ball.x > boundX) {
    ball.x = boundX;
    resolveCushionX(ball, 1);
    hit = true;
  }

  if (ball.z < -boundZ) {
    ball.z = -boundZ;
    resolveCushionZ(ball, -1);
    hit = true;
  } else if (ball.z > boundZ) {
    ball.z = boundZ;
    resolveCushionZ(ball, 1);
    hit = true;
  }

  return hit;
}

// ─── Energy calculation ─────────────────────────────────────────────
function totalKineticEnergy(balls: PhysicsBall[]): number {
  let ke = 0;
  for (const b of balls) {
    ke += 0.5 * BALL_MASS * (b.vx * b.vx + b.vz * b.vz);
  }
  return ke;
}

// ─── Main simulation step ───────────────────────────────────────────
// Each broadcast interval (50ms) is divided into 12 substeps.
// Per substep: 1) NaN guard → 2) friction → 3) position → 4) sweep cushion
// → 5) fallback cushion → 6) ball-ball CCD → 7) energy cap
export function simulateStep(
  balls: PhysicsBall[],
  cueBallId: string,
  stopFrameCount: number,
): { frame: SimulationFrame; settled: boolean; stopFrameCount: number } {
  const events: BilliardsShotEvent[] = [];
  const now = Date.now();

  for (let sub = 0; sub < SUBSTEPS; sub++) {
    // 1. NaN guard (position/velocity/spin check, recover to 0)
    for (const ball of balls) {
      nanGuard(ball);
    }

    // Compute energy before this substep
    const energyBefore = totalKineticEnergy(balls);

    // 2. Friction (Semi-implicit Euler: friction first, position later)
    for (const ball of balls) {
      applyFriction(ball, SUBSTEP_DT);
    }

    // Save previous positions for sweep CCD
    const prevPositions = balls.map((b) => ({ x: b.x, z: b.z }));

    // 3. Position update: x += vx × dt_sub, z += vz × dt_sub
    for (const ball of balls) {
      ball.x += ball.vx * SUBSTEP_DT;
      ball.z += ball.vz * SUBSTEP_DT;
    }

    // 4. X/Y axis sweep CCD cushion collisions
    for (let i = 0; i < balls.length; i++) {
      const ball = balls[i];
      if (handleCushionCollisions(ball, prevPositions[i].x, prevPositions[i].z)) {
        if (ball.id === cueBallId) {
          events.push({ type: "cushion", ballId: ball.id, timestamp: now });
        }
      }
    }

    // 5. Fallback cushion (boundary clamp)
    for (const ball of balls) {
      if (fallbackCushion(ball)) {
        if (ball.id === cueBallId) {
          // Avoid duplicate event from step 4
          const lastEvt = events[events.length - 1];
          if (
            !lastEvt
            || lastEvt.type !== "cushion"
            || lastEvt.ballId !== ball.id
            || lastEvt.timestamp !== now
          ) {
            events.push({ type: "cushion", ballId: ball.id, timestamp: now });
          }
        }
      }
    }

    // 6. Ball-ball collisions (CCD)
    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        const a = balls[i];
        const b = balls[j];

        // Sweep CCD: check if balls will collide within this substep
        const tHit = sweepBallBallTime(
          prevPositions[i].x, prevPositions[i].z, a.vx, a.vz,
          prevPositions[j].x, prevPositions[j].z, b.vx, b.vz,
          SUBSTEP_DT,
        );

        // Also check current distance (may already be overlapping)
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const overlapping = dist <= BALL_RADIUS * 2;

        if (tHit >= 0 || overlapping) {
          // Save positions before potential rewind
          const savedAx = a.x, savedAz = a.z, savedBx = b.x, savedBz = b.z;
          const shouldRewind = tHit >= 0 && tHit < 1 && !overlapping;

          if (shouldRewind) {
            // Rewind to collision time
            a.x = prevPositions[i].x + a.vx * SUBSTEP_DT * tHit;
            a.z = prevPositions[i].z + a.vz * SUBSTEP_DT * tHit;
            b.x = prevPositions[j].x + b.vx * SUBSTEP_DT * tHit;
            b.z = prevPositions[j].z + b.vz * SUBSTEP_DT * tHit;
          }

          if (resolveBallBallCollision(a, b)) {
            if (a.id === cueBallId) {
              events.push({
                type: "ball-hit", ballId: a.id, targetId: b.id, timestamp: now,
              });
            } else if (b.id === cueBallId) {
              events.push({
                type: "ball-hit", ballId: b.id, targetId: a.id, timestamp: now,
              });
            }

            // Advance remaining time if rewound
            if (shouldRewind) {
              const remaining = (1 - tHit) * SUBSTEP_DT;
              a.x += a.vx * remaining;
              a.z += a.vz * remaining;
              b.x += b.vx * remaining;
              b.z += b.vz * remaining;
            }
          } else if (shouldRewind) {
            // Collision rejected (separating) — restore positions
            a.x = savedAx;
            a.z = savedAz;
            b.x = savedBx;
            b.z = savedBz;
          }
        }
      }
    }

    // 7. Energy cap: prevent energy explosion (0.03 J upper bound per substep)
    // if KE_after > energyBefore + 0.03: scale = √((energyBefore + 0.03) / KE_after)
    const energyAfter = totalKineticEnergy(balls);
    const allowedEnergy = energyBefore + ENERGY_CAP_DELTA;
    if (energyAfter > allowedEnergy && energyAfter > 1e-10) {
      const scale = Math.sqrt(allowedEnergy / energyAfter);
      for (const ball of balls) {
        ball.vx *= scale;
        ball.vz *= scale;
      }
    }

    // Clamp max speed
    for (const ball of balls) {
      const speed = Math.sqrt(ball.vx * ball.vx + ball.vz * ball.vz);
      if (speed > MAX_SPEED) {
        const s = MAX_SPEED / speed;
        ball.vx *= s;
        ball.vz *= s;
      }
    }
  }

  // § Shot termination: all balls linear speed < 0.01 for 5 consecutive frames
  const allStopped = balls.every(
    (b) => Math.sqrt(b.vx * b.vx + b.vz * b.vz) < STOP_THRESHOLD,
  );
  const newStopCount = allStopped ? stopFrameCount + 1 : 0;
  const settled = newStopCount >= STOP_FRAMES_REQUIRED;

  if (settled) {
    for (const ball of balls) {
      ball.vx = 0;
      ball.vz = 0;
      ball.spinX = 0;
      ball.spinY = 0;
      ball.spinZ = 0;
    }
  }

  return {
    frame: {
      balls: balls.map((b) => ({ id: b.id, x: b.x, z: b.z, vx: b.vx, vz: b.vz, spinX: b.spinX, spinY: b.spinY, spinZ: b.spinZ })),
      events,
    },
    settled,
    stopFrameCount: newStopCount,
  };
}

// ─── 3-cushion scoring ──────────────────────────────────────────────
// Two conditions must both be met:
// 1. Cue ball hits both object balls
// 2. Before hitting the 2nd object ball, cue ball contacts cushions ≥ 3 times
export function checkThreeCushionScore(
  shotEvents: BilliardsShotEvent[],
  cueBallId: string,
): { scored: boolean; cushionCount: number; objectBallsHit: string[] } {
  let cushionCount = 0;
  const objectBallsHit: string[] = [];
  let secondObjectBallHit = false;

  for (const event of shotEvents) {
    if (secondObjectBallHit) break;

    if (event.type === "cushion" && event.ballId === cueBallId) {
      cushionCount++;
    }

    if (event.type === "ball-hit" && event.ballId === cueBallId && event.targetId) {
      if (!objectBallsHit.includes(event.targetId)) {
        objectBallsHit.push(event.targetId);
        if (objectBallsHit.length === 2) {
          secondObjectBallHit = true;
        }
      }
    }
  }

  const scored = objectBallsHit.length === 2 && cushionCount >= 3;
  return { scored, cushionCount, objectBallsHit };
}

export const BROADCAST_INTERVAL = BROADCAST_INTERVAL_MS;
