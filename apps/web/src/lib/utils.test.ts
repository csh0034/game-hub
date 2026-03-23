import { cn } from "./utils";

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
