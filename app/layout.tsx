import type { Metadata } from "next";
import { Unbounded, Manrope, IBM_Plex_Mono } from "next/font/google";
import { LangProvider } from "@/lib/LangContext";
import "katex/dist/katex.min.css";
import "./globals.css";

const unbounded = Unbounded({
  subsets: ["latin", "cyrillic"],
  variable: "--font-display",
  weight: ["500", "600", "700", "800"],
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
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="kk">
      <body className={`${unbounded.variable} ${manrope.variable} ${plexMono.variable} font-body`}>
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  );
}
