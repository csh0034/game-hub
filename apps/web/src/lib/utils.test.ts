import { cn, formatDateTime } from "./utils";

describe("cn", () => {
  it("클래스 이름을 병합한다", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("조건부 클래스를 처리한다", () => {
    const condition = false;
    expect(cn("foo", condition && "bar", "baz")).toBe("foo baz");
  });

  it("tailwind 충돌 클래스를 병합한다", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});

describe("formatDateTime", () => {
  it("YYYY-MM-DD HH:mm:ss 형식으로 반환한다", () => {
    const timestamp = new Date(2026, 2, 23, 14, 5, 9).getTime();
    expect(formatDateTime(timestamp)).toBe("2026-03-23 14:05:09");
  });

  it("월/일/시/분/초가 한 자리일 때 0으로 패딩한다", () => {
    const timestamp = new Date(2026, 0, 1, 0, 0, 0).getTime();
    expect(formatDateTime(timestamp)).toBe("2026-01-01 00:00:00");
  });
});
