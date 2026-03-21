"use client";

import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from "react";
import { useGameStore } from "@/stores/game-store";
import { useSocket } from "@/hooks/use-socket";
import { useLobby } from "@/hooks/use-lobby";
import { useChat } from "@/hooks/use-chat";
import { useRequests } from "@/hooks/use-requests";
import { Navbar } from "@/components/layout/navbar";
import { NicknameForm } from "@/components/lobby/nickname-form";
import { GameCardGrid } from "@/components/lobby/game-card-grid";
import { RoomList } from "@/components/lobby/room-list";
import { CreateRoomDialog } from "@/components/lobby/create-room-dialog";
import { RoomView } from "@/components/lobby/room-view";
import { ChatPanel } from "@/components/chat/chat-panel";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { RequestBoard } from "@/components/request-board/request-board";

const NICKNAME_KEY = "game-hub-nickname";

let listeners: Array<() => void> = [];

type NicknameSnapshot = string | null | undefined; // undefined = SSR (아직 모름)

function nicknameStore() {
  return {
    getSnapshot: (): NicknameSnapshot => localStorage.getItem(NICKNAME_KEY),
    getServerSnapshot: (): NicknameSnapshot => undefined,
    subscribe: (cb: () => void) => {
      listeners.push(cb);
      const onStorage = (e: StorageEvent) => {
        if (e.key === NICKNAME_KEY) cb();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners = listeners.filter((l) => l !== cb);
        window.removeEventListener("storage", onStorage);
      };
    },
    set: (value: string) => {
      localStorage.setItem(NICKNAME_KEY, value);
      listeners.forEach((l) => l());
    },
    remove: () => {
      localStorage.removeItem(NICKNAME_KEY);
      listeners.forEach((l) => l());
    },
  };
}

const store = nicknameStore();

