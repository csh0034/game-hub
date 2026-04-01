import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from "@game-hub/shared-types";
import type { PlacardStore } from "../storage/interfaces/placard-store.js";
import { isAdmin } from "../admin.js";

type IOServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

const MAX_LENGTH = 50;
const MAX_ITEMS = 5;

export function setupPlacardHandler(io: IOServer, socket: IOSocket, placardStore: PlacardStore) {
  socket.on("placard:get", async (callback) => {
    const items = await placardStore.getItems();
    callback(items);
  });

  socket.on("placard:set", async (items, callback) => {
    if (!isAdmin(socket.data.nickname)) {
      callback({ success: false, error: "권한이 없습니다" });
      return;
    }

    if (!Array.isArray(items)) {
      callback({ success: false, error: "잘못된 형식입니다" });
      return;
    }

    const trimmed = items.map((item) => String(item).trim()).filter((item) => item.length > 0);

    if (trimmed.length > MAX_ITEMS) {
      callback({ success: false, error: `플랜카드는 최대 ${MAX_ITEMS}개까지 등록할 수 있습니다` });
      return;
    }

    const tooLong = trimmed.find((item) => item.length > MAX_LENGTH);
    if (tooLong) {
      callback({ success: false, error: `플랜카드는 ${MAX_LENGTH}자 이하여야 합니다` });
      return;
    }

    await placardStore.setItems(trimmed);
    io.emit("placard:updated", trimmed);
    callback({ success: true });
  });
}
