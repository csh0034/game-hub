import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from "@game-hub/shared-types";
import type { ConceptVoteStore } from "../storage/interfaces/concept-vote-store.js";

type IOServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

const VALID_CONCEPTS = new Set([
  "1-retro-arcade.html",
  "2-kawaii-pastel.html",
  "3-terminal-hacker.html",
  "4-gradient-glass.html",
  "5-neo-tokyo.html",
  "6-clay-3d.html",
]);

export function setupConceptVoteHandler(io: IOServer, socket: IOSocket, conceptVoteStore: ConceptVoteStore) {
  socket.on("concept-vote:get", async (_browserId, callback) => {
    const votes = await conceptVoteStore.getAll();
    callback({ votes });
  });

  socket.on("concept-vote:toggle", async (conceptFile, browserId, callback) => {
    if (!VALID_CONCEPTS.has(conceptFile)) {
      callback({ success: false, error: "잘못된 컨셉입니다" });
      return;
    }
    if (!browserId || typeof browserId !== "string") {
      callback({ success: false, error: "브라우저 ID가 필요합니다" });
      return;
    }
    const votes = await conceptVoteStore.toggle(conceptFile, browserId);
    io.emit("concept-vote:updated", { votes });
    callback({ success: true });
  });
}
