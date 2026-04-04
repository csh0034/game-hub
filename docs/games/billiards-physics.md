# 3쿠션 당구 물리엔진

게임 허브에 구현된 서버 권위 물리엔진의 명세이다.

## 물리 상수 및 파라미터

### 테이블 지오메트리

| 항목 | 값 | 단위 |
|------|------|------|
| 테이블 내경 가로 | 2.844 | m |
| 테이블 내경 세로 | 1.422 | m |
| 공 지름 | 0.0615 | m |
| 공 반지름 | 0.03075 | m |
| 쿠션 높이 | 0.037 | m |
| 쿠션 두께 | 0.05 | m |

### 핵심 물리 상수

| 항목 | 값 | 설명 |
|------|------|------|
| 공 질량 | 0.21 kg | |
| 공-공 반발계수 | 0.95 | |
| 쿠션 기본 반발계수 | 0.72 | |
| 슬라이딩 마찰계수 | 0.2 | |
| 롤링 마찰계수 | 0.018 | |
| 중력가속도 | 9.81 m/s² | |
| 쿠션 접촉 마찰 | 0.14 | |
| 쿠션 기준 속도 | 5.9577 m/s | throw 계산용 |
| 쿠션 접촉 시간 지수 | 0.7 | |
| 쿠션 토크 댐핑 | 0.35 | |
| 쿠션 최대 스핀 | 3.0 rad/s | throw 계산용 |
| 쿠션 최대 throw 각도 | 25° | |
| 쿠션 반발계수(저속) | 0.88 | 시그모이드 하한 |
| 쿠션 반발계수(고속) | 0.65 | 시그모이드 상한 |
| 쿠션 시그모이드 중간속도 | 2.0 m/s | |
| 쿠션 시그모이드 경사 | 1.5 | |
| 공-공 접촉 마찰 | 0.05 | 스핀 전달용 |
| 사이드스핀 커브 계수 | 0.003 | swerve 효과 |
| 최대 공 속도 | 13.89 m/s | 약 50 km/h |
| 샷 종료 판정 속도 | 0.02 m/s | |

### 시뮬레이션 타임스텝

| 항목 | 값 |
|------|------|
| 브로드캐스트 간격 | 50 ms |
| 서브스텝 수 | 12 |
| 서브스텝 dt | 약 4.167 ms |

## 스핀 축 규약

| 축 | 의미 |
|------|------|
| spinX | Y방향 롤링 (vy와 결합) |
| spinY | X방향 롤링 (vx와 결합) |
| spinZ | 수직축 스핀 (사이드 영어) → 커브에 기여 |

## 마찰력 및 감속 모델

공이 테이블 위를 이동할 때 4단계 상태 머신으로 마찰 처리를 수행한다.

### 상태 정의

| 상태 | 조건 |
|------|------|
| STATIONARY | 선속도 ≤ 0.01 m/s 이고 각속도 ≤ 0.2 rad/s |
| SPINNING | 선속도 ≤ 0.01 m/s, 각속도 > 0.2 rad/s |
| SLIDING | 슬립 속도 > 0.01 m/s |
| ROLLING | 그 외 |

### 슬립 속도 계산

공이 테이블 위에서 미끄러지는 정도를 슬립 벡터로 정의한다.

```
vSlipX = vx + radius × spinY
vSlipY = vy - radius × spinX
vSlip  = √(vSlipX² + vSlipY²)
```

순수 롤링 조건에서는 vSlip = 0 (접지점 상대속도 = 0)이다.

### SLIDING 상태 — 마찰 적분

```
linearDelta  = μₛ × g × dt
angularDelta = (5 × μₛ × g) / (2 × radius) × dt

vx   -= linearDelta × slipDirX
vy   -= linearDelta × slipDirY
spinY -= angularDelta × slipDirX
spinX += angularDelta × slipDirY
```

이 스텝 내에서 슬립이 완전히 소멸하면, 정확한 전환 시각 t*를 구해 중간에 롤링 조건으로 스냅한다.

