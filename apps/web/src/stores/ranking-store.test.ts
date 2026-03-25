import { useRankingStore } from "./ranking-store";
import type { RankingEntry } from "@game-hub/shared-types";

function createEntry(overrides: Partial<RankingEntry> = {}): RankingEntry {
  return {
    id: "entry-1",
    nickname: "Player1",
    score: 1000,
    gameType: "tetris",
    difficulty: "beginner",
    createdAt: Date.now(),
    ...overrides,
  };
}

describe("ranking-store", () => {
  beforeEach(() => {
    useRankingStore.setState(useRankingStore.getInitialState());
  });

  it("초기 상태는 빈 rankings 객체이다", () => {
    expect(useRankingStore.getState().rankings).toEqual({});
  });

  it("setRankings로 특정 키의 랭킹을 설정한다", () => {
    const entries = [createEntry(), createEntry({ id: "entry-2", nickname: "Player2", score: 900 })];
    useRankingStore.getState().setRankings("tetris:beginner", entries);

    expect(useRankingStore.getState().rankings["tetris:beginner"]).toEqual(entries);
  });

  it("setRankings로 여러 키의 랭킹을 독립적으로 저장한다", () => {
    const tetrisEntries = [createEntry()];
    const mineEntries = [createEntry({ id: "entry-2", gameType: "minesweeper", score: 30 })];

    useRankingStore.getState().setRankings("tetris:beginner", tetrisEntries);
    useRankingStore.getState().setRankings("minesweeper:beginner", mineEntries);

    expect(useRankingStore.getState().rankings["tetris:beginner"]).toEqual(tetrisEntries);
    expect(useRankingStore.getState().rankings["minesweeper:beginner"]).toEqual(mineEntries);
  });

  it("setRankings로 기존 키의 랭킹을 덮어쓴다", () => {
    const oldEntries = [createEntry({ score: 500 })];
    const newEntries = [createEntry({ score: 1000 })];

    useRankingStore.getState().setRankings("tetris:beginner", oldEntries);
    useRankingStore.getState().setRankings("tetris:beginner", newEntries);

    expect(useRankingStore.getState().rankings["tetris:beginner"]).toEqual(newEntries);
  });

  it("reset으로 모든 랭킹을 초기화한다", () => {
    useRankingStore.getState().setRankings("tetris:beginner", [createEntry()]);
    useRankingStore.getState().setRankings("minesweeper:expert", [createEntry({ id: "entry-2" })]);

    useRankingStore.getState().reset();

    expect(useRankingStore.getState().rankings).toEqual({});
  });
});
