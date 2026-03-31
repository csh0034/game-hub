import { Gamepad2 } from "lucide-react";

interface FooterProps {
  githubRepoUrl?: string;
}

export function Footer({ githubRepoUrl }: FooterProps) {
  return (
    <footer className="border-t border-border bg-card/50 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Gamepad2 className="w-4 h-4 text-neon-cyan/50" />
            <span className="font-[family-name:var(--font-display)] tracking-wide text-neon-cyan/40">GAME HUB</span>
            <span className="mx-1 text-border">|</span>
            <span>웹 기반 멀티플레이 게임 허브</span>
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {githubRepoUrl && (
              <a
                href={githubRepoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-neon-cyan transition-colors"
              >
                GitHub
              </a>
            )}
            <span>&copy; {new Date().getFullYear()} GAME HUB</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
