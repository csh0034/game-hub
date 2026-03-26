# 요청사항 게시판

로비 내 탭으로 접근하는 기능 요청 게시판. 모든 접속자가 요청을 등록하고, 관리자가 상태를 관리한다.

## 라벨

| 라벨 | 설명 |
|------|------|
| feature | 기능 요청 (기본값) |
| bug | 버그 |
| improvement | 개선 |
| new-game | 게임 추가 |

- 등록 시 필수 선택
- 관리자가 모든 상태에서 변경 가능

## 상태 흐름

```
open(요청) → in-progress(진행중) → resolved(완료)
                                  → rejected(거부)
                                  → stopped(중단)
```

| 전환 | 조건 |
|------|------|
| open → in-progress | 관리자 수락 (선택적 답변) |
| open/in-progress → resolved | 관리자 완료 처리 (선택적 커밋 해시, 선택적 답변) |
| open/in-progress → rejected | 관리자 거부 (사유 필수) |
| open/in-progress → stopped | 관리자 중단 (사유 필수, 중복 요청 등) |

- rejected, resolved, stopped는 최종 상태 (되돌리기 불가, 삭제만 가능)

## 관리자 답변

- 거부/중단 시 사유 필수
- 수락/완료 시 선택

## 완료 처리

- 관리자가 커밋 해시 입력 (선택)
- 입력 시 GitHub 커밋 페이지 링크 자동 생성, 미입력 시 링크 미표시

## 삭제

- 관리자가 요청사항 삭제 가능 (확인 다이얼로그 후 삭제)
