import type { Metadata } from "next";
import { Chakra_Petch, Noto_Sans_KR, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const chakraPetch = Chakra_Petch({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-chakra",
  display: "swap",
});

const notoSansKR = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jb-mono",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://54.180.133.95:3000/";
const SITE_TITLE = "GAME HUB";
const SITE_DESCRIPTION =
  "오목, 텍사스 홀덤, 테트리스 등 다양한 게임을 친구들과 함께! 웹 브라우저에서 바로 플레이하는 멀티플레이 게임 허브";

export const metadata: Metadata = {
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_TITLE}`,
  },
  description: SITE_DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_TITLE,
    locale: "ko_KR",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: SITE_TITLE,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className={`dark ${notoSansKR.variable} ${chakraPetch.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen antialiased">
        <Toaster
          position="top-right"
          theme="dark"
          toastOptions={{
            style: {
              background: "var(--color-card)",
              border: "1px solid rgba(0, 229, 255, 0.15)",
              color: "var(--color-foreground)",
              boxShadow: "0 0 15px rgba(0, 229, 255, 0.05)",
            },
          }}
        />
        {children}
      </body>
    </html>
  );
}
