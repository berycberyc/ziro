import type { Metadata, Viewport } from "next";
import { Manrope, IBM_Plex_Mono } from "next/font/google";
import { LangProvider } from "@/lib/LangContext";
import "katex/dist/katex.min.css";
import "./globals.css";

const manropeDisplay = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-display",
  weight: ["700", "800"],
});

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700", "800"],
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin", "cyrillic"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Ziro — байқау тесттерге тіркелу порталы",
  description: "Ziro: НЗМ, БИЛ, РФММ байқау тесттері — тіркелу, төлем, нәтижелер",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Ziro",
    statusBarStyle: "default",
  },
  other: {
    // appleWebApp ескірген apple-mobile-web-app-capable метасын қосады,
    // Chrome оның орнына мынаны күтеді.
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#16233F",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="kk">
      <body className={`${manropeDisplay.variable} ${manrope.variable} ${plexMono.variable} font-body`}>
        <LangProvider>{children}</LangProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(() => {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