export default function LobbyPage() {
  const { socket, isConnected, playerCount, onlinePlayers } = useSocket();
  const { rooms, currentRoom, createRoom, joinRoom, leaveRoom, toggleReady } =
    useLobby(socket);
  const { lobbyMessages, roomMessages, sendLobbyMessage, sendRoomMessage, clearRoomMessages, requestLobbyHistory, requestRoomHistory } =
    useChat(socket);
  const { requests, createRequest, resolveRequest, deleteRequest } = useRequests(socket);
  const [activeTab, setActiveTab] = useState<"lobby" | "requests">("lobby");
  const [isAdmin, setIsAdmin] = useState(false);
  const [githubRepoUrl, setGithubRepoUrl] = useState<string | undefined>();
  const isNavigatingBack = useRef(false);
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    onConfirm: () => void;
  }>({ open: false, onConfirm: () => {} });
  const confirmResolveRef = useRef<((value: boolean) => void) | null>(null);

  const nickname = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );

  // 재접속 시 저장된 닉네임을 서버에 전송
  useEffect(() => {
    if (!socket || !isConnected || !nickname) return;

    socket.emit("player:set-nickname", nickname, (result) => {
      if (!result.success) {
        store.remove();
        setIsAdmin(false);
      } else {
        setIsAdmin(result.isAdmin ?? false);
        setGithubRepoUrl(result.githubRepoUrl);
        requestLobbyHistory();
      }
    });
  }, [socket, isConnected, nickname, requestLobbyHistory]);

  const handleNicknameComplete = useCallback((newNickname: string) => {
    store.set(newNickname);
  }, []);

  const isGameInProgress = useCallback(() => {
    const { gameState, gameResult } = useGameStore.getState();
    return gameState !== null && gameResult === null;
  }, []);

  const showConfirm = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      confirmResolveRef.current = resolve;
      setConfirmState({
        open: true,
        onConfirm: () => {
          resolve(true);
          confirmResolveRef.current = null;
          setConfirmState({ open: false, onConfirm: () => {} });
        },
      });
    });
  }, []);

  const handleConfirmCancel = useCallback(() => {
    confirmResolveRef.current?.(false);
    confirmResolveRef.current = null;
    setConfirmState({ open: false, onConfirm: () => {} });
  }, []);

  const doLeaveRoom = useCallback(() => {
    if (!currentRoom) return;
    leaveRoom();
    clearRoomMessages();
    requestLobbyHistory();
    if (!isNavigatingBack.current) {
      history.back();
    }
    isNavigatingBack.current = false;
  }, [currentRoom, leaveRoom, clearRoomMessages, requestLobbyHistory]);

  const handleLeaveRoom = useCallback(async () => {
    if (!currentRoom) return;
    if (isGameInProgress()) {
      if (!(await showConfirm())) return;
    }
    doLeaveRoom();
  }, [currentRoom, isGameInProgress, doLeaveRoom, showConfirm]);

  const handleGoHome = useCallback(() => {
    handleLeaveRoom();
  }, [handleLeaveRoom]);

  const handleLogout = useCallback(async () => {
    if (currentRoom && isGameInProgress()) {
      if (!(await showConfirm())) return;
    }
    if (currentRoom) {
      leaveRoom();
    }
    socket?.emit("player:logout");
    store.remove();
    setIsAdmin(false);
  }, [currentRoom, leaveRoom, socket, isGameInProgress, showConfirm]);

  // Handle browser back button
  useEffect(() => {
    const onPopState = async () => {
      if (currentRoom) {
        if (isGameInProgress()) {
          history.pushState({ inRoom: true }, "");
          if (!(await showConfirm())) {
            return;
          }
        }
        isNavigatingBack.current = true;
        doLeaveRoom();
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [currentRoom, isGameInProgress, doLeaveRoom, showConfirm]);

  // beforeunload — 게임 진행 중 탭 닫기 방지
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isGameInProgress()) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isGameInProgress]);

  const wrappedCreateRoom = useCallback(
    async (...args: Parameters<typeof createRoom>) => {
      clearRoomMessages();
      const room = await createRoom(...args);
      history.pushState({ inRoom: true }, "");
      return room;
    },
    [createRoom, clearRoomMessages]
  );

  const wrappedJoinRoom = useCallback(
    async (...args: Parameters<typeof joinRoom>) => {
      clearRoomMessages();
      const room = await joinRoom(...args);
      requestRoomHistory();
      history.pushState({ inRoom: true }, "");
      return room;
    },
    [joinRoom, clearRoomMessages, requestRoomHistory]
  );

  // SSR / hydration 전: 빈 화면 (닉네임 폼 플래시 방지)
  if (nickname === undefined) {
    return null;
  }

  // 닉네임 미설정 시 닉네임 폼 표시
  if (nickname === null) {
    return <NicknameForm onComplete={handleNicknameComplete} />;
  }

  const confirmDialog = (
    <ConfirmDialog
      open={confirmState.open}
      title="게임 나가기"
      message="게임이 진행 중입니다. 정말 나가시겠습니까?"
      confirmText="나가기"
      cancelText="취소"
      onConfirm={confirmState.onConfirm}
      onCancel={handleConfirmCancel}
    />
  );

  if (currentRoom) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar isConnected={isConnected} playerCount={playerCount} onlinePlayers={onlinePlayers} nickname={nickname} githubRepoUrl={githubRepoUrl} onGoHome={handleGoHome} onLogout={handleLogout} />
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
          <RoomView
            room={currentRoom}
            socket={socket}
            nickname={nickname}
            onLeave={handleLeaveRoom}
            onLeaveImmediate={doLeaveRoom}
            onToggleReady={toggleReady}
            roomMessages={roomMessages}
            onSendRoomMessage={sendRoomMessage}
          />
        </main>
        {confirmDialog}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar isConnected={isConnected} playerCount={playerCount} onlinePlayers={onlinePlayers} nickname={nickname} githubRepoUrl={githubRepoUrl} onGoHome={handleGoHome} onLogout={handleLogout} />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <div className={`lg:grid lg:gap-6 ${activeTab === "lobby" ? "lg:grid-cols-[1fr_320px]" : ""}`}>
          <div className="space-y-8">
            {/* 탭 네비게이션 */}
            <div className="flex items-center gap-1 border-b border-border">
              <button
                onClick={() => setActiveTab("lobby")}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "lobby"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                게임 로비
              </button>
              <button
                onClick={() => setActiveTab("requests")}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "requests"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                요청사항
                {requests.filter((r) => r.status === "open").length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-primary/15 text-primary">
                    {requests.filter((r) => r.status === "open").length}
                  </span>
                )}
              </button>
            </div>

            {activeTab === "lobby" ? (
              <>
                <section>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h1 className="text-3xl font-bold">빠른 시작</h1>
                      <p className="text-muted-foreground mt-1">
                        게임을 클릭하면 기본 설정으로 바로 방이 만들어집니다
                      </p>
                    </div>
                    <CreateRoomDialog onCreateRoom={wrappedCreateRoom} />
                  </div>
                  <GameCardGrid onCreateRoom={wrappedCreateRoom} />
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">열린 방 목록</h2>
                  <RoomList rooms={rooms} onJoinRoom={wrappedJoinRoom} />
                </section>
              </>
            ) : (
              <RequestBoard
                requests={requests}
                onCreateRequest={createRequest}
                onResolveRequest={resolveRequest}
                onDeleteRequest={deleteRequest}
                isAdmin={isAdmin}
              />
            )}
          </div>

          {activeTab === "lobby" && (
            <aside className="mt-8 lg:mt-0 h-[500px]">
              <ChatPanel
                messages={lobbyMessages}
                onSendMessage={sendLobbyMessage}
                placeholder="로비 채팅..."
                myNickname={nickname ?? undefined}
              />
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}
