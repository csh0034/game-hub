"use client";

import { Gamepad2, LogOut, Users, Wifi, WifiOff } from "lucide-react";

interface NavbarProps {
  isConnected: boolean;
  playerCount: number;
  onlineNicknames?: string[];
  nickname: string;
  onGoHome?: () => void;
  onLogout?: () => void;
}

export function Navbar({ isConnected, playerCount, onlineNicknames = [], nickname, onGoHome, onLogout }: NavbarProps) {
  return (
    <nav className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <button
            onClick={onGoHome}
            className="flex items-center gap-3"
          >
            <div className="w-9 h-9 bg-gradient-to-br from-primary to-purple-500 rounded-lg flex items-center justify-center">
              <Gamepad2 className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
              Game Hub
            </span>
            <span className="text-xs text-muted-foreground">
              v{process.env.NEXT_PUBLIC_APP_VERSION}
              <span className="ml-1 opacity-60">({process.env.NEXT_PUBLIC_COMMIT_HASH})</span>
            </span>
          </button>

          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="flex items-center gap-2 text-sm text-muted-foreground cursor-default">
                <Users className="w-4 h-4" />
                <span>{playerCount} 온라인</span>
              </div>
              {onlineNicknames.length > 0 && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-popover/95 backdrop-blur-sm border border-border rounded-lg shadow-lg py-2 px-3 hidden group-hover:block z-50">
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">접속 중인 플레이어</p>
                  <ul className="space-y-0.5">
                    {onlineNicknames.map((name) => (
                      <li key={name} className="text-sm text-foreground truncate">{name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isConnected ? (
                <Wifi className="w-4 h-4 text-success" />
              ) : (
                <WifiOff className="w-4 h-4 text-destructive" />
              )}
            </div>

            <span className="bg-secondary border border-border rounded-md px-3 py-1.5 text-sm">
              {nickname}
            </span>

            <button
              onClick={onLogout}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
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
