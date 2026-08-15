import type { Metadata } from "next";
import { Manrope, Inter } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-display",
  weight: ["500", "700", "800"],
});

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-body",
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
      <body className={`${manrope.variable} ${inter.variable} font-body`}>
        {children}
      </body>
    </html>
  );
}
