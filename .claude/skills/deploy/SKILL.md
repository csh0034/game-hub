---
name: deploy
description: 로컬에서 멀티플랫폼 Docker 이미지를 빌드하고 Docker Hub에 푸시
disable-model-invocation: true
---

로컬에서 멀티플랫폼 Docker 이미지를 빌드하고 Docker Hub에 푸시한다.

## 전제조건
- Docker Desktop + buildx 설치
- `docker login` 완료 상태

## 실행 순서

1. `docker buildx` 빌더가 준비되어 있는지 확인한다. 없으면 생성한다:
   ```bash
   docker buildx inspect game-hub-builder || docker buildx create --name game-hub-builder --use
   docker buildx use game-hub-builder
   ```

2. 현재 git SHA(short)를 가져온다:
   ```bash
   git rev-parse --short HEAD
   ```

3. 멀티플랫폼 빌드 및 Docker Hub 푸시를 실행한다:
   ```bash
   docker buildx build \
     --platform linux/amd64,linux/arm64 \
     --tag shchoi1/game-hub:latest \
     --tag shchoi1/game-hub:<git-short-sha> \
     --push \
     .
   ```

4. 완료 후 푸시된 이미지 태그를 사용자에게 알려준다.
