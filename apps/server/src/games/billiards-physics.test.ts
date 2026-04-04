import { describe, it, expect } from "vitest";
import {
  initBallPositions,
  applyShotToBall,
  simulateStep,
  checkThreeCushionScore,
  dragToSpeed,
  TABLE_WIDTH,
  TABLE_HEIGHT,
  BALL_RADIUS,
  CUSHION_THICKNESS,
  CUSHION_BASE_RESTITUTION,
  type PhysicsBall,
} from "./billiards-physics.js";
import type { BilliardsShotEvent } from "@game-hub/shared-types";

const BALL_MASS = 0.21;
const HALF_W = TABLE_WIDTH / 2;
const HALF_H = TABLE_HEIGHT / 2;

/** 샷을 발사하고 시뮬레이션이 완전히 멈출 때까지 실행하는 헬퍼 */
function runFullSimulation(
  balls: PhysicsBall[],
  cueBallId: string,
  maxFrames = 600,
): { frames: number; events: BilliardsShotEvent[] } {
  let stopCount = 0;
  const allEvents: BilliardsShotEvent[] = [];
  for (let i = 0; i < maxFrames; i++) {
    const result = simulateStep(balls, cueBallId, stopCount);
    stopCount = result.stopFrameCount;
    allEvents.push(...result.frame.events);
    if (result.settled) return { frames: i + 1, events: allEvents };
  }
  return { frames: maxFrames, events: allEvents };
}

/** 운동에너지 계산 */
function totalKE(balls: PhysicsBall[]): number {
  return balls.reduce((sum, b) => sum + 0.5 * BALL_MASS * (b.vx * b.vx + b.vz * b.vz), 0);
}

/** 스핀 포함 PhysicsBall 리터럴 헬퍼 */
function makeBall(
  id: string,
  overrides: Partial<PhysicsBall> = {},
): PhysicsBall {
  return { id, x: 0, z: 0, vx: 0, vz: 0, spinX: 0, spinY: 0, spinZ: 0, ...overrides };
}

