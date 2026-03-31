"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { HelpCircle } from "lucide-react";
import { useGame } from "@/hooks/use-game";
import { useGameStore } from "@/stores/game-store";
import { getSocket } from "@/lib/socket";
import { GameHelpDialog } from "@/components/common/game-help-dialog";
import { OpponentTypingBoard } from "./opponent-typing-board";
import type {
  TypingPublicState,
  TypingWord,
  TypingPlayerState,
  TypingTickResult,
} from "@game-hub/shared-types";

const COUNTDOWN_SECONDS = 3;

interface TypingBoardProps {
  roomId: string;
  isSpectating?: boolean;
}

// 낙하 단어 컴포넌트 — Web Animations API + transform으로 GPU 가속 낙하
function FallingWord({ word }: { word: TypingWord }) {
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = divRef.current;
    if (!el) return;
    const board = el.offsetParent as HTMLElement | null;
    if (!board) return;
    const boardH = board.clientHeight;
    const now = Date.now();
    const elapsed = (now - word.spawnedAt) / 1000;
    const total = word.fallDurationMs / 1000;
    const remaining = Math.max(total - elapsed, 0);
    const startY = Math.min(elapsed / total, 1) * boardH;

    const anim = el.animate(
      [
        { transform: `translateX(-50%) translateY(${startY}px)` },
        { transform: `translateX(-50%) translateY(${boardH}px)` },
      ],
      { duration: remaining * 1000, fill: "forwards", easing: "linear" },
    );
    return () => anim.cancel();
  }, [word.spawnedAt, word.fallDurationMs]);

  return (
    <div
      ref={divRef}
      className="absolute top-0 pointer-events-none"
      style={{ left: `${word.x}%`, transform: "translateX(-50%)" }}
    >
      <span className="inline-block bg-gradient-to-b from-neon-cyan to-neon-purple text-white px-3.5 py-1 rounded-full font-bold text-base tracking-widest shadow-[0_0_12px_rgba(0,229,255,0.4)] whitespace-nowrap border border-primary/30" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}>
        {word.text}
      </span>
    </div>
  );
}

