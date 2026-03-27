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

export function setupPlacardHandler(io: IOServer, socket: IOSocket, placardStore: PlacardStore) {
  socket.on("placard:get", async (callback) => {
    const text = await placardStore.getText();
    callback(text);
  });

  socket.on("placard:set", async (text, callback) => {
    if (!isAdmin(socket.data.nickname)) {
      callback({ success: false, error: "권한이 없습니다" });
      return;
    }

    const trimmed = text.trim();
    if (trimmed.length > MAX_LENGTH) {
      callback({ success: false, error: `플랜카드는 ${MAX_LENGTH}자 이하여야 합니다` });
      return;
    }

    const value = trimmed || null;
    await placardStore.setText(value);
    io.emit("placard:updated", value);
    callback({ success: true });
  });
}