```
t* = vSlip / totalSlipDecrease
```

t* 이후 롤링 스냅 공식 (선운동량과 각운동량 보존, 이론값 5/7):

```
vxRoll = (5×vx - 2×radius×spinY) / 7
vyRoll = (5×vy + 2×radius×spinX) / 7
spinY_roll = -vx / radius
spinX_roll =  vy / radius
```

### ROLLING 상태 — 감속

```
speedAfter = max(0, speed - μᵣ × g × dt)
vx *= speedAfter / speed
vy *= speedAfter / speed
spinY = -vx / radius    (롤링 조건 유지)
spinX =  vy / radius
```

### 사이드스핀(spinZ) 감속

```
μ_spin = 0.02
spinZDecel = (5 × μ_spin × g) / (2 × radius)
spinZ -= sign(spinZ) × spinZDecel × dt
```

### Swerve (사이드스핀 커브 효과)

슬라이딩 또는 롤링 중 spinZ가 있을 때 진행 방향과 수직으로 작은 가속도가 발생한다 (Magnus 효과 근사).

```
kSwerve = 0.0008
swerveDvx = kSwerve × spinZ × (-vy / speed) × dt
swerveDvy = kSwerve × spinZ × (vx / speed) × dt
```

## 큐 타격 물리

### 초기 속도

충돌 역학(충격량) 공식으로 타격 후 공의 초기 속도를 계산한다.

```
V_ball = [M_cue × (1 + e_tip) / (M_cue + M_ball)] × V_cue
```

| 파라미터 | 값 |
|------|------|
| 큐 질량 | 0.5 kg |
| 공 질량 | 0.21 kg |
| 큐팁 반발계수 | 0.7 |

드래그 입력에서 목표 볼 속도로의 선형 매핑:

```
드래그 범위: 10 ~ 400 px
속도 범위:   1.0 ~ 13.89 m/s
ratio = (dragPx - 10) / (400 - 10)
targetSpeed = 1.0 + ratio × 12.89
```

### 초기 각속도

당점(impactOffsetX, impactOffsetY)에서 발생하는 스핀을 강체 충격량 이론으로 계산한다.

```
THEORETICAL_SPIN_SCALE = 5.0    (강체 완전탄성 접촉의 이론값)
SPIN_TRANSFER_EFFICIENCY = 0.7  (큐팁 변형/슬립 손실 효율)
initialSpinScale = 5.0 × 0.7 = 3.5

omegaX = (3.5 × V_ball × impactOffsetY) / (2 × R²)
omegaZ = (3.5 × V_ball × impactOffsetX) / (2 × R²)
```

당점 위치에 따른 스핀 효과:

- impactOffsetX > 0 → 오른쪽 영어 → 반시계 수직스핀(spinZ 증가)
- impactOffsetY > 0 → 윗 당점 → 탑스핀(spinX 증가)
- impactOffsetY < 0 → 아래 당점 → 백스핀(spinX 감소)

큐 앙각(3도)에 의한 추가 롤링스핀:

```
CUE_ELEVATION_RAD = 3° × (π/180)
omegaY = omegaZ × sin(3°)
```

최대 당점 오프셋: 공 반지름의 70% = 0.021525 m

### 미스큐 판정

```
ratio = √(offsetX² + offsetY²) / ballRadius

ratio ≤ 0.50 → 미스큐 없음
ratio ≥ 0.85 → 확실한 미스큐
0.50 < ratio < 0.85 → 확률적 미스큐:  P = t²,  t = (ratio - 0.5) / 0.35
```

### 스쿼트 효과

사이드 영어 적용 시 공이 당점 반대 방향으로 약간 틀어지는 물리 현상이다.

```
squirtCoefficient = 0.018
maxSquirtAngleDeg = 1°
normalizedOffset = clamp(impactOffsetX / ballRadius, -1, 1)
squirtAngleRad = clamp(normalizedOffset × 0.018, -π/180, π/180)
```

## 공-공 충돌

### 충돌 감지 (CCD)

