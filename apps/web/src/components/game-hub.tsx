"use client";

import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useGameStore } from "@/stores/game-store";
import { useLobbyStore } from "@/stores/lobby-store";
import { useSocket } from "@/hooks/use-socket";
import { useLobby } from "@/hooks/use-lobby";
import { useChat } from "@/hooks/use-chat";
import { useRequests } from "@/hooks/use-requests";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { NicknameForm } from "@/components/lobby/nickname-form";
import { GameCardGrid } from "@/components/lobby/game-card-grid";
import { RoomList } from "@/components/lobby/room-list";
import { RoomView } from "@/components/lobby/room-view";
import { ChatPanel } from "@/components/chat/chat-panel";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { AnnounceDialog } from "@/components/common/announce-dialog";
import { AnnouncementOverlay } from "@/components/common/announcement-overlay";
import { RequestBoard } from "@/components/request-board/request-board";
import LobbyRankingPanel from "@/components/ranking/lobby-ranking-panel";

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

interface GameHubProps {
  activeTab?: "lobby" | "requests";
}

export default function GameHub({ activeTab = "lobby" }: GameHubProps) {
  const { socket, isConnected, playerCount, onlinePlayers } = useSocket();
  const { rooms, currentRoom, isSpectating, createRoom, joinRoom, spectateRoom, leaveRoom, kickSpectators, toggleReady, updateGameOptions } =
    useLobby(socket);
  const { lobbyMessages, roomMessages, sendLobbyMessage, sendRoomMessage, clearRoomMessages, requestLobbyHistory, requestRoomHistory, deleteMessage } =
    useChat(socket);
  const { requests, createRequest, acceptRequest, rejectRequest, resolveRequest, stopRequest, changeLabelRequest, deleteRequest } = useRequests(socket);
  const [isAdmin, setIsAdmin] = useState(false);
  const isAdminRef = useRef(false);
  const [githubRepoUrl, setGithubRepoUrl] = useState<string | undefined>();
  const isNavigatingBack = useRef(false);
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    onConfirm: () => void;
  }>({ open: false, onConfirm: () => {} });
  const [announceOpen, setAnnounceOpen] = useState(false);
  const [announcement, setAnnouncement] = useState<{ message: string; receivedAt: number } | null>(
    null,
  );
  const confirmResolveRef = useRef<((value: boolean) => void) | null>(null);

  const nickname = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );

  // 재접속 시 저장된 닉네임을 서버에 전송 + pendingRoomId 자동 입장
  useEffect(() => {
    if (!socket || !isConnected || !nickname) return;

    socket.emit("player:set-nickname", nickname, (result) => {
      if (!result.success) {
        store.remove();
        setIsAdmin(false);
        isAdminRef.current = false;
        return;
      }

      const admin = result.isAdmin ?? false;
      setIsAdmin(admin);
      isAdminRef.current = admin;
      setGithubRepoUrl(result.githubRepoUrl);
      requestLobbyHistory();

      // 닉네임 인증 완료 후 pendingRoomId가 있으면 자동 입장
      const pending = useLobbyStore.getState().pendingRoomId;
      if (!pending || useLobbyStore.getState().currentRoom) return;

      clearRoomMessages();
      joinRoom(pending)
        .then(() => {
          requestRoomHistory();
          history.replaceState(null, "", "/room/" + pending);
        })
        .catch(() => {
          // 플레이어 참가 실패 → 관전 시도
          spectateRoom(pending)
            .then(() => {
              requestRoomHistory();
              history.replaceState(null, "", "/room/" + pending);
            })
            .catch(() => {
              toast.error("방에 참가할 수 없습니다.");
              history.replaceState(null, "", "/lobby");
            });
        })
        .finally(() => {
          useLobbyStore.getState().setPendingRoomId(null);
        });
    });
  }, [socket, isConnected, nickname, requestLobbyHistory, joinRoom, spectateRoom, clearRoomMessages, requestRoomHistory]);

  // 관리자 공지 수신 (관리자 본인은 제외)
  useEffect(() => {
    if (!socket) return;
    const handler = ({ message }: { message: string }) => {
      if (!isAdminRef.current) {
        setAnnouncement({ message, receivedAt: Date.now() });
      }
    };
    socket.on("system:announcement", handler);
    return () => {
      socket.off("system:announcement", handler);
    };
  }, [socket]);

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
    if (isNavigatingBack.current) {
      // popstate에서 호출 — 브라우저가 이미 URL을 변경함, /로 교체만
      history.replaceState(null, "", "/lobby");
    } else {
      // UI 버튼으로 나가기 — URL을 /로 교체
      history.replaceState(null, "", "/lobby");
    }
    isNavigatingBack.current = false;
  }, [currentRoom, leaveRoom, clearRoomMessages, requestLobbyHistory]);

  const handleLeaveRoom = useCallback(async () => {
    if (!currentRoom) return;
    if (!isSpectating && isGameInProgress()) {
      if (!(await showConfirm())) return;
    }
    doLeaveRoom();
  }, [currentRoom, isSpectating, isGameInProgress, doLeaveRoom, showConfirm]);

  const handleGoHome = useCallback(() => {
    handleLeaveRoom();
  }, [handleLeaveRoom]);

  const handleLogout = useCallback(async () => {
    if (currentRoom && isGameInProgress()) {
      if (!(await showConfirm())) return;
    }
    if (currentRoom) {
      leaveRoom();
      history.replaceState(null, "", "/lobby");
    }
    socket?.emit("player:logout");
    store.remove();
    setIsAdmin(false);
    isAdminRef.current = false;
  }, [currentRoom, leaveRoom, socket, isGameInProgress, showConfirm]);

  // Handle browser back button
  useEffect(() => {
    const onPopState = async () => {
      if (currentRoom) {
        if (isGameInProgress()) {
          history.pushState(null, "", "/room/" + currentRoom.id);
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
      history.pushState(null, "", "/room/" + room.id);
      return room;
    },
    [createRoom, clearRoomMessages]
  );

  const wrappedJoinRoom = useCallback(
    async (...args: Parameters<typeof joinRoom>) => {
      clearRoomMessages();
      const room = await joinRoom(...args);
      requestRoomHistory();
      history.pushState(null, "", "/room/" + room.id);
      return room;
    },
    [joinRoom, clearRoomMessages, requestRoomHistory]
  );

  const wrappedSpectateRoom = useCallback(
    async (roomId: string) => {
      clearRoomMessages();
      const room = await spectateRoom(roomId);
      requestRoomHistory();
      history.pushState(null, "", "/room/" + room.id);
      return room;
    },
    [spectateRoom, clearRoomMessages, requestRoomHistory]
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

  const announceDialog = (
    <AnnounceDialog
      open={announceOpen}
      onClose={() => setAnnounceOpen(false)}
      onSubmit={(message) => {
        socket?.emit("system:announce", message, (result) => {
          if (result.success) {
            setAnnounceOpen(false);
            toast.success("공지를 전송했습니다");
          } else {
            toast.error(result.error ?? "공지 전송에 실패했습니다");
          }
        });
      }}
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
            isSpectating={isSpectating}
            onLeave={handleLeaveRoom}
            onLeaveImmediate={doLeaveRoom}
            onToggleReady={toggleReady}
            onUpdateGameOptions={updateGameOptions}
            onKickSpectators={kickSpectators}
            roomMessages={roomMessages}
            onSendRoomMessage={sendRoomMessage}
          />
        </main>
        <Footer githubRepoUrl={githubRepoUrl} />
        {confirmDialog}
        {announceDialog}
        <AnnouncementOverlay
          message={announcement?.message ?? null}
          receivedAt={announcement?.receivedAt ?? null}
          onClose={() => setAnnouncement(null)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar isConnected={isConnected} playerCount={playerCount} onlinePlayers={onlinePlayers} nickname={nickname} githubRepoUrl={githubRepoUrl} onGoHome={handleGoHome} onLogout={handleLogout} />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 pt-6 pb-8">
        <div className={`lg:grid lg:gap-6 ${activeTab === "lobby" ? "lg:grid-cols-[1fr_320px]" : ""}`}>
          <div className="space-y-8">
            {/* 탭 네비게이션 */}
            <div className="flex items-center gap-1 border-b border-border">
              <Link
                href="/lobby"
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "lobby"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                로비
              </Link>
              <Link
                href="/request"
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
              </Link>
              {isAdmin && (
                <button
                  onClick={() => setAnnounceOpen(true)}
                  className="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-colors"
                >
                  공지하기
                </button>
              )}
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
                  </div>
                  <GameCardGrid onCreateRoom={wrappedCreateRoom} />
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">방 목록</h2>
                  <RoomList rooms={rooms} onJoinRoom={wrappedJoinRoom} onSpectateRoom={wrappedSpectateRoom} />
                </section>
              </>
            ) : (
              <RequestBoard
                requests={requests}
                onCreateRequest={createRequest}
                onAcceptRequest={acceptRequest}
                onRejectRequest={rejectRequest}
                onResolveRequest={resolveRequest}
                onStopRequest={stopRequest}
                onChangeLabelRequest={changeLabelRequest}
                onDeleteRequest={deleteRequest}
                isAdmin={isAdmin}
              />
            )}
          </div>

          {activeTab === "lobby" && (
            <aside className="mt-8 lg:mt-0 flex flex-col gap-4">
              <div className="h-[400px]">
                <ChatPanel
                  messages={lobbyMessages}
                  onSendMessage={sendLobbyMessage}
                  placeholder="로비 채팅..."
                  myNickname={nickname ?? undefined}
                  isAdmin={isAdmin}
                  onDeleteMessage={(messageId) => deleteMessage("lobby", messageId)}
                />
              </div>
              <LobbyRankingPanel
                myNickname={nickname ?? ""}
                socket={socket}
                isAdmin={isAdmin}
              />
            </aside>
          )}
        </div>
      </main>
      <Footer githubRepoUrl={githubRepoUrl} />
      {announceDialog}
      <AnnouncementOverlay
        message={announcement?.message ?? null}
        receivedAt={announcement?.receivedAt ?? null}
        onClose={() => setAnnouncement(null)}
      />
    </div>
  );
}
