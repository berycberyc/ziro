"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { dict, type Lang } from "@/lib/i18n";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import TestSessionCard from "@/components/TestSessionCard";
import { getUpcomingSessions, type SessionSummary } from "@/lib/sessions";

export default function Home() {
  const [lang, setLang] = useState<Lang>("kk");
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const t = dict[lang];
  const router = useRouter();

  useEffect(() => {
    getUpcomingSessions().then((data) => {
      setSessions(data);
      setLoaded(true);
    });
  }, []);

  return (
    <main className="min-h-screen bg-parchment">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <img src="/logo.jpg" alt="Ziro" className="h-9 w-9 rounded-lg object-cover" />
          <span className="font-display text-2xl font-extrabold tracking-tight text-ink">
            Ziro
          </span>
        </div>
        <LanguageSwitcher lang={lang} onChange={setLang} />
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-16 pt-10 sm:pt-16">
        <p className="text-sm font-semibold uppercase tracking-widest text-gold">
          {t.tagline}
        </p>
        <h1 className="mt-4 max-w-3xl font-display text-4xl font-extrabold leading-tight text-ink sm:text-5xl">
          {t.heroTitle}
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-ink/70">
          {t.heroBody}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/register"
            className="focus-ring rounded-full bg-ink px-6 py-3 text-sm font-semibold text-parchment transition-opacity hover:opacity-90"
          >
            {t.ctaPrimary}
          </Link>
          <Link
            href="/login"
            className="focus-ring rounded-full border border-ink/15 bg-white px-6 py-3 text-sm font-semibold text-ink transition-colors hover:bg-ink/5"
          >
            {t.ctaSecondary}
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <h2 className="font-display text-2xl font-bold text-ink">{t.testsTitle}</h2>
        <div className="mt-6 flex flex-col gap-4">
          {loaded && sessions.length === 0 && (
            <p className="text-sm text-ink/50">{t.noSessions}</p>
          )}
          {sessions.map((s) => (
            <TestSessionCard
              key={s.sessionId}
              title={lang === "kk" ? s.titleKk : s.titleRu}
              date={s.sessionDate}
              price={`${s.price.toLocaleString("ru-RU")} ₸`}
              typesNote={s.testTypeCodes
                .map((code) => t.testNames[code as keyof typeof t.testNames] ?? code)
                .join(" · ")}
              bookLabel={t.book}
              onBook={() => router.push("/register")}
            />
          ))}
        </div>
      </section>

      <footer className="border-t border-ink/10 py-8">
        <p className="mx-auto max-w-6xl px-6 text-xs text-ink/50">{t.footerNote}</p>
      </footer>
    </main>
  );
}