Continuous Collision Detection으로 이전 위치에서 현재 위치로 선형 보간하며 접촉 시각을 2차 방정식으로 풀어 구한다.

```
a × t² + b × t + c = 0
  a = ‖(endX - startX)‖²
  b = 2 × (startX × moveX + startY × moveY)
  c = ‖(startX, startY)‖² - (2R)²

판별식 = b² - 4ac
t = (-b - √판별식) / (2a)
```

t가 0~1 범위 내이면 해당 서브스텝에서 충돌이 발생한다. t 시점으로 위치를 되감고 충돌 처리 후 나머지 시간 동안 전진한다.

### 법선 방향 충격량 (탄성 충돌)

```
vRel_n = 상대속도 · 법선벡터    (법선 방향 접근 속도)
invMassSum = 1/m1 + 1/m2
impulseN = -(1 + e) × vRel_n / invMassSum    (e = 0.95)

v1 -= (impulseN / m1) × n̂
v2 += (impulseN / m2) × n̂
```

### 접선 방향 충격량 (스핀 전달, Coulomb 마찰)

접촉 마찰(μ = 0.05)로 스핀 전달을 처리한다.

```
tangentRelVel = (relV · t̂) + R × (spinZ1 + spinZ2)
tangentEffMass = invMassSum + 2R² / I
impulseTRaw = -tangentRelVel / tangentEffMass
impulseT = clamp(impulseTRaw, -μ×impulseN, μ×impulseN)

spinDelta = (-5 × impulseT) / (2 × m × R)
spinZ1 += spinDelta
spinZ2 -= spinDelta
```

spinX/spinY에서 발생하는 Z축 슬립 보정도 추가로 수행한다.

### 저속 반발계수 보정

저속 충돌이 과도하게 탄성적으로 느껴지지 않도록 반발계수를 감쇠한다.

```
lowSpeedBand = 0.9 m/s
lowSpeedFactor = clamp((0.9 - approachSpeed) / 0.9, 0, 1)
e_eff = clamp(e_base × (1 - 0.2 × lowSpeedFactor), 0.05, 0.999)
```

### 위치 보정 (관통 방지)

```
slop = 1e-4 m
percent = 0.9
maxCorrectionPerBall = R × 0.45

correction = min(
  (max(0, penetration - slop) / 2) × percent,
  maxCorrectionPerBall
)
```

## 공-쿠션 충돌

### 속도 의존 반발계수 (시그모이드 모델)

실제 쿠션 고무는 고속 충돌 시 에너지를 더 많이 흡수한다. 이를 시그모이드 함수로 모델링한다.

```
e_low  = 0.88   (저속 한계)
e_high = 0.65   (고속 한계)
v_mid  = 2.0 m/s
k      = 1.5    (경사도)

t = 1 / (1 + exp(-k × (|vn| - v_mid)))
e(|vn|) = e_low + (e_high - e_low) × t
```

스핀에 의한 추가 보정:

```
longitudinalRatio = clamp(spinRolling / maxSpinMagnitude, -1, 1)
restitutionBoost = clamp(-sign(vn) × longitudinalRatio × 0.06, -0.06, 0.06)
e_eff = clamp(e_base × (1 + restitutionBoost), 0.05, 0.98)
```

### Sweep 기반 충돌 감지

이전 프레임에서 경계 안쪽, 현재 프레임에서 경계 바깥인 경우 충돌 시점 t를 구해 되감기 후 쿠션 처리를 수행한다. 두 축이 동시에 교차하면 더 이른 축을 먼저 처리한다.

### 쿠션 접촉점 기하학

쿠션은 공 중심보다 높은 위치에서 접촉하므로, 접촉점과 공 중심 간의 기하학적 관계로 실효 스핀을 계산한다.

```
h = cushionHeight - ballRadius     (공 중심으로부터의 접촉 높이)
d = √(R² - h²)                     (접촉점의 수평 변위)
```

### Throw 각도 계산

쿠션 접촉 시 스핀에 의해 공의 반사 방향이 변하는 throw 효과를 계산한다.