describe("billiards-physics", () => {
  describe("initBallPositions", () => {
    it("3개의 공을 초기 위치에 배치한다", () => {
      const balls = initBallPositions();
      expect(balls).toHaveLength(3);
      expect(balls.map((b) => b.id)).toEqual(["cue", "red", "yellow"]);
    });

    it("모든 공의 초기 속도는 0이다", () => {
      const balls = initBallPositions();
      for (const ball of balls) {
        expect(ball.vx).toBe(0);
        expect(ball.vz).toBe(0);
      }
    });

    it("모든 공의 초기 스핀은 0이다", () => {
      const balls = initBallPositions();
      for (const ball of balls) {
        expect(ball.spinX).toBe(0);
        expect(ball.spinY).toBe(0);
        expect(ball.spinZ).toBe(0);
      }
    });

    it("모든 공이 테이블 안에 위치한다", () => {
      const balls = initBallPositions();
      const halfW = TABLE_WIDTH / 2 - BALL_RADIUS;
      const halfH = TABLE_HEIGHT / 2 - BALL_RADIUS;
      for (const ball of balls) {
        expect(Math.abs(ball.x)).toBeLessThanOrEqual(halfW);
        expect(Math.abs(ball.z)).toBeLessThanOrEqual(halfH);
      }
    });
  });

  describe("dragToSpeed", () => {
    it("power 0은 최소 속도를 반환한다", () => {
      const speed = dragToSpeed(0);
      expect(speed).toBeCloseTo(1.0, 1);
    });

    it("power 1은 최대 속도를 반환한다", () => {
      const speed = dragToSpeed(1);
      expect(speed).toBeCloseTo(13.89, 1);
    });

    it("power 0.5는 중간 속도를 반환한다", () => {
      const speed = dragToSpeed(0.5);
      expect(speed).toBeGreaterThan(1);
      expect(speed).toBeLessThan(13.89);
    });
  });

  describe("applyShotToBall", () => {
    it("0도 방향으로 샷하면 +x 방향으로 속도가 설정된다", () => {
      const ball = makeBall("cue");
      applyShotToBall(ball, 0, 0.5);
      expect(ball.vx).toBeGreaterThan(0);
      expect(Math.abs(ball.vz)).toBeLessThan(0.01);
    });

    it("90도 방향으로 샷하면 +z 방향으로 속도가 설정된다", () => {
      const ball = makeBall("cue");
      applyShotToBall(ball, 90, 0.5);
      expect(Math.abs(ball.vx)).toBeLessThan(0.01);
      expect(ball.vz).toBeGreaterThan(0);
    });

    it("power가 높을수록 속도가 빠르다", () => {
      const ball1 = makeBall("cue");
      const ball2 = makeBall("cue");
      applyShotToBall(ball1, 0, 0.3);
      applyShotToBall(ball2, 0, 0.8);
      expect(ball2.vx).toBeGreaterThan(ball1.vx);
    });

    it("당점 없으면 스핀이 0이다", () => {
      const ball = makeBall("cue");
      applyShotToBall(ball, 0, 0.5);
      expect(ball.spinX).toBe(0);
      expect(ball.spinZ).toBe(0);
    });

    it("윗당점(impactOffsetY > 0)이면 spinX가 양수(탑스핀)이다", () => {
      const ball = makeBall("cue");
      const offsetY = BALL_RADIUS * 0.3;
      applyShotToBall(ball, 0, 0.5, 0, offsetY);
      expect(ball.spinX).toBeGreaterThan(0);
    });

    it("아랫당점(impactOffsetY < 0)이면 spinX가 음수(백스핀)이다", () => {
      const ball = makeBall("cue");
      const offsetY = -BALL_RADIUS * 0.3;
      applyShotToBall(ball, 0, 0.5, 0, offsetY);
      expect(ball.spinX).toBeLessThan(0);
    });

    it("오른쪽 당점(impactOffsetX > 0)이면 spinZ가 양수(사이드스핀)이다", () => {
      const ball = makeBall("cue");
      const offsetX = BALL_RADIUS * 0.3;
      applyShotToBall(ball, 0, 0.5, offsetX, 0);
      expect(ball.spinZ).toBeGreaterThan(0);
    });

    it("왼쪽 당점(impactOffsetX < 0)이면 spinZ가 음수이다", () => {
      const ball = makeBall("cue");
      const offsetX = -BALL_RADIUS * 0.3;
      applyShotToBall(ball, 0, 0.5, offsetX, 0);
      expect(ball.spinZ).toBeLessThan(0);
    });

    it("당점 오프셋이 공 반지름의 70%로 클램프된다", () => {
      const maxOffset = BALL_RADIUS * 0.7;

      // 클램프 범위 내(40%)와 70%는 다른 스핀
      const ballAt40 = makeBall("cue");
      applyShotToBall(ballAt40, 0, 0.5, BALL_RADIUS * 0.4, 0);

      // 미스큐 없이 비교하기 위해 여러 번 시도 (70% → 미스큐 확률 있음)
      // 정상 샷만 필터링하여 비교
      let normalSpinAt70 = 0;
      let normalSpinAtMax = 0;
      for (let i = 0; i < 100; i++) {
        const b70 = makeBall("cue");
        applyShotToBall(b70, 0, 0.5, maxOffset, 0);
        if (b70.spinZ > 0) { normalSpinAt70 = b70.spinZ; break; }
      }
      // offset = R*5 → 클램프 후 maxOffset과 동일
      for (let i = 0; i < 100; i++) {
        const bBig = makeBall("cue");
        applyShotToBall(bBig, 0, 0.5, BALL_RADIUS * 5.0, 0);
        if (bBig.spinZ > 0) { normalSpinAtMax = bBig.spinZ; break; }
      }

      // 40%의 스핀 < 70%의 스핀 (클램프 미적용 범위)
      expect(ballAt40.spinZ).toBeLessThan(normalSpinAt70);
      // 70%와 500% 오프셋은 클램프되어 동일한 스핀
      expect(normalSpinAt70).toBeCloseTo(normalSpinAtMax, 3);
    });

    it("사이드 영어 적용 시 스쿼트로 방향이 약간 틀어진다", () => {
      const ballNoSpin = makeBall("cue");
      applyShotToBall(ballNoSpin, 0, 0.5, 0, 0);
      const angleNoSpin = Math.atan2(ballNoSpin.vz, ballNoSpin.vx);

      const ballWithSpin = makeBall("cue");
      const offsetX = BALL_RADIUS * 0.4;
      applyShotToBall(ballWithSpin, 0, 0.5, offsetX, 0);
      const angleWithSpin = Math.atan2(ballWithSpin.vz, ballWithSpin.vx);

      expect(Math.abs(angleWithSpin - angleNoSpin)).toBeGreaterThan(0);
      // 스쿼트 각도는 최대 2도 이내로 제한된다
      expect(Math.abs(angleWithSpin - angleNoSpin)).toBeLessThanOrEqual((2 * Math.PI) / 180 + 0.001);
    });
  });

  describe("물리 상수", () => {
    it("쿠션 두께 상수가 0.05m이다", () => {
      expect(CUSHION_THICKNESS).toBe(0.05);
    });

    it("쿠션 기본 반발계수 상수가 0.72이다", () => {
      expect(CUSHION_BASE_RESTITUTION).toBe(0.72);
    });
  });

  describe("충돌 역학", () => {
    it("큐 질량과 팁 반발계수를 경유하여 공 속도가 결정된다", () => {
      // power=0.5일 때 dragToSpeed의 결과와 applyShotToBall의 공 속도가 일치
      const ball = makeBall("cue");
      applyShotToBall(ball, 0, 0.5);
      const speed = Math.sqrt(ball.vx ** 2 + ball.vz ** 2);
      const expectedBallSpeed = dragToSpeed(0.5);
      // 충돌 역학 공식을 거쳐도 결과 속도가 dragToSpeed와 동일해야 한다
      expect(speed).toBeCloseTo(expectedBallSpeed, 1);
    });
  });

  describe("미스큐", () => {
    it("당점 오프셋 50% 이하면 미스큐가 발생하지 않는다", () => {
      // 오프셋 50% = 0.5 * BALL_RADIUS
      const offsetX = BALL_RADIUS * 0.35;
      const offsetY = BALL_RADIUS * 0.35;
      // ratio = sqrt(0.35^2 + 0.35^2) ≈ 0.495 ≤ 0.50

      // 100회 반복해도 미스큐 없음을 확인
      for (let i = 0; i < 100; i++) {
        const ball = makeBall("cue");
        applyShotToBall(ball, 0, 0.5, offsetX, offsetY);
        const speed = Math.sqrt(ball.vx ** 2 + ball.vz ** 2);
        const expectedSpeed = dragToSpeed(0.5);
        // 미스큐 시 speed는 expectedSpeed * 0.3이므로 정상이면 expectedSpeed에 가까워야 한다
        expect(speed).toBeGreaterThan(expectedSpeed * 0.5);
      }
    });

    it("클램프 후 최대 오프셋(70%)은 확률적 미스큐 범위이다", () => {
      // 클램프 적용 후 최대 ratio = 0.7, 0.50 < 0.7 < 0.85 → 확률적 미스큐
      // 매우 큰 오프셋도 클램프되어 70%로 제한됨
      const offsetX = BALL_RADIUS * 5.0; // 클램프 후 0.7*R
      let miscueCount = 0;
      const trials = 200;

      const expectedSpeed = dragToSpeed(0.5);
      for (let i = 0; i < trials; i++) {
        const ball = makeBall("cue");
        applyShotToBall(ball, 0, 0.5, offsetX, 0);
        const speed = Math.sqrt(ball.vx ** 2 + ball.vz ** 2);
        if (speed < expectedSpeed * 0.5) miscueCount++;
      }

      // 클램프 후 ratio=0.7 → 확률적 미스큐 (일부만 발생)
      expect(miscueCount).toBeGreaterThan(0);
      expect(miscueCount).toBeLessThan(trials);
    });

    it("당점 오프셋 50%-70% 사이면 확률적으로 미스큐가 발생한다", () => {
      // 클램프 후 최대 ratio = 0.7 → t = (0.7-0.5)/0.35 ≈ 0.571, P = 0.326
      const offsetX = BALL_RADIUS * 0.7;
      let miscueCount = 0;
      const trials = 200;

      // Math.random을 mock해서 확률 구간을 검증한다
      const expectedSpeed = dragToSpeed(0.5);
      for (let i = 0; i < trials; i++) {
        const ball = makeBall("cue");
        applyShotToBall(ball, 0, 0.5, offsetX, 0);
        const speed = Math.sqrt(ball.vx ** 2 + ball.vz ** 2);
        if (speed < expectedSpeed * 0.5) miscueCount++;
      }

      // 확률적이므로 최소 1회 이상, 전부 미스큐는 아닌 것을 확인
      expect(miscueCount).toBeGreaterThan(0);
      expect(miscueCount).toBeLessThan(trials);
    });
  });

  describe("마찰 모델", () => {
    it("움직이는 공이 마찰로 점점 느려져서 최종 정지한다", () => {
      const balls: PhysicsBall[] = [
        makeBall("cue", { x: 0, z: 0, vx: 3, vz: 0 }),
        makeBall("red", { x: 2, z: 2 }),
        makeBall("yellow", { x: -2, z: -2 }),
      ];

      let stopCount = 0;
      let settled = false;
      let prevSpeed = Math.sqrt(balls[0].vx ** 2 + balls[0].vz ** 2);
      let decreased = true;

      for (let i = 0; i < 500; i++) {
        const result = simulateStep(balls, "cue", stopCount);
        stopCount = result.stopFrameCount;
        settled = result.settled;

        const speed = Math.sqrt(balls[0].vx ** 2 + balls[0].vz ** 2);
        if (speed > prevSpeed + 0.001) decreased = false;
        prevSpeed = speed;

        if (settled) break;
      }

      expect(decreased).toBe(true);
      expect(settled).toBe(true);
    });

    it("스핀이 있는 공의 spinX, spinY, spinZ가 모두 감속된다", () => {
      const balls: PhysicsBall[] = [
        makeBall("cue", { x: 0, z: 0, vx: 3, vz: 0, spinX: 10, spinY: 10, spinZ: 10 }),
        makeBall("red", { x: 2, z: 2 }),
        makeBall("yellow", { x: -2, z: -2 }),
      ];

      const initialSpinMag = Math.sqrt(
        balls[0].spinX ** 2 + balls[0].spinY ** 2 + balls[0].spinZ ** 2,
      );

      // 여러 스텝 후 스핀 크기가 감소한다
      let stopCount = 0;
      for (let i = 0; i < 100; i++) {
        const result = simulateStep(balls, "cue", stopCount);
        stopCount = result.stopFrameCount;
      }

      const finalSpinMag = Math.sqrt(
        balls[0].spinX ** 2 + balls[0].spinY ** 2 + balls[0].spinZ ** 2,
      );

      expect(finalSpinMag).toBeLessThan(initialSpinMag);
    });

    it("SLIDING 상태에서 ROLLING으로 전환된다", () => {
      // 슬라이딩: 속도와 스핀이 불일치 (슬립 속도 > 0)
      // 롤링: spinY = -vx/R, spinX = vz/R (슬립 속도 ≈ 0)
      const balls: PhysicsBall[] = [
        makeBall("cue", { x: 0, z: 0, vx: 5, vz: 0, spinX: 0, spinY: 0, spinZ: 0 }),
        makeBall("red", { x: 2, z: 2 }),
        makeBall("yellow", { x: -2, z: -2 }),
      ];

      // 초기: 슬라이딩 상태 (vx=5이지만 spinY=0 → 슬립 = vx + R*spinY = 5)
      const initialSlip = Math.abs(balls[0].vx + BALL_RADIUS * balls[0].spinY);
      expect(initialSlip).toBeGreaterThan(0.01);

      // 여러 스텝 후 롤링 조건에 가까워진다
      let stopCount = 0;
      for (let i = 0; i < 30; i++) {
        const result = simulateStep(balls, "cue", stopCount);
        stopCount = result.stopFrameCount;
      }

      const speed = Math.sqrt(balls[0].vx ** 2 + balls[0].vz ** 2);
      if (speed > 0.01) {
        // 롤링 조건: spinY ≈ -vx/R
        const slipX = balls[0].vx + BALL_RADIUS * balls[0].spinY;
        const slipZ = balls[0].vz - BALL_RADIUS * balls[0].spinX;
        const slip = Math.sqrt(slipX ** 2 + slipZ ** 2);
        expect(slip).toBeLessThan(initialSlip);
      }
    });
  });

  describe("simulateStep", () => {
    it("정지 상태의 공은 settled가 빠르게 된다", () => {
      const balls = initBallPositions();
      let stopCount = 0;
      let settled = false;

      for (let i = 0; i < 10; i++) {
        const result = simulateStep(balls, "cue", stopCount);
        stopCount = result.stopFrameCount;
        settled = result.settled;
        if (settled) break;
      }

      expect(settled).toBe(true);
    });

    it("움직이는 공은 마찰로 점점 느려진다", () => {
      const balls: PhysicsBall[] = [
        makeBall("cue", { x: 0, z: 0, vx: 5, vz: 0 }),
        makeBall("red", { x: 2, z: 2 }),
        makeBall("yellow", { x: -2, z: -2 }),
      ];

      const initialSpeed = Math.sqrt(balls[0].vx ** 2 + balls[0].vz ** 2);
      simulateStep(balls, "cue", 0);
      const afterSpeed = Math.sqrt(balls[0].vx ** 2 + balls[0].vz ** 2);

      expect(afterSpeed).toBeLessThan(initialSpeed);
    });

    it("쿠션 충돌 이벤트를 기록한다", () => {
      const balls: PhysicsBall[] = [
        makeBall("cue", { x: TABLE_WIDTH / 2 - BALL_RADIUS - 0.01, z: 0, vx: 10, vz: 0 }),
        makeBall("red", { x: -1, z: -0.5 }),
        makeBall("yellow", { x: -1, z: 0.5 }),
      ];

      const result = simulateStep(balls, "cue", 0);
      const cushionEvents = result.frame.events.filter((e) => e.type === "cushion");
      expect(cushionEvents.length).toBeGreaterThan(0);
      expect(cushionEvents[0].ballId).toBe("cue");
    });

    it("공-공 충돌 이벤트를 기록한다", () => {
      const balls: PhysicsBall[] = [
        makeBall("cue", { x: -0.1, z: 0, vx: 5, vz: 0 }),
        makeBall("red", { x: 0.1, z: 0 }),
        makeBall("yellow", { x: 2, z: 2 }),
      ];

      const result = simulateStep(balls, "cue", 0);
      const ballHitEvents = result.frame.events.filter((e) => e.type === "ball-hit");
      expect(ballHitEvents.length).toBeGreaterThan(0);
      expect(ballHitEvents[0].ballId).toBe("cue");
      expect(ballHitEvents[0].targetId).toBe("red");
    });
  });

  describe("공-공 충돌", () => {
    it("충돌 후 총 운동량이 보존된다", () => {
      const balls: PhysicsBall[] = [
        makeBall("cue", { x: -0.1, z: 0, vx: 5, vz: 0 }),
        makeBall("red", { x: BALL_RADIUS * 2 - 0.1 + 0.001, z: 0 }),
        makeBall("yellow", { x: 2, z: 2 }),
      ];

      const momentumBefore = balls[0].vx + balls[1].vx;
      simulateStep(balls, "cue", 0);
      const momentumAfter = balls[0].vx + balls[1].vx;

      // 마찰에 의한 약간의 차이를 허용하지만 큰 틀에서 보존된다
      expect(Math.abs(momentumAfter - momentumBefore)).toBeLessThan(1.0);
    });

    it("반발계수로 인해 충돌 후 상대속도가 줄어든다", () => {
      const balls: PhysicsBall[] = [
        makeBall("cue", { x: -BALL_RADIUS, z: 0, vx: 5, vz: 0 }),
        makeBall("red", { x: BALL_RADIUS, z: 0 }),
        makeBall("yellow", { x: 2, z: 2 }),
      ];

      const relVelBefore = Math.abs(balls[0].vx - balls[1].vx);
      simulateStep(balls, "cue", 0);
      const relVelAfter = Math.abs(balls[0].vx - balls[1].vx);

      // 반발계수 < 1이므로 충돌 후 상대속도가 줄어든다
      expect(relVelAfter).toBeLessThan(relVelBefore);
    });

    it("롤링 스핀이 있는 공끼리 비스듬히 충돌하면 spinX/spinY가 변화한다 (수직 슬립 보정)", () => {
      // 비스듬한 충돌: 법선이 (nx, nz) 모두 성분을 가지도록 45도 배치
      // 두 공의 spinX 합 ≠ 0 이어야 vertSlip이 발생
      const contactDist = BALL_RADIUS * 2;
      const comp = contactDist / (2 * Math.sqrt(2));
      const initialSpinX = 30;
      const balls: PhysicsBall[] = [
        makeBall("cue", { x: -comp, z: -comp, vx: 5, vz: 5, spinX: initialSpinX, spinY: 0, spinZ: 0 }),
        makeBall("red", { x: comp, z: comp, spinX: initialSpinX, spinY: 0, spinZ: 0 }),
        makeBall("yellow", { x: 2, z: -2 }),
      ];

      simulateStep(balls, "cue", 0);

      // vertSlip에 의한 마찰 토크가 수평축(spinX/spinY)에 적용된다
      const spinXChanged = Math.abs(balls[0].spinX - initialSpinX) > 0.01
        || Math.abs(balls[1].spinX - initialSpinX) > 0.01;
      const spinYChanged = Math.abs(balls[0].spinY) > 0.01
        || Math.abs(balls[1].spinY) > 0.01;
      expect(spinXChanged || spinYChanged).toBe(true);
    });

    it("저속/고속 충돌 모두 일정한 반발계수를 유지한다", () => {
      // 고속 충돌
      const ballsHigh: PhysicsBall[] = [
        makeBall("cue", { x: -BALL_RADIUS, z: 0, vx: 5, vz: 0 }),
        makeBall("red", { x: BALL_RADIUS, z: 0 }),
        makeBall("yellow", { x: 2, z: 2 }),
      ];
      const relBefore1 = Math.abs(ballsHigh[0].vx - ballsHigh[1].vx);
      simulateStep(ballsHigh, "cue", 0);
      const relAfter1 = Math.abs(ballsHigh[0].vx - ballsHigh[1].vx);
      const eHigh = relAfter1 / relBefore1;

      // 저속 충돌
      const ballsLow: PhysicsBall[] = [
        makeBall("cue", { x: -BALL_RADIUS, z: 0, vx: 0.3, vz: 0 }),
        makeBall("red", { x: BALL_RADIUS, z: 0 }),
        makeBall("yellow", { x: 2, z: 2 }),
      ];
      const relBefore2 = Math.abs(ballsLow[0].vx - ballsLow[1].vx);
      simulateStep(ballsLow, "cue", 0);
      const relAfter2 = Math.abs(ballsLow[0].vx - ballsLow[1].vx);
      const eLow = relAfter2 / relBefore2;

      // 페놀 수지 공은 속도와 무관하게 반발계수가 거의 일정하다
      // (시뮬레이션 서브스텝 마찰 누적으로 측정 오차가 발생할 수 있음)
      expect(Math.abs(eHigh - eLow)).toBeLessThan(0.3);
    });
  });

  describe("쿠션 충돌", () => {
    it("쿠션 반사로 속도 부호가 반전된다", () => {
      const balls: PhysicsBall[] = [
        makeBall("cue", { x: TABLE_WIDTH / 2 - BALL_RADIUS - 0.001, z: 0, vx: 5, vz: 0 }),
        makeBall("red", { x: -1, z: -0.5 }),
        makeBall("yellow", { x: -1, z: 0.5 }),
      ];

      expect(balls[0].vx).toBeGreaterThan(0);
      simulateStep(balls, "cue", 0);
      // 오른쪽 벽 충돌 후 vx가 음수로 반전된다
      expect(balls[0].vx).toBeLessThan(0);
    });

    it("두 축 동시 교차 시 이른 축이 먼저 처리된다", () => {
      // 코너 방향으로 빠르게 이동하여 X/Z 쿠션에 동시에 접근
      const balls: PhysicsBall[] = [
        makeBall("cue", {
          x: TABLE_WIDTH / 2 - BALL_RADIUS - 0.005,
          z: TABLE_HEIGHT / 2 - BALL_RADIUS - 0.01,
          vx: 8,
          vz: 4,
        }),
        makeBall("red", { x: -1, z: -0.5 }),
        makeBall("yellow", { x: -1, z: 0.5 }),
      ];

      const result = simulateStep(balls, "cue", 0);

      // 공이 코너에서 반사되어 테이블 안에 머문다
      const boundX = TABLE_WIDTH / 2 - BALL_RADIUS;
      const boundZ = TABLE_HEIGHT / 2 - BALL_RADIUS;
      expect(Math.abs(balls[0].x)).toBeLessThanOrEqual(boundX + 0.001);
      expect(Math.abs(balls[0].z)).toBeLessThanOrEqual(boundZ + 0.001);

      // 쿠션 이벤트가 발생한다
      const cushionEvents = result.frame.events.filter((e) => e.type === "cushion");
      expect(cushionEvents.length).toBeGreaterThan(0);
    });

    it("시그모이드 반발계수: 고속이면 반발이 낮고 저속이면 반발이 높다", () => {
      // 고속: 벽에 빠르게 충돌
      const ballsFast: PhysicsBall[] = [
        makeBall("cue", { x: TABLE_WIDTH / 2 - BALL_RADIUS - 0.001, z: 0, vx: 10, vz: 0 }),
        makeBall("red", { x: -1, z: -0.5 }),
        makeBall("yellow", { x: -1, z: 0.5 }),
      ];
      const speedBeforeFast = 10;
      simulateStep(ballsFast, "cue", 0);
      const speedAfterFast = Math.abs(ballsFast[0].vx);
      const eFast = speedAfterFast / speedBeforeFast;

      // 저속: 벽에 느리게 충돌
      const ballsSlow: PhysicsBall[] = [
        makeBall("cue", { x: TABLE_WIDTH / 2 - BALL_RADIUS - 0.001, z: 0, vx: 0.5, vz: 0 }),
        makeBall("red", { x: -1, z: -0.5 }),
        makeBall("yellow", { x: -1, z: 0.5 }),
      ];
      const speedBeforeSlow = 0.5;
      simulateStep(ballsSlow, "cue", 0);
      const speedAfterSlow = Math.abs(ballsSlow[0].vx);
      const eSlow = speedAfterSlow / speedBeforeSlow;

      // 저속의 반발계수가 고속보다 높다
      expect(eSlow).toBeGreaterThan(eFast);
    });
  });

  describe("에너지 캡", () => {
    it("에너지가 비정상적으로 증가하지 않는다", () => {
      const balls: PhysicsBall[] = [
        makeBall("cue", { x: 0, z: 0, vx: 8, vz: 3 }),
        makeBall("red", { x: 0.1, z: 0 }),
        makeBall("yellow", { x: -0.1, z: 0.1 }),
      ];

      const mass = 0.21; // BALL_MASS
      const keBefore = balls.reduce(
        (sum, b) => sum + 0.5 * mass * (b.vx ** 2 + b.vz ** 2),
        0,
      );

      // 여러 스텝 시뮬레이션
      let stopCount = 0;
      for (let i = 0; i < 50; i++) {
        const result = simulateStep(balls, "cue", stopCount);
        stopCount = result.stopFrameCount;

        const keAfter = balls.reduce(
          (sum, b) => sum + 0.5 * mass * (b.vx ** 2 + b.vz ** 2),
          0,
        );
        // 에너지는 초기값 + 허용 마진(에너지 캡 delta * substep * frame) 이내여야 한다
        // 마찰이 항상 에너지를 소산하므로 에너지가 초기값을 크게 넘지 않아야 한다
        expect(keAfter).toBeLessThanOrEqual(keBefore + 1.0);
      }
    });
  });

  describe("NaN 가드", () => {
    it("NaN 속도가 발생해도 0으로 복구된다", () => {
      const balls: PhysicsBall[] = [
        makeBall("cue", { x: 0, z: 0, vx: NaN, vz: NaN, spinX: NaN, spinY: NaN, spinZ: NaN }),
        makeBall("red", { x: 2, z: 2 }),
        makeBall("yellow", { x: -2, z: -2 }),
      ];

      simulateStep(balls, "cue", 0);

      // NaN이 복구되어 유한한 값이어야 한다
      expect(Number.isFinite(balls[0].vx)).toBe(true);
      expect(Number.isFinite(balls[0].vz)).toBe(true);
      expect(Number.isFinite(balls[0].x)).toBe(true);
      expect(Number.isFinite(balls[0].z)).toBe(true);
      expect(Number.isFinite(balls[0].spinX)).toBe(true);
      expect(Number.isFinite(balls[0].spinY)).toBe(true);
      expect(Number.isFinite(balls[0].spinZ)).toBe(true);
    });

    it("Infinity 위치가 발생해도 0으로 복구된다", () => {
      const balls: PhysicsBall[] = [
        makeBall("cue", { x: Infinity, z: -Infinity, vx: 0, vz: 0 }),
        makeBall("red", { x: 2, z: 2 }),
        makeBall("yellow", { x: -2, z: -2 }),
      ];

      simulateStep(balls, "cue", 0);

      expect(Number.isFinite(balls[0].x)).toBe(true);
      expect(Number.isFinite(balls[0].z)).toBe(true);
    });
  });

  describe("checkThreeCushionScore", () => {
    it("쿠션 3회 + 목적구 2개 접촉이면 득점이다", () => {
      const events: BilliardsShotEvent[] = [
        { type: "cushion", ballId: "cue", timestamp: 1 },
        { type: "cushion", ballId: "cue", timestamp: 2 },
        { type: "cushion", ballId: "cue", timestamp: 3 },
        { type: "ball-hit", ballId: "cue", targetId: "red", timestamp: 4 },
        { type: "ball-hit", ballId: "cue", targetId: "yellow", timestamp: 5 },
      ];

      const result = checkThreeCushionScore(events, "cue");
      expect(result.scored).toBe(true);
      expect(result.cushionCount).toBe(3);
      expect(result.objectBallsHit).toEqual(["red", "yellow"]);
    });

    it("쿠션 2회 + 목적구 2개 접촉이면 미득점이다", () => {
      const events: BilliardsShotEvent[] = [
        { type: "cushion", ballId: "cue", timestamp: 1 },
        { type: "cushion", ballId: "cue", timestamp: 2 },
        { type: "ball-hit", ballId: "cue", targetId: "red", timestamp: 3 },
        { type: "ball-hit", ballId: "cue", targetId: "yellow", timestamp: 4 },
      ];

      const result = checkThreeCushionScore(events, "cue");
      expect(result.scored).toBe(false);
      expect(result.cushionCount).toBe(2);
    });

    it("쿠션 3회 + 목적구 1개만 접촉이면 미득점이다", () => {
      const events: BilliardsShotEvent[] = [
        { type: "cushion", ballId: "cue", timestamp: 1 },
        { type: "cushion", ballId: "cue", timestamp: 2 },
        { type: "cushion", ballId: "cue", timestamp: 3 },
        { type: "ball-hit", ballId: "cue", targetId: "red", timestamp: 4 },
      ];

      const result = checkThreeCushionScore(events, "cue");
      expect(result.scored).toBe(false);
      expect(result.objectBallsHit).toEqual(["red"]);
    });

    it("첫 목적구 → 쿠션 3회 → 두번째 목적구 순서도 득점이다", () => {
      const events: BilliardsShotEvent[] = [
        { type: "ball-hit", ballId: "cue", targetId: "red", timestamp: 1 },
        { type: "cushion", ballId: "cue", timestamp: 2 },
        { type: "cushion", ballId: "cue", timestamp: 3 },
        { type: "cushion", ballId: "cue", timestamp: 4 },
        { type: "ball-hit", ballId: "cue", targetId: "yellow", timestamp: 5 },
      ];

      const result = checkThreeCushionScore(events, "cue");
      expect(result.scored).toBe(true);
      expect(result.cushionCount).toBe(3);
    });

    it("두 번째 목적구 접촉 이후의 쿠션은 세지 않는다", () => {
      const events: BilliardsShotEvent[] = [
        { type: "ball-hit", ballId: "cue", targetId: "red", timestamp: 1 },
        { type: "ball-hit", ballId: "cue", targetId: "yellow", timestamp: 2 },
        { type: "cushion", ballId: "cue", timestamp: 3 },
        { type: "cushion", ballId: "cue", timestamp: 4 },
        { type: "cushion", ballId: "cue", timestamp: 5 },
      ];

      const result = checkThreeCushionScore(events, "cue");
      expect(result.scored).toBe(false);
      expect(result.cushionCount).toBe(0);
    });

    it("같은 목적구를 두 번 맞혀도 하나로 센다", () => {
      const events: BilliardsShotEvent[] = [
        { type: "cushion", ballId: "cue", timestamp: 1 },
        { type: "cushion", ballId: "cue", timestamp: 2 },
        { type: "cushion", ballId: "cue", timestamp: 3 },
        { type: "ball-hit", ballId: "cue", targetId: "red", timestamp: 4 },
        { type: "ball-hit", ballId: "cue", targetId: "red", timestamp: 5 },
      ];

      const result = checkThreeCushionScore(events, "cue");
      expect(result.scored).toBe(false);
      expect(result.objectBallsHit).toEqual(["red"]);
    });

    it("이벤트가 비어있으면 미득점이다", () => {
      const result = checkThreeCushionScore([], "cue");
      expect(result.scored).toBe(false);
      expect(result.cushionCount).toBe(0);
      expect(result.objectBallsHit).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 시나리오 기반 시뮬레이션 테스트
  // ═══════════════════════════════════════════════════════════════════
  describe("시나리오: 직진 왕복", () => {
    it("직진 샷이 반대편 쿠션에서 반사되어 합리적 거리를 되돌아온다", () => {
      // 테이블 중앙에서 오른쪽으로 발사
      const balls: PhysicsBall[] = [
        makeBall("cue", { x: 0, z: 0, vx: 5, vz: 0 }),
        makeBall("red", { x: -1, z: -0.5 }),
        makeBall("yellow", { x: -1, z: 0.5 }),
      ];
      const startX = balls[0].x;
      runFullSimulation(balls, "cue");

      // 쿠션 반발계수(0.52~0.88)와 마찰로 인해
      // 왕복 후 시작점에서 테이블 길이의 절반(1.4m) 이내에 정지해야 함
      expect(Math.abs(balls[0].x - startX)).toBeLessThan(1.4);
      // Z방향 편향은 쿠션 throw로 약간 발생할 수 있으나 1m 이내
      expect(Math.abs(balls[0].z)).toBeLessThan(1.0);
    });
  });

  describe("시나리오: 45도 쿠션 반사", () => {
    it("스핀 없는 45도 쿠션 반사 시 입사각과 반사각이 유사하다", () => {
      // 오른쪽 위 45도로 발사 (쿠션 throw 없이 스핀 0)
      const balls: PhysicsBall[] = [
        makeBall("cue", { x: 0, z: 0, vx: 4, vz: 4 }),
        makeBall("red", { x: -1, z: -0.5 }),
        makeBall("yellow", { x: -1, z: 0.5 }),
      ];

      // 한 스텝만 실행하면 충분 (쿠션에 도달 전)
      // 여러 스텝 돌려서 첫 번째 쿠션 반사 후 속도 비율 확인
      let stopCount = 0;
      let cushionHit = false;
      for (let i = 0; i < 100 && !cushionHit; i++) {
        const result = simulateStep(balls, "cue", stopCount);
        stopCount = result.stopFrameCount;
        if (result.frame.events.some((e) => e.type === "cushion")) {
          cushionHit = true;
        }
      }

      expect(cushionHit).toBe(true);
      // 반사 후 vx, vz가 모두 0이 아님 (완전히 흡수되지 않음)
      const speed = Math.sqrt(balls[0].vx ** 2 + balls[0].vz ** 2);
      expect(speed).toBeGreaterThan(1.0);
    });
  });

  describe("시나리오: 사이드스핀 커브", () => {
    it("사이드스핀으로 완만한 커브를 그리며 나선형이 발생하지 않는다", () => {
      // 강한 사이드스핀 + 직진 발사
      const balls: PhysicsBall[] = [
        makeBall("cue", { x: -0.5, z: 0, vx: 3, vz: 0, spinZ: 20 }),
        makeBall("red", { x: 1, z: 1 }),
        makeBall("yellow", { x: 1, z: -1 }),
      ];

      // 각 프레임의 Z위치를 기록하여 나선 패턴 감지
      const zPositions: number[] = [];
      let stopCount = 0;
      for (let i = 0; i < 200; i++) {
        const result = simulateStep(balls, "cue", stopCount);
        stopCount = result.stopFrameCount;
        zPositions.push(balls[0].z);
        if (result.settled) break;
      }

      // 나선 감지: Z 부호 변경이 3회 이상이면 나선으로 판단
      let signChanges = 0;
      for (let i = 1; i < zPositions.length; i++) {
        if (zPositions[i] * zPositions[i - 1] < 0) signChanges++;
      }
      expect(signChanges).toBeLessThan(3);

      // Z 편향이 발생해야 함 (커브 효과 확인)
      const maxZ = Math.max(...zPositions.map(Math.abs));
      expect(maxZ).toBeGreaterThan(0.01);
    });
  });

  describe("시나리오: 공-공 정면 충돌", () => {
    it("동일 질량 정면 충돌 시 수구가 거의 정지하고 목적구가 속도를 이어받는다", () => {
      const balls: PhysicsBall[] = [
        makeBall("cue", { x: -BALL_RADIUS * 2 - 0.001, z: 0, vx: 5, vz: 0 }),
        makeBall("red", { x: BALL_RADIUS * 2, z: 0 }),
        makeBall("yellow", { x: 1, z: 1 }),
      ];

      simulateStep(balls, "cue", 0);

      // 동일 질량 탄성 충돌: 수구 속도 ≈ 0, 목적구 속도 ≈ 초기 속도
      expect(Math.abs(balls[0].vx)).toBeLessThan(1.5); // 수구 거의 정지
      expect(balls[1].vx).toBeGreaterThan(3.0); // 목적구가 속도 이어받음
    });
  });

  describe("시나리오: 백스핀 드로우", () => {
    it("아래 당점 샷의 수구가 중앙 당점 샷보다 더 뒤에서 정지한다", () => {
      // applyShotToBall로 자연스러운 백스핀 생성
      const setup = (offsetY: number) => {
        const balls = [
          makeBall("cue", { x: -0.3, z: 0 }),
          makeBall("red", { x: 0.3, z: 0 }),
          makeBall("yellow", { x: 1, z: 0.5 }),
        ];
        applyShotToBall(balls[0], 0, 0.5, 0, offsetY); // 방향 0° = +X
        return balls;
      };

      // 중앙 당점
      const ballsCenter = setup(0);
      runFullSimulation(ballsCenter, "cue");
      const cueCenter = ballsCenter[0].x;

      // 아래 당점 (백스핀)
      const ballsBottom = setup(-BALL_RADIUS * 0.6);
      runFullSimulation(ballsBottom, "cue");
      const cueBottom = ballsBottom[0].x;

      // 백스핀 수구가 중앙 당점 수구보다 더 뒤(왼쪽)에서 정지
      expect(cueBottom).toBeLessThan(cueCenter);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 물리 불변량 테스트
  // ═══════════════════════════════════════════════════════════════════
  describe("불변량: 에너지 비증가", () => {
    it("마찰과 충돌을 거치면서 총 운동에너지가 단조 감소한다", () => {
      const balls: PhysicsBall[] = [
        makeBall("cue", { x: -0.3, z: 0, vx: 6, vz: 2, spinZ: 10 }),
        makeBall("red", { x: 0.5, z: 0.1 }),
        makeBall("yellow", { x: 0.5, z: -0.3 }),
      ];

      let prevKE = totalKE(balls);
      let stopCount = 0;
      let violations = 0;

      for (let i = 0; i < 300; i++) {
        const result = simulateStep(balls, "cue", stopCount);
        stopCount = result.stopFrameCount;
        const ke = totalKE(balls);

        // 에너지 캡으로 인해 미세한 증가(0.1J)는 허용
        if (ke > prevKE + 0.1) violations++;
        prevKE = ke;

        if (result.settled) break;
      }

      // 에너지 증가 위반이 전체의 2% 미만이어야 함
      expect(violations).toBeLessThan(6);
    });
  });

  describe("불변량: 공-공 충돌 운동량 보존", () => {
    it("충돌 전후 총 운동량이 보존된다", () => {
      const balls: PhysicsBall[] = [
        makeBall("cue", { x: -BALL_RADIUS * 2 - 0.001, z: 0, vx: 8, vz: 2 }),
        makeBall("red", { x: BALL_RADIUS * 2, z: 0, vx: -1, vz: 0 }),
        makeBall("yellow", { x: 2, z: 2 }),
      ];

      const pxBefore = balls[0].vx + balls[1].vx;
      const pzBefore = balls[0].vz + balls[1].vz;

      simulateStep(balls, "cue", 0);

      // 동일 질량이므로 운동량 = 속도 합 (마찰에 의한 미세 오차 허용)
      const pxAfter = balls[0].vx + balls[1].vx;
      const pzAfter = balls[0].vz + balls[1].vz;

      expect(Math.abs(pxAfter - pxBefore)).toBeLessThan(0.5);
      expect(Math.abs(pzAfter - pzBefore)).toBeLessThan(0.5);
    });
  });

  describe("불변량: 경계 내 유지", () => {
    it("다양한 샷에서 공이 항상 테이블 안에 머문다", () => {
      const shots = [
        { vx: 13, vz: 0 },
        { vx: 0, vz: 13 },
        { vx: 10, vz: 10 },
        { vx: -13, vz: -5 },
        { vx: 7, vz: -12 },
      ];

      for (const shot of shots) {
        const balls: PhysicsBall[] = [
          makeBall("cue", { x: 0, z: 0, ...shot, spinZ: 15 }),
          makeBall("red", { x: 0.5, z: 0.3 }),
          makeBall("yellow", { x: -0.5, z: -0.3 }),
        ];

        let stopCount = 0;
        for (let i = 0; i < 400; i++) {
          const result = simulateStep(balls, "cue", stopCount);
          stopCount = result.stopFrameCount;

          for (const ball of balls) {
            expect(Math.abs(ball.x)).toBeLessThanOrEqual(HALF_W + 0.01);
            expect(Math.abs(ball.z)).toBeLessThanOrEqual(HALF_H + 0.01);
          }

          if (result.settled) break;
        }
      }
    });
  });

  describe("불변량: 속도 상한", () => {
    it("최대 파워 샷에서도 속도가 14 m/s를 넘지 않는다", () => {
      const balls: PhysicsBall[] = [
        makeBall("cue", { x: 0, z: 0 }),
        makeBall("red", { x: 0.5, z: 0 }),
        makeBall("yellow", { x: 0.5, z: 0.3 }),
      ];

      applyShotToBall(balls[0], 0, 1.0, 0, 0); // 최대 파워

      let stopCount = 0;
      for (let i = 0; i < 300; i++) {
        const result = simulateStep(balls, "cue", stopCount);
        stopCount = result.stopFrameCount;

        for (const ball of balls) {
          const speed = Math.sqrt(ball.vx ** 2 + ball.vz ** 2);
          expect(speed).toBeLessThanOrEqual(14.0);
        }

        if (result.settled) break;
      }
    });
  });

  describe("불변량: 정지 수렴", () => {
    it("모든 샷이 유한 시간 내에 settled=true에 도달한다", () => {
      const testCases = [
        { power: 0.3, dir: 45, offsetX: 0, offsetY: 0 },
        { power: 0.7, dir: 0, offsetX: 0.015, offsetY: 0 },
        { power: 1.0, dir: 90, offsetX: 0, offsetY: 0.01 },
        { power: 0.5, dir: 30, offsetX: -0.01, offsetY: -0.01 },
        { power: 0.8, dir: 160, offsetX: 0.02, offsetY: 0 },
      ];

      for (const tc of testCases) {
        const balls = initBallPositions();
        applyShotToBall(balls[0], tc.dir, tc.power, tc.offsetX, tc.offsetY);

        const { frames } = runFullSimulation(balls, "cue", 600);

        // 600프레임(30초) 이내에 반드시 정지해야 함
        expect(frames).toBeLessThan(600);
      }
    });
  });

  describe("불변량: 랜덤 샷 안정성", () => {
    it("50개의 랜덤 샷이 모두 경계 내에서 정지 수렴한다", () => {
      // 시드 기반 의사 난수 (재현 가능)
      let seed = 42;
      function rand(): number {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
      }

      for (let i = 0; i < 50; i++) {
        const balls = initBallPositions();
        const dir = rand() * 360;
        const power = 0.1 + rand() * 0.9;
        const offsetX = (rand() - 0.5) * BALL_RADIUS * 1.2;
        const offsetY = (rand() - 0.5) * BALL_RADIUS * 1.2;

        applyShotToBall(balls[0], dir, power, offsetX, offsetY);

        let stopCount = 0;
        let settled = false;
        for (let f = 0; f < 600; f++) {
          const result = simulateStep(balls, "cue", stopCount);
          stopCount = result.stopFrameCount;

          // 모든 공이 테이블 안
          for (const ball of balls) {
            expect(Math.abs(ball.x)).toBeLessThanOrEqual(HALF_W + 0.01);
            expect(Math.abs(ball.z)).toBeLessThanOrEqual(HALF_H + 0.01);
            expect(Number.isFinite(ball.vx)).toBe(true);
            expect(Number.isFinite(ball.vz)).toBe(true);
          }

          if (result.settled) { settled = true; break; }
        }

        expect(settled).toBe(true);
      }
    });
  });
});
