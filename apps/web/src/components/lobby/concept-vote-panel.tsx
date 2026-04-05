"use client";

import { useState, useEffect, useCallback } from "react";
import { Heart, ExternalLink } from "lucide-react";
import { getBrowserId } from "@/lib/socket";
import type { GameSocket } from "@/lib/socket";
import type { ConceptVoteSummary } from "@game-hub/shared-types";

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ||
  (typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:3001`
    : "http://localhost:3001");

const CONCEPTS = [
  { file: "1-retro-arcade.html", label: "Retro Arcade" },
  { file: "2-kawaii-pastel.html", label: "Kawaii Pastel" },
  { file: "3-terminal-hacker.html", label: "Terminal Hacker" },
  { file: "4-gradient-glass.html", label: "Gradient Glass" },
  { file: "5-neo-tokyo.html", label: "Neo Tokyo" },
  { file: "6-clay-3d.html", label: "Clay 3D" },
];

interface ConceptVotePanelProps {
  socket: GameSocket | null;
}

export function ConceptVotePanel({ socket }: ConceptVotePanelProps) {
  const [votes, setVotes] = useState<Record<string, string[]>>({});
  const browserId = typeof window !== "undefined" ? getBrowserId() : "";

  useEffect(() => {
    if (!socket) return;
    socket.emit("concept-vote:get", browserId, (data: ConceptVoteSummary) => setVotes(data.votes));
    const handler = (data: ConceptVoteSummary) => setVotes(data.votes);
    socket.on("concept-vote:updated", handler);
    return () => {
      socket.off("concept-vote:updated", handler);
    };
  }, [socket, browserId]);

  const toggle = useCallback(
    (file: string) => {
      socket?.emit("concept-vote:toggle", file, browserId, () => {});
    },
    [socket, browserId],
  );

  const openPreview = useCallback((file: string) => {
    window.open(`${SOCKET_URL}/concepts/${file}`, "_blank");
  }, []);

  return (
    <div className="rounded-lg border border-border bg-card/80 p-3">
      <h3 className="text-xs font-bold text-muted-foreground mb-2 font-[family-name:var(--font-display)] uppercase tracking-wider">
        디자인 투표
      </h3>
      <div className="space-y-1">
        {CONCEPTS.map(({ file, label }) => {
          const voters = votes[file] ?? [];
          const myVote = voters.includes(browserId);
          return (
            <div key={file} className="flex items-center gap-2 text-sm">
              <button
                onClick={() => toggle(file)}
                className={`shrink-0 transition-colors ${myVote ? "text-neon-pink" : "text-muted-foreground hover:text-neon-pink/70"}`}
              >
                <Heart className={`w-3.5 h-3.5 ${myVote ? "fill-current" : ""}`} />
              </button>
              <span className="text-xs text-muted-foreground w-4 text-center tabular-nums">{voters.length}</span>
              <span className="flex-1 truncate text-sm">{label}</span>
              <button
                onClick={() => openPreview(file)}
                className="text-muted-foreground hover:text-neon-cyan transition-colors shrink-0"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