```
baseTan = μ × (1 + e_eff) / e_eff
speedScale = min((v_ref / max(|vn_post|, minSpeed))^0.7, 5.0)
spinScale = clamp(|effectiveSpin| / maxSpin, 0, 1)
rawThrowTan = baseTan × speedScale × spinScale
throwTan = clamp(rawThrowTan, 0, tan(25°))
throwVt = throwDirection × throwTan × |vn_post|
postVt = vt_pre × (1 - μ) + throwVt
```

### 쿠션 접촉 토크

쿠션 접촉 시 공 중심 위 높이 h에서 법선 방향 충격량이 가해지므로 토크가 발생한다.

```
I = (2/5) × m × R²
normalImpulse = m × (1 + e_eff) × |vn|
contactTorqueSpinDelta = (h × normalImpulse / I) × 0.35
```

### Throw에 의한 스핀 고갈

throw가 선속도를 증가시키므로 그만큼 스핀에서 에너지를 차감한다 (에너지 보존).

### 사이드스핀↔롤링스핀 변환

```
conversion = μ × 0.08 × spinZ
```

### 롤링 스핀 블렌딩

속도 반전 후 스핀을 롤링 조건으로 부드럽게 블렌딩한다 (frictionSpinDamping = 0.80).

## 메인 시뮬레이션 루프

전체 dt 50ms를 12개 서브스텝으로 나누어 처리한다. 각 서브스텝 순서:

1. NaN 가드 (위치/속도/스핀 검사, 복구 폴백)
2. 마찰 적용 (Semi-implicit Euler: 마찰 먼저, 위치 나중)
3. 위치 업데이트: x += vx × dt_sub, y += vy × dt_sub
4. X/Y축 sweep CCD로 쿠션 충돌 감지 및 처리
5. 경계 초과 시 추가 쿠션 처리 (폴백)
6. 공-공 충돌 (sweepHitTime CCD 포함)
7. 에너지 캡 적용

### 에너지 캡

물리적 에너지 폭발을 방지하기 위해 서브스텝당 에너지 증가 상한(0.08 J)을 적용한다.

```
allowedEnergyJ = energyBeforeStep + 0.08
if KE_after > allowedEnergyJ:
    scale = √(allowedEnergyJ / KE_after)
    모든 공의 vx, vy에 scale을 곱함
```

## 샷 초기화 흐름

사용자 입력(dragPx, impactOffsetX, impactOffsetY, directionDeg)에서 시뮬레이션 시작 상태까지:

1. dragPx → targetBallSpeed (선형 매핑, 1.0 ~ 13.89 m/s)
2. targetBallSpeed → cueSpeed (충돌 역학 역산)
3. cueSpeed → initialBallSpeed (충돌 역학 정산)
4. impactOffset → (omegaX, omegaZ) (강체 충격량 이론)
5. omegaZ × sin(3°) → omegaY (큐 앙각 기여 롤링스핀)
6. impactOffsetX → squirtAngleRad (0.018 계수)
7. 방향각으로 속도 벡터 분해 + squirtAngle 보정

## 샷 종료 판정

모든 공의 선속도가 0.02 m/s 미만인 상태가 3프레임 연속 유지되면 샷 종료로 판정한다. 각속도는 체크하지 않고 선속도만으로 판단한다.

## 3쿠션 득점 판정

두 가지 조건을 모두 만족하면 득점이다:

- 큐볼이 두 오브젝트볼을 모두 맞힘
- 두 번째 오브젝트볼을 맞히기 전까지 쿠션에 3회 이상 접촉

충돌 이벤트 스트림(공-공 충돌, 쿠션 충돌)을 순서대로 탐색하여 판정한다.

## 서버-클라이언트 역할 분담

- 서버: 물리 시뮬레이션 실행, 득점 판정, 50ms 간격 프레임 브로드캐스트
- 클라이언트: 프레임 수신, 보간(lerp) + 속도 기반 외삽(extrapolation)으로 부드러운 렌더링, 가이드라인용 간이 물리 예측