// 플레이어 상태 카드
function PlayerCard({
  player,
  isMe,
}: {
  player: TypingPlayerState;
  isMe: boolean;
}) {
  const isDead = player.status === "gameover";
  return (
    <div
      className={`flex items-center justify-between p-2.5 rounded-xl border text-sm transition-all ${
        isDead
          ? "border-accent/20 bg-accent/5 opacity-50"
          : isMe
            ? "border-primary/40 bg-primary/5"
            : "border-border/50 bg-card/50"
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className={`font-medium truncate ${isDead ? "line-through text-muted-foreground" : ""}`}>
          {isMe ? `${player.nickname} (나)` : player.nickname}
        </span>
        {isDead && <span className="text-accent text-xs font-bold">탈락</span>}
      </div>
      <div className="flex items-center gap-3 text-xs tabular-nums shrink-0">
        <span title="점수" className="font-semibold text-primary">{player.score.toLocaleString()}</span>
        <span title="목숨">
          {player.lives > 0 ? `❤️x${player.lives}` : "💀"}
        </span>
        {player.combo >= 3 && (
          <span title="콤보" className="text-neon-yellow font-bold">{player.combo}x</span>
        )}
      </div>
    </div>
  );
}

export default function TypingBoard({ roomId: _roomId, isSpectating }: TypingBoardProps) {
  const socket = getSocket();
  const { gameResult, makeMove } = useGame(socket);
  const gameState = useGameStore((s) => s.gameState) as TypingPublicState | null;

  // 로컬 단어 목록 (서버 이벤트로 관리)
  const [words, setWords] = useState<TypingWord[]>([]);
  // 상대방 / 전체 플레이어 단어 목록
  const [allPlayerWords, setAllPlayerWords] = useState<Record<string, TypingWord[]>>({});
  const [players, setPlayers] = useState<Record<string, TypingPlayerState>>({});
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<{ type: "miss" | "typo"; id: number } | null>(null);
  const [remainingTime, setRemainingTime] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRowRef = useRef<HTMLDivElement>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const myId = socket?.id ?? "";

  const initializedRef = useRef(false);

  // 소켓 이벤트 리스너
  useEffect(() => {
    if (!socket) return;

    const initFromState = (typingState: TypingPublicState, skipCountdown = false) => {
      if (!typingState.players) return;
      initializedRef.current = true;
      setPlayers(typingState.players);
      setWords([]);
      setInput("");
      setFeedback(null);
      // 관전자가 중간 입장 시 카운트다운 건너뛰기
      setCountdown(skipCountdown ? null : COUNTDOWN_SECONDS);
      // 모든 플레이어의 단어 목록 초기화
      const emptyWords: Record<string, TypingWord[]> = {};
      for (const id of Object.keys(typingState.players)) {
        emptyWords[id] = [];
      }
      setAllPlayerWords(emptyWords);
    };

    const onStarted = (state: unknown) => {
      const typingState = state as TypingPublicState;
      // countingDown이 false이면 이미 카운트다운이 끝난 게임 (관전자 중간 입장)
      const skipCountdown = !typingState.countingDown;
      initFromState(typingState, skipCountdown);
    };

    const onStateUpdated = (state: unknown) => {
      const typingState = state as TypingPublicState;
      // 카운트다운 완료 후 서버가 startedAt을 재설정하여 state-updated를 보냄
      if (typingState.startedAt) {
        setCountdown(null);
      }
    };

    const onTickResult = (data: TypingTickResult) => {
      // 새 단어 스폰 처리
      if (data.spawnedWords.length > 0) {
        const now = Date.now();
        const adjusted = data.spawnedWords.map((w) => ({ ...w, spawnedAt: now }));
        if (!isSpectating) {
          setWords((prev) => [...prev, ...adjusted]);
        }
        setAllPlayerWords((prev) => {
          const next = { ...prev };
          for (const id of Object.keys(next)) {
            next[id] = [...(next[id] ?? []), ...adjusted];
          }
          return next;
        });
      }

      // 놓친 단어 처리
      for (const [playerId, wordIds] of Object.entries(data.missed)) {
        const idSet = new Set(wordIds);
        setAllPlayerWords((prev) => {
          const playerWords = prev[playerId];
          if (!playerWords) return prev;
          return { ...prev, [playerId]: playerWords.filter((w) => !idSet.has(w.id)) };
        });
        if (playerId === myId) {
          setWords((prev) => prev.filter((w) => !idSet.has(w.id)));
          setFeedback({ type: "miss", id: Date.now() });
          if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
          feedbackTimerRef.current = setTimeout(() => setFeedback(null), 800);
          requestAnimationFrame(() => inputRef.current?.focus());
        }
      }

      // 변경된 플레이어 상태 처리
      for (const [playerId, player] of Object.entries(data.updatedPlayers)) {
        setPlayers((prev) => ({ ...prev, [playerId]: player }));
      }
    };

    const onWordCleared = (data: { playerId: string; wordId: number }) => {
      // 상대방 단어 목록에서 제거 (내 단어는 클라이언트에서 이미 즉시 제거됨)
      setAllPlayerWords((prev) => {
        const playerWords = prev[data.playerId];
        if (!playerWords) return prev;
        return { ...prev, [data.playerId]: playerWords.filter((w) => w.id !== data.wordId) };
      });
    };

    const onAllPlayerWords = (data: Record<string, TypingWord[]>) => {
      // 관전 입장 시 현재 모든 플레이어 단어 초기화 (서버 spawnedAt 유지하여 실제 위치 반영)
      setAllPlayerWords(data);
    };

    const onPlayerUpdated = (data: { playerId: string; player: TypingPlayerState }) => {
      setPlayers((prev) => ({ ...prev, [data.playerId]: data.player }));
    };

    const onEnded = () => {
      // 게임 종료 시 단어 클리어
      setWords([]);
      setAllPlayerWords({});
      setFeedback(null);
    };

    socket.on("game:started", onStarted);
    socket.on("game:state-updated", onStateUpdated);
    socket.on("game:typing-tick-result", onTickResult);
    socket.on("game:typing-word-cleared", onWordCleared);
    socket.on("game:typing-all-player-words", onAllPlayerWords);
    socket.on("game:typing-player-updated", onPlayerUpdated);
    socket.on("game:ended", onEnded);

    // lazy 로드 컴포넌트가 game:started 이벤트를 놓칠 수 있으므로
    // 마운트 시점에 이미 도착한 gameState가 있으면 초기화
    const current = useGameStore.getState().gameState as TypingPublicState | null;
    if (current?.players && !initializedRef.current) {
      initFromState(current, !current.countingDown);
    }

    return () => {
      initializedRef.current = false;
      socket.off("game:started", onStarted);
      socket.off("game:state-updated", onStateUpdated);
      socket.off("game:typing-tick-result", onTickResult);
      socket.off("game:typing-word-cleared", onWordCleared);
      socket.off("game:typing-all-player-words", onAllPlayerWords);
      socket.off("game:typing-player-updated", onPlayerUpdated);
      socket.off("game:ended", onEnded);
    };
  }, [socket, myId, isSpectating]);

  // 카운트다운 타이머
  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    const timer = setTimeout(() => {
      setCountdown((prev) => (prev !== null && prev > 1 ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // 남은 시간 카운트다운
  const typingBaseRef = useRef<{ localStart: number; key: number } | null>(null);
  const allDead = Object.values(players).length > 0 && Object.values(players).every((p) => p.status === "gameover");

  useEffect(() => {
    if (!gameState?.startedAt || countdown !== null || allDead) return;
    if (!typingBaseRef.current || typingBaseRef.current.key !== gameState.startedAt) {
      typingBaseRef.current = { localStart: Date.now(), key: gameState.startedAt };
    }
    const updateTimer = () => {
      const elapsed = Date.now() - typingBaseRef.current!.localStart;
      const remaining = Math.max(gameState.timeLimit - Math.floor(elapsed / 1000), 0);
      setRemainingTime(remaining);
    };
    updateTimer();
    const timer = setInterval(updateTimer, 200);
    return () => clearInterval(timer);
  }, [gameState?.startedAt, gameState?.timeLimit, countdown, allDead]);

  // 단어 제출 처리 — DOM에서 직접 값 읽어 한글 IME 조합 상태와 무관하게 동작
  const doSubmit = useCallback(() => {
    const trimmed = (inputRef.current?.value ?? "").trim();
    if (!trimmed || isSpectating) return;

    const myPlayer = players[myId];
    if (!myPlayer || myPlayer.status !== "playing") return;

    // 클라이언트 사이드 정답 판정 (즉각적 피드백)
    const matchIndex = words.findIndex((w) => w.text === trimmed);
    if (matchIndex !== -1) {
      // 정답 — 즉시 화면에서 제거
      setWords((prev) => prev.filter((w) => w.text !== trimmed));
    } else {
      // 오타 피드백 + 입력창 흔들기
      setFeedback({ type: "typo", id: Date.now() });
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = setTimeout(() => setFeedback(null), 800);
      const row = formRowRef.current;
      if (row) {
        row.style.animation = "none";
        void row.offsetHeight; // reflow 강제
        row.style.animation = "typing-shake 0.3s ease-in-out";
      }
    }

    makeMove({ type: "submit", word: trimmed });
    setInput("");
    if (inputRef.current) inputRef.current.value = "";
  }, [isSpectating, players, myId, words, makeMove]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      doSubmit();
    },
    [doSubmit],
  );

  // 한글 IME에서 Enter 시 form submit이 안 될 수 있으므로 keyDown에서 직접 처리
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.nativeEvent.isComposing) {
        e.preventDefault();
        doSubmit();
      }
    },
    [doSubmit],
  );

  // 자동 포커스 — 카운트다운 종료 후 및 피드백 발생 후에도 유지
  useEffect(() => {
    if (!isSpectating && !gameResult && countdown === null) {
      inputRef.current?.focus();
    }
  }, [isSpectating, gameResult, countdown]);


  // 게임 시작 시 화면 맨 위로 스크롤
  useEffect(() => {
    if (countdown === COUNTDOWN_SECONDS) {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [countdown]);

  const myPlayer = players[myId];
  const isDead = myPlayer?.status === "gameover";
  const isGameOver = !!gameResult;

  // 상대 플레이어 목록 (점수 높은 순)
  const otherPlayers = useMemo(() => {
    return Object.values(players)
      .filter((p) => p.id !== myId)
      .sort((a, b) => b.score - a.score);
  }, [players, myId]);

  // 관전자 모드: 전체 순위판
  const allPlayersSorted = useMemo(() => {
    return Object.values(players).sort((a, b) => b.score - a.score);
  }, [players]);

  // 멀티플레이 여부
  const isMultiplayer = Object.keys(players).length > 1;

  if (!gameState) return null;

  const isCountingDown = countdown !== null && countdown > 0;

  // 관전자 뷰: 모든 플레이어 미니 보드를 그리드로 표시
  if (isSpectating) {
    const cols = Math.min(allPlayersSorted.length, 2);
    return (
      <div className="flex flex-col gap-4 p-4">
        {/* 상단 정보바 */}
        <div className="flex items-center justify-between bg-card border border-border/50 rounded-xl px-5 py-2.5 neon-glow-cyan">
          <div className="flex items-center gap-4 text-sm">
            <div className={`flex items-center gap-1.5 font-mono font-bold tabular-nums ${!isCountingDown && remainingTime <= 10 ? "text-accent animate-pulse" : "text-foreground"}`}>
              <span className="text-lg">⏱</span>
              <span className="text-lg">{isCountingDown ? gameState.timeLimit : remainingTime}</span>
              <span className="text-xs text-muted-foreground">초</span>
            </div>
            <div className="w-px h-5 bg-border" />
            <span className="text-xs px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground font-display font-medium tracking-wide">
              {gameState.difficulty === "beginner" ? "초급" : gameState.difficulty === "intermediate" ? "중급" : "고급"}
            </span>
          </div>
        </div>

        {isCountingDown ? (
          <div className="flex flex-col items-center justify-center h-64 bg-gradient-to-b from-background to-card border border-border/40 rounded-xl neon-border">
            <div
              key={countdown}
              className="text-9xl font-display font-black text-primary drop-shadow-[0_0_30px_rgba(0,229,255,0.5)]"
              style={{ animation: "typing-countdown-pulse 0.6s ease-out" }}
            >
              {countdown}
            </div>
            <div className="mt-4 text-muted-foreground text-sm font-display font-medium tracking-wider">준비하세요!</div>
          </div>
        ) : isGameOver ? (
          <div className="flex items-center justify-center min-h-[16rem] bg-gradient-to-b from-background to-card border border-border/40 rounded-xl neon-border">
            <div className="typing-result-enter text-center w-full max-w-sm mx-4 py-6">
              <div className="mb-6">
                <div className="text-5xl mb-3">
                  {gameResult.winnerId === null ? "🤝" : "🏆"}
                </div>
                <div className="text-2xl font-display font-black tracking-tight">
                  {gameResult.winnerId === null
                    ? "무승부!"
                    : `${players[gameResult.winnerId ?? ""]?.nickname ?? "???"} 승리!`}
                </div>
              </div>
              <div className="bg-card/60 border border-border/50 rounded-2xl p-3 space-y-2">
                {allPlayersSorted.map((p, i) => {
                  const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`;
                  const isFirst = i === 0;
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-sm ${
                        isFirst
                          ? "bg-primary/10 border border-primary/30 font-bold"
                          : "bg-secondary/30"
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <span className={`${i < 3 ? "text-lg" : "text-muted-foreground w-[28px] text-center"}`}>{medal}</span>
                        <span className="truncate">{p.nickname}</span>
                      </span>
                      <span className="tabular-nums shrink-0 text-muted-foreground">
                        <span className={isFirst ? "text-primary" : "text-foreground"}>{p.score.toLocaleString()}</span>
                        <span className="text-xs ml-1">점</span>
                        <span className="text-xs ml-2 text-muted-foreground">{p.wordsCleared}개</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div
            className="grid gap-4 justify-center"
            style={{ gridTemplateColumns: `repeat(${cols}, auto)` }}
          >
            {allPlayersSorted.map((p) => (
              <OpponentTypingBoard
                key={p.id}
                words={allPlayerWords[p.id] ?? []}
                player={p}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-full">
      {/* 메인 게임 영역 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 상단 정보바 */}
        <div className="flex items-center justify-between bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-700/50 rounded-xl px-5 py-2.5 mb-3 shadow-lg">
          <div className="flex items-center gap-5 text-sm">
            <div className={`flex items-center gap-1.5 font-mono font-bold tabular-nums ${!isCountingDown && remainingTime <= 10 ? "text-accent animate-pulse" : "text-foreground"}`}>
              <span className="text-lg">⏱</span>
              <span className="text-lg">{isCountingDown ? gameState.timeLimit : remainingTime}</span>
              <span className="text-xs text-muted-foreground">초</span>
            </div>
            {myPlayer && (
              <>
                <div className="w-px h-5 bg-border" />
                <div className="flex items-center gap-1.5">
                  <span className="text-xl font-bold text-primary tabular-nums">{myPlayer.score.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground">점</span>
                </div>
                <div className="w-px h-5 bg-border" />
                <span className="text-base">
                  {myPlayer.lives > 0
                    ? Array.from({ length: myPlayer.lives }, (_, i) => <span key={i}>❤️</span>)
                    : "💀"}
                </span>
                {myPlayer.combo >= 3 && (
                  <>
                    <div className="w-px h-5 bg-border" />
                    <span className="text-neon-yellow font-bold text-base tabular-nums">{myPlayer.combo}x<span className="text-xs ml-0.5 font-normal text-neon-yellow/70">콤보</span></span>
                  </>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground font-display font-medium tracking-wide">
              {gameState.difficulty === "beginner" ? "초급" : gameState.difficulty === "intermediate" ? "중급" : "고급"}
            </span>
            <button
              onClick={() => setShowHelp(true)}
              className="text-muted-foreground hover:text-primary transition-colors"
              title="게임 도움말"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 단어 낙하 영역 */}
        <div className="relative flex-1 bg-gradient-to-b from-background via-card to-background border border-border/40 rounded-xl overflow-hidden min-h-[400px] shadow-inner neon-border">
          {/* 위험 구역 그라데이션 (하단) */}
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-red-900/25 to-transparent pointer-events-none z-[1]" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-red-500/30 z-[1]" />

          {/* 단어들 — 게임 종료 시 숨김 */}
          {!isGameOver &&
            words.map((word) => (
              <FallingWord key={word.id} word={word} />
            ))}

          {/* 놓침/오타 피드백 라벨 */}
          {feedback && !isGameOver && (
            <div
              key={feedback.id}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none z-10"
              style={{ animation: "typing-flash 0.5s ease-out 2" }}
            >
              <span className={`px-4 py-1.5 rounded-full text-xs font-bold shadow-lg ${
                feedback.type === "miss"
                  ? "bg-red-500/90 text-white shadow-red-500/30"
                  : "bg-neon-yellow/90 text-primary-foreground shadow-neon-yellow/30"
              }`}>
                {feedback.type === "miss" ? "놓침! -❤️" : "오타!"}
              </span>
            </div>
          )}

          {/* 카운트다운 오버레이 — 게임 영역 내부 */}
          {isCountingDown && (
            <div className="absolute inset-0 bg-background/85 backdrop-blur-sm flex flex-col items-center justify-center z-30">
              <div
                key={countdown}
                className="text-9xl font-display font-black text-primary drop-shadow-[0_0_30px_rgba(0,229,255,0.5)]"
                style={{ animation: "typing-countdown-pulse 0.6s ease-out" }}
              >
                {countdown}
              </div>
              <div className="mt-4 text-muted-foreground text-sm font-display font-medium tracking-wider">준비하세요!</div>
            </div>
          )}

          {/* 탈락 오버레이 — 게임 결과가 나오면 숨김 */}
          {isDead && !isGameOver && (
            <div className="absolute inset-0 bg-background/85 backdrop-blur-sm flex items-center justify-center z-10">
              <div className="text-center">
                <div className="text-5xl font-display font-black text-accent mb-3 drop-shadow-[0_0_20px_rgba(255,45,111,0.4)] text-glow-pink">탈락!</div>
                <div className="text-muted-foreground text-sm">다른 플레이어의 진행을 지켜보세요</div>
              </div>
            </div>
          )}

          {/* 게임 결과 오버레이 */}
          {isGameOver && (
            <div className="absolute inset-0 bg-background/90 backdrop-blur-sm flex items-center justify-center z-20">
              <div className="typing-result-enter text-center w-full max-w-sm mx-4">
                {/* 헤더 */}
                <div className="mb-6">
                  <div className="text-5xl mb-3">
                    {allPlayersSorted.length === 1
                      ? "🏁"
                      : gameResult.winnerId === null
                        ? "🤝"
                        : gameResult.winnerId === myId
                          ? "🏆"
                          : "😢"}
                  </div>
                  <div className="text-2xl font-display font-black tracking-tight">
                    {allPlayersSorted.length === 1
                      ? "게임 종료!"
                      : gameResult.winnerId === null
                        ? "무승부!"
                        : gameResult.winnerId === myId
                          ? `${players[gameResult.winnerId ?? ""]?.nickname ?? "???"} 승리!`
                          : "패배..."}
                  </div>
                </div>
                {/* 순위 목록 */}
                <div className="bg-card/60 border border-border/50 rounded-2xl p-3 space-y-2">
                  {allPlayersSorted.map((p, i) => {
                    const isMe = p.id === myId;
                    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`;
                    return (
                      <div
                        key={p.id}
                        className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-colors ${
                          isMe
                            ? "bg-primary/10 border border-primary/30 font-bold"
                            : "bg-secondary/30"
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <span className={`${i < 3 ? "text-lg" : "text-muted-foreground w-[28px] text-center"}`}>{medal}</span>
                          <span className="truncate">{p.nickname}</span>
                        </span>
                        <span className="tabular-nums shrink-0 text-slate-400">
                          <span className={isMe ? "text-primary" : "text-foreground"}>{p.score.toLocaleString()}</span>
                          <span className="text-xs ml-1">점</span>
                          <span className="text-xs ml-2 text-muted-foreground">{p.wordsCleared}개</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 입력창 */}
        <form onSubmit={handleSubmit} className="mt-3">
          <div ref={formRowRef} className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isDead || isGameOver || isCountingDown}
              placeholder={isGameOver ? "게임 종료" : isDead ? "탈락했습니다" : isCountingDown ? "준비..." : "단어를 입력하세요..."}
              className="flex-1 px-5 py-3.5 bg-card border border-border/50 rounded-xl text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary/40 transition-all shadow-inner"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
            <button
              type="submit"
              disabled={isDead || isGameOver || isCountingDown}
              className="px-6 py-3.5 bg-gradient-to-r from-neon-cyan to-neon-purple text-primary-foreground rounded-xl font-display font-semibold tracking-wide disabled:opacity-40 hover:shadow-[0_0_20px_rgba(0,229,255,0.3)] transition-all shadow-lg shadow-primary/20"
            >
              입력
            </button>
          </div>
        </form>
      </div>

      {/* 사이드: 상대방 미니 보드 (멀티플레이 시) */}
      {isMultiplayer && otherPlayers.length > 0 && !isGameOver && (
        <div className="shrink-0 space-y-3">
          <h3 className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider mb-2">참가자</h3>
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: `repeat(${Math.min(otherPlayers.length, 2)}, auto)` }}
          >
            {otherPlayers.map((p) => (
              <OpponentTypingBoard
                key={p.id}
                words={allPlayerWords[p.id] ?? []}
                player={p}
              />
            ))}
          </div>
        </div>
      )}

      {/* 사이드: 플레이어 현황 (게임 결과 표시 시) */}
      {isMultiplayer && otherPlayers.length > 0 && isGameOver && (
        <div className="w-56 shrink-0 space-y-2">
          <h3 className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider mb-2">참가자</h3>
          {otherPlayers.map((p) => (
            <PlayerCard key={p.id} player={p} isMe={false} />
          ))}
        </div>
      )}

      <GameHelpDialog open={showHelp} onClose={() => setShowHelp(false)} title="타자 게임">
        <div>
          <h3 className="text-foreground font-semibold mb-1">게임 방법</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>위에서 단어가 내려오면 입력창에 타이핑하고 Enter로 제출</li>
            <li>정확히 일치하면 해당 단어가 제거된다</li>
            <li>시간이 지날수록 낙하 속도와 출현 빈도가 증가한다</li>
          </ul>
        </div>
        <div>
          <h3 className="text-foreground font-semibold mb-1">점수</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>2자: 100점, 3자: 200점, 4자: 350점, 5자: 500점</li>
            <li>연속 정답 시 콤보 증가, 5콤보마다 보너스 점수</li>
          </ul>
        </div>
        <div>
          <h3 className="text-foreground font-semibold mb-1">목숨</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>단어를 놓치면(하단 도달) 목숨 -1</li>
            <li>오타는 콤보만 초기화, 목숨은 줄지 않음</li>
            <li>목숨이 0이 되면 탈락</li>
          </ul>
        </div>
        <div>
          <h3 className="text-foreground font-semibold mb-1">승리 조건</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>제한 시간 종료 또는 전원 탈락 시 게임 종료</li>
            <li>최고 점수 플레이어가 승리</li>
          </ul>
        </div>
      </GameHelpDialog>
    </div>
  );
}
