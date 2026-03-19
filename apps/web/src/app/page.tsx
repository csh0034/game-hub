"use client";

import { useSocket } from "@/hooks/use-socket";
import { useLobby } from "@/hooks/use-lobby";
import { Navbar } from "@/components/layout/navbar";
import { GameCardGrid } from "@/components/lobby/game-card-grid";
import { RoomList } from "@/components/lobby/room-list";
import { CreateRoomDialog } from "@/components/lobby/create-room-dialog";
import { RoomView } from "@/components/lobby/room-view";

export default function LobbyPage() {
  const { socket, isConnected, playerCount } = useSocket();
  const { rooms, currentRoom, createRoom, joinRoom, leaveRoom, toggleReady } =
    useLobby(socket);

  if (currentRoom) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar isConnected={isConnected} playerCount={playerCount} />
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
          <RoomView
            room={currentRoom}
            socket={socket}
            onLeave={leaveRoom}
            onToggleReady={toggleReady}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar isConnected={isConnected} playerCount={playerCount} />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 space-y-8">
        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold">게임 선택</h1>
              <p className="text-muted-foreground mt-1">
                플레이할 게임을 선택하고 방을 만들어보세요
              </p>
            </div>
            <CreateRoomDialog onCreateRoom={createRoom} />
          </div>
          <GameCardGrid onCreateRoom={createRoom} />
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4">열린 방 목록</h2>
          <RoomList rooms={rooms} onJoinRoom={joinRoom} />
        </section>
      </main>
    </div>
  );
}
