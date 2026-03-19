# 커밋 컨벤션 (Angular Commit Convention)

## 형식

```
<type>(<scope>): <subject>

[body]

[footer]
```

## Type

| type       | 설명                                  |
|------------|---------------------------------------|
| `feat`     | 새로운 기능 추가                      |
| `fix`      | 버그 수정                             |
| `docs`     | 문서 변경                             |
| `style`    | 코드 포맷팅, 세미콜론 누락 등 (로직 변경 없음) |
| `refactor` | 리팩토링 (기능 변경 없음)             |
| `perf`     | 성능 개선                             |
| `test`     | 테스트 추가/수정                      |
| `build`    | 빌드 시스템, 외부 종속성 변경         |
| `ci`       | CI 설정 변경                          |
| `chore`    | 기타 (소스/테스트 변경 없음)          |
| `revert`   | 이전 커밋 되돌리기                    |

## Scope

모노레포 패키지 기준:

- `web` — `apps/web`
- `server` — `apps/server`
- `shared-types` — `packages/shared-types`
- `root` — 루트 설정 (turbo.json, pnpm-workspace.yaml 등)

여러 패키지에 걸치는 변경은 주된 변경 패키지를 scope로 사용하거나, scope를 생략한다.

## Subject

- 한글 허용
- 명령형으로 작성 ("추가한다" X → "추가" O, "adds" X → "add" O)
- 50자 이내
- 첫 글자 소문자 (영문인 경우)
- 마침표 없음

## Body (선택)

- subject로 충분히 설명되지 않을 때 작성
- **무엇을**, **왜** 변경했는지 기술
- 72자 단위로 줄바꿈

## Footer (선택)

- **Breaking Change**: `BREAKING CHANGE: <설명>`
- **이슈 참조**: `Closes #123`, `Refs #456`

## 예시

```
feat(server): 오목 게임 엔진 추가

GameEngine 인터페이스를 구현한 GomokuEngine 작성.
15x15 보드에서 5목 판정 로직 포함.

Closes #42
```

```
fix(web): 로비 방 목록 실시간 갱신 안 되는 문제 수정
```

```
refactor(shared-types): 소켓 이벤트 타입 lobby/game 분리
```

```
chore(root): pnpm 9.x 업그레이드

BREAKING CHANGE: pnpm 8.x 이하 호환 불가
```
