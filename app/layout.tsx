import type { Metadata, Viewport } from "next";
import Script from "next/script";
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
      {/* Google Search Console */}
      <meta name="google-site-verification" content="rmvYBT4SaAmKV1KI2rZyDvEGoOqlrDjBnWdbsjoQDMc" />

      {/* Meta Pixel */}
      <Script id="meta-pixel" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window,document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '1543620777027992');
          fbq('track', 'PageView');
        `}
      </Script>
      <noscript>
        <img height="1" width="1" style={{display:"none"}}
          src="https://www.facebook.com/tr?id=1543620777027992&ev=PageView&noscript=1"
        />
      </noscript>

      {/* Google Analytics */}
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-WHGVYW7YVG"
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-WHGVYW7YVG');
        `}
      </Script>
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
