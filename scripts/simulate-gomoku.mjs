/**
 * 오목 게임 시뮬레이션 스크립트
 * 2명의 플레이어가 Socket.IO로 서버에 접속하여 오목 게임을 진행한다.
 */
import { io } from "socket.io-client";

const SERVER_URL = "http://localhost:3001";

// 보드 출력 유틸
function printBoard(board) {
  const colHeaders = "   " + Array.from({ length: 15 }, (_, i) =>
    String(i).padStart(2)
  ).join(" ");
  console.log(colHeaders);
  console.log("   " + "---".repeat(15));

  for (let r = 0; r < 15; r++) {
    const row = board[r]
      .map((cell) => (cell === "black" ? " ●" : cell === "white" ? " ○" : " ·"))
      .join("");
    console.log(`${String(r).padStart(2)}|${row}`);
  }
  console.log();
}

// 플레이어 연결
function connectPlayer(nickname) {
  return new Promise((resolve) => {
    const socket = io(SERVER_URL, { autoConnect: true });
    socket.on("connect", () => {
      socket.emit("player:set-nickname", nickname);
      console.log(`✅ ${nickname} 접속 (id: ${socket.id})`);
      resolve(socket);
    });
  });
}

// 방 생성
function createRoom(socket, name) {
  return new Promise((resolve) => {
    socket.emit("lobby:create-room", { name, gameType: "gomoku" }, (room) => {
      console.log(`🏠 방 생성: "${room.name}" (id: ${room.id})`);
      resolve(room);
    });
  });
}

// 방 참가
function joinRoom(socket, roomId) {
  return new Promise((resolve, reject) => {
    socket.emit("lobby:join-room", { roomId }, (room, error) => {
      if (error) return reject(new Error(error));
      console.log(`🚪 방 참가 완료`);
      resolve(room);
    });
  });
}

// 이벤트를 한 번 기다리기
function waitForEvent(socket, event) {
  return new Promise((resolve) => {
    socket.once(event, resolve);
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log("=".repeat(60));
  console.log("  🎮 오목 게임 시뮬레이션");
  console.log("=".repeat(60));
  console.log();

  // 1. 두 플레이어 접속
  const player1 = await connectPlayer("흑돌이");
  const player2 = await connectPlayer("백돌이");
  await sleep(200);

  // 2. 방 생성 및 참가
  const room = await createRoom(player1, "오목 한판!");
  await joinRoom(player2, room.id);
  await sleep(200);

  // 3. 레디 토글
  player1.emit("lobby:toggle-ready");
  player2.emit("lobby:toggle-ready");
  await sleep(200);

  // 4. 게임 시작 (호스트만 가능)
  console.log("\n🎯 게임 시작!\n");

  const p1StartPromise = waitForEvent(player1, "game:started");
  const p2StartPromise = waitForEvent(player2, "game:started");
  player1.emit("game:start");
  const initialState = await p1StartPromise;
  await p2StartPromise;

  printBoard(initialState.board);

  // 시뮬레이션 수순: 흑이 빠르게 5목을 만드는 시나리오
  // 흑: (7,7) (7,8) (7,9) (7,10) (7,11) → 가로 5목
  // 백: (8,7) (8,8) (8,9) (8,10)
  const moves = [
    { player: "black", row: 7, col: 7 },   // 흑 1
    { player: "white", row: 8, col: 7 },   // 백 1
    { player: "black", row: 7, col: 8 },   // 흑 2
    { player: "white", row: 8, col: 8 },   // 백 2
    { player: "black", row: 7, col: 9 },   // 흑 3
    { player: "white", row: 8, col: 9 },   // 백 3
    { player: "black", row: 7, col: 10 },  // 흑 4
    { player: "white", row: 8, col: 10 },  // 백 4
    { player: "black", row: 7, col: 11 },  // 흑 5 → 승리!
  ];

  // 흑/백 플레이어 ID 매핑
  const blackId = initialState.players.black;
  const whiteId = initialState.players.white;
  const blackSocket = player1.id === blackId ? player1 : player2;
  const whiteSocket = player1.id === blackId ? player2 : player1;
  const blackNick = player1.id === blackId ? "흑돌이" : "백돌이";
  const whiteNick = player1.id === blackId ? "백돌이" : "흑돌이";

  console.log(`⚫ 흑: ${blackNick} (${blackId})`);
  console.log(`⚪ 백: ${whiteNick} (${whiteId})`);
  console.log();

  let currentState = initialState;
  let gameEnded = false;
  let gameResult = null;

  // 게임 종료 이벤트 리스너
  player1.on("game:ended", (result) => {
    gameEnded = true;
    gameResult = result;
  });

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    const socket = move.player === "black" ? blackSocket : whiteSocket;
    const name = move.player === "black" ? blackNick : whiteNick;
    const stone = move.player === "black" ? "⚫" : "⚪";

    console.log(`${stone} ${name}: (${move.row}, ${move.col})`);

    // 상태 업데이트 또는 게임 종료 대기
    const statePromise = waitForEvent(player1, "game:state-updated");
    const endPromise = waitForEvent(player1, "game:ended");

    socket.emit("game:move", { row: move.row, col: move.col });

    // 둘 중 하나를 기다림
    const result = await Promise.race([
      statePromise.then((s) => ({ type: "state", data: s })),
      endPromise.then((r) => ({ type: "ended", data: r })),
    ]);

    if (result.type === "state") {
      currentState = result.data;
      printBoard(currentState.board);
    }

    if (result.type === "ended") {
      gameResult = result.data;
      gameEnded = true;
      // 마지막 상태도 받을 수 있음
      await sleep(100);
      console.log();
      break;
    }

    await sleep(300); // 수 사이 간격
  }

  // 결과 출력
  if (gameResult) {
    console.log("=".repeat(60));
    if (gameResult.winnerId) {
      const winnerName = gameResult.winnerId === blackId ? blackNick : whiteNick;
      const winnerStone = gameResult.winnerId === blackId ? "⚫" : "⚪";
      console.log(`  🏆 승자: ${winnerStone} ${winnerName}`);
    } else {
      console.log("  🤝 무승부!");
    }
    console.log(`  📝 사유: ${gameResult.reason}`);
    console.log("=".repeat(60));
  }

  // 최종 보드 출력
  if (currentState) {
    console.log("\n📋 최종 보드:");
    printBoard(currentState.board);
  }

  // 정리
  await sleep(500);
  player1.disconnect();
  player2.disconnect();
  console.log("\n👋 시뮬레이션 종료");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ 에러:", err.message);
  process.exit(1);
});
