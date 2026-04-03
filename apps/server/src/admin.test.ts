import { describe, it, expect } from "vitest";
import { isAdmin, getDisplayNickname } from "./admin.js";

describe("isAdmin", () => {
  it("기본 관리자 닉네임 'admin'을 true로 판정한다", () => {
    expect(isAdmin("admin")).toBe(true);
  });

  it("일반 닉네임을 false로 판정한다", () => {
    expect(isAdmin("player1")).toBe(false);
  });
});

describe("getDisplayNickname", () => {
  it("관리자 닉네임을 '관리자'로 치환한다", () => {
    expect(getDisplayNickname("admin")).toBe("관리자");
  });

  it("일반 닉네임은 그대로 반환한다", () => {
    expect(getDisplayNickname("player1")).toBe("player1");
  });
});
