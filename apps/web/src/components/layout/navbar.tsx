"use client";

import { Gamepad2, LogOut, Users, Wifi, WifiOff } from "lucide-react";

interface NavbarProps {
  isConnected: boolean;
  playerCount: number;
  nickname: string;
  onGoHome?: () => void;
  onLogout?: () => void;
}

export function Navbar({ isConnected, playerCount, nickname, onGoHome, onLogout }: NavbarProps) {
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
          </button>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="w-4 h-4" />
              <span>{playerCount} 온라인</span>
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
