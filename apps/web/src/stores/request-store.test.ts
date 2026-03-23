import { useRequestStore } from "./request-store";
import type { FeatureRequest } from "@game-hub/shared-types";

function createRequest(overrides: Partial<FeatureRequest> = {}): FeatureRequest {
  return {
    id: "req-1",
    title: "기능 요청",
    description: "설명",
    label: "feature",
    author: "작성자",
    status: "open",
    createdAt: Date.now(),
    inProgressAt: null,
    rejectedAt: null,
    resolvedAt: null,
    adminResponse: null,
    commitHash: null,
    commitUrl: null,
    ...overrides,
  };
}

describe("useRequestStore", () => {
  beforeEach(() => {
    useRequestStore.setState(useRequestStore.getInitialState());
  });

  describe("setRequests", () => {
    it("요청 목록을 설정한다", () => {
      const requests = [createRequest(), createRequest({ id: "req-2" })];
      useRequestStore.getState().setRequests(requests);
      expect(useRequestStore.getState().requests).toEqual(requests);
    });
  });

  describe("addRequest", () => {
    it("요청을 맨 앞에 추가한다", () => {
      const existing = createRequest({ id: "req-1" });
      useRequestStore.setState({ requests: [existing] });
      const newReq = createRequest({ id: "req-2" });
      useRequestStore.getState().addRequest(newReq);
      const requests = useRequestStore.getState().requests;
      expect(requests[0].id).toBe("req-2");
      expect(requests[1].id).toBe("req-1");
    });
  });

  describe("updateRequest", () => {
    it("기존 요청을 업데이트한다", () => {
      useRequestStore.setState({ requests: [createRequest()] });
      useRequestStore.getState().updateRequest(createRequest({ title: "수정됨" }));
      expect(useRequestStore.getState().requests[0].title).toBe("수정됨");
    });

    it("존재하지 않는 ID는 변경하지 않는다", () => {
      useRequestStore.setState({ requests: [createRequest()] });
      useRequestStore.getState().updateRequest(createRequest({ id: "not-exist", title: "수정됨" }));
      expect(useRequestStore.getState().requests[0].title).toBe("기능 요청");
    });
  });

  describe("removeRequest", () => {
    it("요청을 제거한다", () => {
      useRequestStore.setState({ requests: [createRequest()] });
      useRequestStore.getState().removeRequest("req-1");
      expect(useRequestStore.getState().requests).toHaveLength(0);
    });
  });
});
