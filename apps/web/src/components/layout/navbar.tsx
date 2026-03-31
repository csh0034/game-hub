"use client";

import { Gamepad2, LogOut, Users, Wifi, WifiOff } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

interface OnlinePlayer {
  nickname: string;
  connectedAt: number;
  isAdmin?: boolean;
}

interface NavbarProps {
  isConnected: boolean;
  playerCount: number;
  onlinePlayers?: OnlinePlayer[];
  nickname: string;
  githubRepoUrl?: string;
  onGoHome?: () => void;
  onLogout?: () => void;
}


export function Navbar({ isConnected, playerCount, onlinePlayers = [], nickname, githubRepoUrl, onGoHome, onLogout }: NavbarProps) {
  return (
    <nav className="border-b border-border bg-card/90 backdrop-blur-xl sticky top-0 z-50 neon-glow-cyan">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <button
              onClick={onGoHome}
              className="flex items-center gap-3 group"
            >
              <div className="w-9 h-9 bg-gradient-to-br from-neon-cyan to-neon-purple rounded-lg flex items-center justify-center shadow-[0_0_12px_rgba(0,229,255,0.3)] group-hover:shadow-[0_0_20px_rgba(0,229,255,0.5)] transition-shadow">
                <Gamepad2 className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold font-[family-name:var(--font-display)] bg-gradient-to-r from-neon-cyan via-primary to-neon-purple bg-clip-text text-transparent text-glow-cyan tracking-wide">
                GAME HUB
              </span>
            </button>
            {githubRepoUrl ? (
              <a
                href={githubRepoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-neon-cyan transition-colors"
              >
                v{process.env.NEXT_PUBLIC_APP_VERSION}
                <span className="ml-1 opacity-60">({process.env.NEXT_PUBLIC_COMMIT_HASH})</span>
              </a>
            ) : (
              <span className="text-xs text-muted-foreground">
                v{process.env.NEXT_PUBLIC_APP_VERSION}
                <span className="ml-1 opacity-60">({process.env.NEXT_PUBLIC_COMMIT_HASH})</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="flex items-center gap-2 text-sm text-muted-foreground cursor-default">
                <Users className="w-4 h-4" />
                <span>{playerCount} <span className="text-neon-cyan/70">ONLINE</span></span>
              </div>
              {onlinePlayers.length > 0 && (
                <div className="absolute top-full right-0 mt-2 w-72 bg-card border border-neon-cyan/20 rounded-lg shadow-[0_0_20px_rgba(0,229,255,0.1)] py-2 px-3 hidden group-hover:block z-50">
                  <p className="text-xs font-medium text-muted-foreground mb-1.5 font-[family-name:var(--font-display)] uppercase tracking-wider">Players</p>
                  <ul className="space-y-0.5">
                    {onlinePlayers.map((player) => (
                      <li key={player.nickname} className="text-sm text-foreground flex items-center justify-between gap-2">
                        <span className={`truncate ${player.isAdmin ? "text-neon-pink font-bold" : ""}`}>{player.nickname}</span>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(player.connectedAt)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isConnected ? (
                <Wifi className="w-4 h-4 text-neon-green" />
              ) : (
                <WifiOff className="w-4 h-4 text-destructive" />
              )}
            </div>

            <span className="bg-secondary border border-neon-cyan/20 rounded-md px-3 py-1.5 text-sm font-medium text-neon-cyan/90">
              {nickname}
            </span>

            <button
              onClick={onLogout}
              className="p-1.5 rounded-md text-muted-foreground hover:text-neon-pink hover:bg-neon-pink/10 transition-colors"
              aria-label="로그아웃"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
