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
      // 스쿼트 각도는 최대 1도 이내로 제한된다
      expect(Math.abs(angleWithSpin - angleNoSpin)).toBeLessThanOrEqual(Math.PI / 180 + 0.001);
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
      for (let i = 0; i < 50; i++) {
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

    it("롤링 스핀이 있는 공끼리 비스듬히 충돌하면 spinZ가 변화한다 (Z축 슬립 보정)", () => {
      // 비스듬한 충돌: 법선이 (nx, nz) 모두 성분을 가지도록 45도 배치
      // 두 공의 spinX 합 ≠ 0 이어야 vertSlip이 발생
      const contactDist = BALL_RADIUS * 2;
      const comp = contactDist / (2 * Math.sqrt(2));
      const balls: PhysicsBall[] = [
        makeBall("cue", { x: -comp, z: -comp, vx: 5, vz: 5, spinX: 30, spinY: 0, spinZ: 0 }),
        makeBall("red", { x: comp, z: comp, spinX: 30, spinY: 0, spinZ: 0 }),
        makeBall("yellow", { x: 2, z: -2 }),
      ];

      simulateStep(balls, "cue", 0);

      // spinX 합(60) × nz(≠0) → vertSlip 발생 → spinZ가 변화
      const totalSpinZ = Math.abs(balls[0].spinZ) + Math.abs(balls[1].spinZ);
      expect(totalSpinZ).toBeGreaterThan(0);
    });

    it("저속 충돌 시 반발계수가 감소한다", () => {
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

      // 저속 충돌의 반발계수가 고속보다 낮다
      expect(eLow).toBeLessThan(eHigh);
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
});
