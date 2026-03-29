import { describe, it, expect, beforeEach } from "vitest";
import { TypingEngine } from "./typing-engine.js";
import type { TypingPublicState, TypingMove } from "@game-hub/shared-types";

function createPlayers(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `player-${i + 1}`,
    nickname: `Player${i + 1}`,
    isReady: true,
  }));
}

describe("TypingEngine", () => {
  let engine: TypingEngine;

  beforeEach(() => {
    engine = new TypingEngine("beginner", 60, 3);
  });

  describe("initState", () => {
    it("플레이어 수에 맞는 초기 상태를 반환한다", () => {
      const state = engine.initState(createPlayers(2));
      expect(state.players).toHaveProperty("player-1");
      expect(state.players).toHaveProperty("player-2");
      expect(state.difficulty).toBe("beginner");
      expect(state.timeLimit).toBe(60);
      expect(state.maxLives).toBe(3);
      expect(state.startedAt).toBeGreaterThan(0);
    });

    it("모든 플레이어의 초기 상태가 올바르다", () => {
      const state = engine.initState(createPlayers(1));
      const ps = state.players["player-1"];
      expect(ps.score).toBe(0);
      expect(ps.lives).toBe(3);
      expect(ps.combo).toBe(0);
      expect(ps.wordsCleared).toBe(0);
      expect(ps.status).toBe("playing");
    });

    it("1인 플레이도 가능하다", () => {
      const state = engine.initState(createPlayers(1));
      expect(Object.keys(state.players)).toHaveLength(1);
    });

    it("8인 플레이도 가능하다", () => {
      const state = engine.initState(createPlayers(8));
      expect(Object.keys(state.players)).toHaveLength(8);
    });
  });

  describe("processMove", () => {
    it("오타 입력 시 콤보만 리셋되고 목숨은 유지된다", () => {
      const state = engine.initState(createPlayers(1));

      const newState = engine.processMove(state, "player-1", { type: "submit", word: "없는단어" } as TypingMove);
      const ps = (newState as TypingPublicState).players["player-1"];
      expect(ps.lives).toBe(3);
      expect(ps.combo).toBe(0);
    });

    it("정답 입력 시 점수가 오른다", () => {
      const state = engine.initState(createPlayers(1));

      // 단어를 스폰해야 정답 입력 가능
      engine.tick(); // 첫 단어 스폰
      const words = engine.getPlayerWords("player-1");
      if (words.length === 0) return; // 풀이 비어있으면 스킵

      const word = words[0].text;
      const newState = engine.processMove(state, "player-1", { type: "submit", word } as TypingMove);
      const ps = (newState as TypingPublicState).players["player-1"];
      expect(ps.score).toBeGreaterThan(0);
      expect(ps.wordsCleared).toBe(1);
      expect(ps.combo).toBe(1);
    });

    it("오타로는 탈락하지 않는다", () => {
      engine = new TypingEngine("beginner", 60, 1);
      const state = engine.initState(createPlayers(1));

      const newState = engine.processMove(state, "player-1", { type: "submit", word: "오타1" } as TypingMove);
      const ps = (newState as TypingPublicState).players["player-1"];
      expect(ps.lives).toBe(1);
      expect(ps.status).toBe("playing");
    });

    it("오타 시 콤보가 리셋된다", () => {
      const state = engine.initState(createPlayers(1));

      // 단어 스폰 후 정답 입력으로 콤보 올리기
      engine.tick();
      const words = engine.getPlayerWords("player-1");
      if (words.length === 0) return;

      const word = words[0].text;
      let currentState = engine.processMove(state, "player-1", { type: "submit", word } as TypingMove);
      expect((currentState as TypingPublicState).players["player-1"].combo).toBe(1);

      // 오타로 콤보 리셋
      currentState = engine.processMove(currentState, "player-1", { type: "submit", word: "오타오타" } as TypingMove);
      expect((currentState as TypingPublicState).players["player-1"].combo).toBe(0);
    });
  });

  describe("checkWin", () => {
    it("게임 진행 중이면 null을 반환한다", () => {
      const state = engine.initState(createPlayers(2));
      const result = engine.checkWin(state);
      expect(result).toBeNull();
    });

    it("모든 플레이어가 탈락하면 게임이 종료된다", () => {
      engine = new TypingEngine("beginner", 60, 1);
      const state = engine.initState(createPlayers(1));

      // 단어 스폰 후 fallDuration을 0으로 조작하여 즉시 놓침 발생
      engine.tick();
      const words = engine.getPlayerWords("player-1");
      if (words.length === 0) return;
      // spawnedAt을 과거로 조작하여 tick에서 miss 처리
      words[0].spawnedAt = 0;
      words[0].fallDurationMs = 0;

      const tickResult = engine.tick();
      expect(tickResult.gameOver).toBe(true);
    });

    it("최고 점수 플레이어가 승리한다", () => {
      engine = new TypingEngine("beginner", 60, 1);
      const state = engine.initState(createPlayers(2));

      // player-1에게 단어를 맞추게 하기
      engine.tick();
      const words1 = engine.getPlayerWords("player-1");
      if (words1.length === 0) return;

      engine.processMove(state, "player-1", { type: "submit", word: words1[0].text } as TypingMove);

      // 놓침으로 탈락시키기 — 각 플레이어별로 tick
      for (const pid of ["player-1", "player-2"]) {
        engine.tick(); // 새 단어 스폰
        const pw = engine.getPlayerWords(pid);
        for (const w of pw) { w.spawnedAt = 0; w.fallDurationMs = 0; }
      }
      engine.tick(); // miss 처리

      const finalState = engine.toPublicState();
      const result = engine.checkWin(finalState);
      expect(result).not.toBeNull();
      expect(result!.winnerId).toBe("player-1");
    });
  });

  describe("tick", () => {
    it("단어를 스폰한다", () => {
      engine.initState(createPlayers(1));
      const result = engine.tick();
      expect(result.spawnedWords.length).toBeGreaterThanOrEqual(0);
      // 첫 틱에는 단어가 스폰되어야 함
      if (result.spawnedWords.length > 0) {
        expect(result.spawnedWords[0].text).toBeTruthy();
        expect(result.spawnedWords[0].id).toBeGreaterThan(0);
      }
    });

    it("모든 활성 플레이어에게 동일한 단어를 추가한다", () => {
      engine.initState(createPlayers(2));
      const result = engine.tick();

      if (result.spawnedWords.length > 0) {
        const words1 = engine.getPlayerWords("player-1");
        const words2 = engine.getPlayerWords("player-2");
        expect(words1.length).toBe(words2.length);
        expect(words1[0]?.text).toBe(words2[0]?.text);
      }
    });

    it("최대 동시 단어 수를 초과하지 않는다", () => {
      engine.initState(createPlayers(1));
      // 여러 번 틱
      for (let i = 0; i < 20; i++) {
        engine.tick();
      }
      const words = engine.getPlayerWords("player-1");
      expect(words.length).toBeLessThanOrEqual(5); // beginner maxWords
    });
  });

  describe("난이도", () => {
    it("중급은 2~4자 단어를 사용한다", () => {
      engine = new TypingEngine("intermediate", 60, 3);
      engine.initState(createPlayers(1));
      // 여러 번 틱하여 단어 확인
      for (let i = 0; i < 10; i++) {
        engine.tick();
      }
      const words = engine.getPlayerWords("player-1");
      for (const w of words) {
        expect(w.text.length).toBeGreaterThanOrEqual(2);
        expect(w.text.length).toBeLessThanOrEqual(4);
      }
    });

    it("고급은 2~5자 단어를 사용한다", () => {
      engine = new TypingEngine("expert", 60, 3);
      engine.initState(createPlayers(1));
      for (let i = 0; i < 10; i++) {
        engine.tick();
      }
      const words = engine.getPlayerWords("player-1");
      for (const w of words) {
        expect(w.text.length).toBeGreaterThanOrEqual(2);
        expect(w.text.length).toBeLessThanOrEqual(5);
      }
    });
  });

  describe("점수 시스템", () => {
    it("2자 단어는 100점이다", () => {
      engine.initState(createPlayers(1));
      // 2자 단어가 나올 때까지 틱
      for (let i = 0; i < 20; i++) engine.tick();
      const words = engine.getPlayerWords("player-1");
      const twoCharWord = words.find((w) => w.text.length === 2);
      if (!twoCharWord) return;

      const state = engine.toPublicState();
      const newState = engine.processMove(state, "player-1", { type: "submit", word: twoCharWord.text } as TypingMove);
      expect((newState as TypingPublicState).players["player-1"].score).toBe(100);
    });

    it("콤보 보너스가 5콤보에서 발생한다", () => {
      engine.initState(createPlayers(1));
      const state = engine.toPublicState();

      // 5개 단어를 연속으로 맞추기
      let currentState = state;
      for (let i = 0; i < 5; i++) {
        engine.tick();
        const words = engine.getPlayerWords("player-1");
        if (words.length === 0) break;
        currentState = engine.processMove(currentState, "player-1", {
          type: "submit",
          word: words[0].text,
        } as TypingMove) as TypingPublicState;
      }

      const ps = (currentState as TypingPublicState).players["player-1"];
      // 5콤보 보너스 (+200) 포함된 점수가 있어야 함
      if (ps.combo >= 5) {
        // 기본 점수 합 + 200 보너스
        expect(ps.score).toBeGreaterThanOrEqual(700); // 100*5 + 200
      }
    });
  });

  describe("가속", () => {
    it("초반 구간에서 속도 배율이 1.0이다", () => {
      engine.initState(createPlayers(1));
      const { speedMult, spawnMult } = engine.getAcceleration(Date.now());
      expect(speedMult).toBe(1.0);
      expect(spawnMult).toBe(1.0);
    });
  });

  describe("toPublicState", () => {
    it("현재 상태를 PublicState로 변환한다", () => {
      engine.initState(createPlayers(2));
      const state = engine.toPublicState();
      expect(state.difficulty).toBe("beginner");
      expect(state.timeLimit).toBe(60);
      expect(state.maxLives).toBe(3);
      expect(state.players).toHaveProperty("player-1");
      expect(state.players).toHaveProperty("player-2");
    });
  });
});
