"use client";

import { useState, useEffect } from "react";
import { Gamepad2, Users, Wifi, WifiOff } from "lucide-react";

interface NavbarProps {
  isConnected: boolean;
  playerCount: number;
}

export function Navbar({ isConnected, playerCount }: NavbarProps) {
  const [nickname, setNickname] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("game-hub-nickname");
    if (saved) setNickname(saved);
  }, []);

  const saveNickname = (value: string) => {
    const trimmed = value.trim().slice(0, 20);
    if (trimmed) {
      setNickname(trimmed);
      localStorage.setItem("game-hub-nickname", trimmed);
      // Re-emit nickname on socket
      import("@/lib/socket").then(({ getSocket }) => {
        const socket = getSocket();
        if (socket.connected) {
          socket.emit("player:set-nickname", trimmed);
        }
      });
    }
    setIsEditing(false);
  };

  return (
    <nav className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <a href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-primary to-purple-500 rounded-lg flex items-center justify-center">
              <Gamepad2 className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
              Game Hub
            </span>
          </a>

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

            {isEditing ? (
              <input
                type="text"
                defaultValue={nickname}
                autoFocus
                maxLength={20}
                className="bg-secondary border border-border rounded-md px-3 py-1.5 text-sm w-40 focus:outline-none focus:ring-1 focus:ring-primary"
                onBlur={(e) => saveNickname(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveNickname(e.currentTarget.value);
                  if (e.key === "Escape") setIsEditing(false);
                }}
              />
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="bg-secondary hover:bg-secondary/80 border border-border rounded-md px-3 py-1.5 text-sm transition-colors"
              >
                {nickname || "닉네임 설정"}
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
