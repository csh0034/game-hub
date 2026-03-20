import { describe, it, expect } from "vitest";
import { parseCorsOrigin } from "./cors.js";

describe("parseCorsOrigin", () => {
  it("undefined이면 기본값 http://localhost:3000을 반환한다", () => {
    expect(parseCorsOrigin(undefined)).toBe("http://localhost:3000");
  });

  it("단일 origin 문자열을 그대로 반환한다", () => {
    expect(parseCorsOrigin("https://example.com")).toBe(
      "https://example.com",
    );
  });

  it("쉼표로 구분된 여러 origin을 배열로 반환한다", () => {
    expect(
      parseCorsOrigin("https://a.com, https://b.com"),
    ).toEqual(["https://a.com", "https://b.com"]);
  });

  it("*이면 true를 반환한다", () => {
    expect(parseCorsOrigin("*")).toBe(true);
  });
});
