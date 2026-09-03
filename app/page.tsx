"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { dict, type Lang } from "@/lib/i18n";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { getUpcomingSessions, type SessionSummary } from "@/lib/sessions";

const QR_PATTERN = [1, 0, 1, 1, 0, 0, 1, 0, 0, 1, 1, 1, 0, 1, 1, 0, 0, 1, 0, 0, 1, 0, 1, 1, 0];

const EXAM_TYPES = [
  {
    code: "НЗМ",
    color: "gold" as const,
    steps: { kk: "4 кезең", ru: "4 этапа" },
    title: { kk: "НЗМ", ru: "НИШ" },
    questions: 180,
    minutes: 240,
    subjects: {
      kk: ["Математика", "Сандық сипаттама", "Жаратылыстану", "Тілдер"],
      ru: ["Математика", "Количественные характеристики", "Естествознание", "Языки"],
    },
  },
  {
    code: "БИЛ",
    color: "mint" as const,
    steps: { kk: "2 кезең", ru: "2 этапа" },
    title: { kk: "БИЛ", ru: "БИЛ" },
    questions: 60,
    minutes: 110,
    subjects: {
      kk: ["Математика", "Оқу сауаттылығы"],
      ru: ["Математика", "Грамотность чтения"],
    },
  },
  {
    code: "РФММ",
    color: "clay" as const,
    steps: { kk: "1 кезең", ru: "1 этап" },
    title: { kk: "РФММ", ru: "РФМШ" },
    questions: 30,
    minutes: 120,
    subjects: {
      kk: ["Математика (сандық жауаптар)"],
      ru: ["Математика (числовые ответы)"],
    },
  },
];

const COLOR_CLASSES = {
  gold: { border: "border-t-gold", text: "text-gold-deep" },
  mint: { border: "border-t-mint", text: "text-mint" },
  clay: { border: "border-t-clay", text: "text-clay" },
};

function QrMock() {
  return (
    <div className="grid h-16 w-16 grid-cols-5 grid-rows-5 gap-0.5 rounded-lg bg-ink p-1.5">
      {QR_PATTERN.map((on, i) => (
        <div key={i} className={`rounded-[1px] ${on ? "bg-gold" : "bg-parchment"}`} />
      ))}
    </div>
  );
}

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
      {/* header */}
      <header className="sticky top-0 z-40 border-b border-ink/10 bg-parchment/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2">
            <img src="/logo.jpg" alt="Ziro" className="h-8 w-8 rounded-lg object-cover" />
            <span className="font-display text-xl font-bold tracking-tight text-ink">
              zi<span className="text-gold-deep">ro</span>
            </span>
          </div>
          <div className="flex items-center gap-6">
            <LanguageSwitcher lang={lang} onChange={setLang} />
            <Link
              href="/login"
              className="focus-ring rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-ink shadow-[0_6px_16px_rgba(198,154,58,0.28)] transition-transform hover:-translate-y-0.5"
            >
              {t.ctaSecondary}
            </Link>
          </div>
        </div>
      </header>

      {/* hero */}
      <section className="bg-gradient-to-b from-ink to-ink-soft">
        <div className="mx-auto grid max-w-6xl gap-14 px-6 py-20 sm:grid-cols-2 sm:items-center sm:py-28">
          <div>
            <div className="mb-5 flex items-center gap-2.5 font-mono text-xs uppercase tracking-widest text-gold">
              <span className="h-px w-5 bg-gold" />
              {t.heroEyebrow}
            </div>
            <h1 className="font-display text-4xl font-bold leading-tight text-parchment sm:text-[44px]">
              {t.heroTitle}
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-[#C7CEDB]">{t.heroBody}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/register"
                className="focus-ring rounded-lg bg-gold px-6 py-3 text-sm font-bold text-ink shadow-[0_6px_16px_rgba(198,154,58,0.28)] transition-transform hover:-translate-y-0.5"
              >
                {t.ctaPrimary}
              </Link>
              <a
                href="#exam-types"
                className="focus-ring rounded-lg border border-parchment/35 px-5 py-3 text-sm font-semibold text-parchment hover:border-parchment/70"
              >
                {t.stepsTitle} →
              </a>
            </div>
          </div>

          <div className="flex justify-center">
            <div
              className="w-full max-w-[320px] rounded-2xl bg-white p-6 text-ink shadow-[0_30px_60px_-18px_rgba(0,0,0,0.5),0_0_0_1px_rgba(198,154,58,0.25)]"
              style={{ transform: "rotate(-4deg)" }}
            >
              <div className="mb-4 flex items-start justify-between">
                <span className="font-display text-sm font-bold">ziro</span>
                <span className="rounded-md bg-gold px-2.5 py-1 font-mono text-[10.5px] font-semibold tracking-wide text-ink">
                  РҰҚСАТ ҚАҒАЗЫ
                </span>
              </div>
              <p className="font-display text-lg font-semibold">Айдана Серікова</p>
              <p className="mb-4 font-mono text-[11.5px] text-ink/50">Оқушы ID · ZR-19042</p>
              <hr className="my-4 border-dashed border-ink/15" />
              <div className="flex items-end justify-between">
                <div className="flex flex-col gap-3">
                  <div>
                    <p className="font-mono text-[10.5px] uppercase tracking-wide text-ink/40">Тест түрі</p>
                    <p className="text-sm font-bold">БИЛ · Офлайн</p>
                  </div>
                  <div>
                    <p className="font-mono text-[10.5px] uppercase tracking-wide text-ink/40">Күні / Аудитория</p>
                    <p className="text-sm font-bold">14.09 · 204</p>
                  </div>
                </div>
                <QrMock />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* upcoming sessions (real data) */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="font-display text-2xl font-bold text-ink">{t.testsTitle}</h2>
        <div className="mt-6 flex flex-col gap-3">
          {loaded && sessions.length === 0 && <p className="text-sm text-ink/50">{t.noSessions}</p>}
          {sessions.map((s) => {
            const today = new Date().toISOString().slice(0, 10);
            const isOpen =
              (!s.registrationOpensAt || today >= s.registrationOpensAt) &&
              (!s.registrationClosesAt || today <= s.registrationClosesAt);
            const isUpcoming = !isOpen && s.registrationOpensAt && today < s.registrationOpensAt;
            return (
              <div
                key={s.sessionId}
                className="flex flex-col justify-between gap-4 rounded-2xl border border-ink/10 bg-white p-6 shadow-sm transition-shadow hover:shadow-md sm:flex-row sm:items-center"
              >
                <div>
                  <p className="font-display text-lg font-bold text-ink">
                    {lang === "kk" ? s.titleKk : s.titleRu}
                  </p>
                  <p className="mt-1 text-sm text-ink/50">{s.sessionDate}</p>
                  <p className="mt-1 font-mono text-xs text-ink/40">
                    {isOpen
                      ? `${t.registrationWindowLabel}: ${s.registrationOpensAt ?? "—"} — ${s.registrationClosesAt ?? "—"}`
                      : isUpcoming
                      ? (lang === "kk"
                          ? `Тіркеу басталады: ${s.registrationOpensAt}`
                          : `Регистрация откроется: ${s.registrationOpensAt}`)
                      : t.registrationClosed}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-wrap justify-end">
                  {s.hasResults && (
                    <Link
                      href={`/result/${s.sessionId}`}
                      className="focus-ring rounded-full border border-parent px-4 py-2.5 text-sm font-semibold text-parent hover:bg-parent-soft"
                    >
                      {lang === "kk" ? "Нәтижелер" : "Результаты"}
                    </Link>
                  )}
                  <span className="font-display text-lg font-bold text-gold-deep">
                    {s.price.toLocaleString("ru-RU")} ₸
                  </span>
                  <button
                    onClick={() => isOpen && router.push("/register")}
                    disabled={!isOpen}
                    className="focus-ring rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-parchment shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:bg-ink/20 disabled:text-ink/50 disabled:shadow-none"
                  >
                    {isOpen ? t.ctaPrimary : t.registrationClosed}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* exam types */}
      <section id="exam-types" className="mx-auto max-w-6xl px-6 py-16">
        <div className="mb-12 max-w-xl">
          <p className="mb-3 font-mono text-xs uppercase tracking-widest text-gold-deep">
            {t.examTypesLabel}
          </p>
          <h2 className="font-display text-[31px] font-bold leading-tight text-ink">
            {t.examTypesTitle}
          </h2>
          <p className="mt-3 text-base leading-relaxed text-ink/60">{t.examTypesDesc}</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          {EXAM_TYPES.map((e) => {
            const c = COLOR_CLASSES[e.color];
            return (
              <div
                key={e.code}
                className={`rounded-2xl border border-ink/10 border-t-[3px] ${c.border} bg-white p-7 transition-transform hover:-translate-y-1 hover:shadow-lg`}
              >
                <p className={`mb-3 font-mono text-xs font-semibold tracking-wide ${c.text}`}>
                  {e.code} · {e.steps[lang]}
                </p>
                <p className="mb-3 font-display text-lg font-semibold text-ink">{e.title[lang]}</p>
                <div className="mb-4 flex gap-4 font-mono text-[11.5px] text-ink/50">
                  <div>
                    {lang === "kk" ? "Сұрақ" : "Вопросов"}
                    <b className="block font-body text-[15px] font-bold text-ink">{e.questions}</b>
                  </div>
                  <div>
                    {lang === "kk" ? "Уақыт" : "Время"}
                    <b className="block font-body text-[15px] font-bold text-ink">{e.minutes} мин</b>
                  </div>
                </div>
                <ul className="flex flex-col gap-1.5 text-[13.5px] leading-relaxed text-ink/60">
                  {e.subjects[lang].map((s) => (
                    <li key={s}>— {s}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* how it works */}
      <div className="border-y border-ink/[0.06] bg-white">
        <div className="mx-auto grid max-w-6xl sm:grid-cols-4">
          {[
            [t.step1Title, t.step1Desc],
            [t.step2Title, t.step2Desc],
            [t.step3Title, t.step3Desc],
            [t.step4Title, t.step4Desc],
          ].map(([title, desc], i) => (
            <div
              key={i}
              className={`p-9 ${i > 0 ? "border-t border-ink/[0.08] sm:border-l sm:border-t-0" : ""}`}
            >
              <p className="mb-4 font-mono text-[13px] font-semibold text-gold-deep">
                {String(i + 1).padStart(2, "0")}
              </p>
              <p className="mb-2.5 font-display text-base font-semibold text-ink">{title}</p>
              <p className="text-[13.5px] leading-relaxed text-ink/60">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ranking */}
      <section className="bg-parchment px-6 py-20">
        <div className="mx-auto grid max-w-6xl gap-14 sm:grid-cols-2 sm:items-center">
          <div>
            <p className="mb-3 font-mono text-xs uppercase tracking-widest text-gold-deep">
              {t.rankingLabel}
            </p>
            <h2 className="mb-4 font-display text-[31px] font-bold leading-tight text-ink">
              {t.rankingTitle}
            </h2>
            <p className="max-w-md text-[15.5px] leading-relaxed text-ink/60">{t.rankingDesc}</p>
            <ul className="mt-6 flex flex-col gap-4">
              {[t.rankingPoint1, t.rankingPoint2, t.rankingPoint3].map((p, i) => (
                <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-ink">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gold" />
                  {p}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-[0_30px_60px_-18px_rgba(22,35,63,0.18),0_0_0_1px_rgba(22,35,63,0.06)]">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-display text-[15px] font-semibold text-ink">
                {lang === "kk" ? "Математика · Рейтинг" : "Математика · Рейтинг"}
              </span>
              <span className="font-mono text-[10.5px] text-ink/50">
                180 {lang === "kk" ? "қатысушы" : "участников"}
              </span>
            </div>
            {[
              ["01", "#14829", "98%", false],
              ["02", "#10933", "95%", false],
              ["03", "#19042", "91%", true],
              ["04", "#22140", "89%", false],
              ["05", "#08471", "85%", false],
            ].map(([rank, code, score, me]) => (
              <div
                key={rank as string}
                className={`mt-0.5 grid grid-cols-[32px_1fr_auto] items-center gap-3 rounded-lg px-3 py-2.5 ${
                  me ? "border border-gold/40 bg-gold/10" : ""
                }`}
              >
                <span className={`font-mono text-[12.5px] ${me ? "font-bold text-gold-deep" : "text-ink/40"}`}>
                  {rank}
                </span>
                <span className={`font-mono text-[13.5px] ${me ? "font-bold text-ink" : "text-ink/80"}`}>
                  {code}
                  {me && (
                    <span className="ml-2 rounded bg-gold px-1.5 py-0.5 font-mono text-[9.5px] font-bold tracking-wide text-ink">
                      СІЗ
                    </span>
                  )}
                </span>
                <span className="font-display text-sm font-semibold text-ink">{score}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* trust / no-AI + advice */}
      <section className="bg-ink px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <p className="mb-3 font-mono text-xs uppercase tracking-widest text-gold">{t.insightLabel}</p>
          <h2 className="font-display text-[31px] font-bold text-parchment">{t.insightTitle}</h2>
          <p className="mt-3 text-base text-[#B9C1D0]">{t.insightDesc}</p>

          <div className="mt-11 grid gap-6 sm:grid-cols-2">
            <div className="rounded-2xl border border-parchment/[0.08] bg-ink-soft p-7">
              <span className="mb-4 inline-block rounded-md border border-gold/40 px-2.5 py-1 font-mono text-[11px] tracking-wide text-gold">
                {t.insightCard1Badge}
              </span>
              <p className="mb-3 font-display text-lg font-semibold text-parchment">{t.insightCard1Title}</p>
              <p className="text-[14.5px] leading-relaxed text-[#B9C1D0]">{t.insightCard1Desc}</p>
            </div>
            <div className="rounded-2xl border border-parchment/[0.08] bg-ink-soft p-7">
              <span className="mb-4 inline-block rounded-md border border-gold/40 px-2.5 py-1 font-mono text-[11px] tracking-wide text-gold">
                {t.insightCard2Badge}
              </span>
              <p className="mb-3 font-display text-lg font-semibold text-parchment">{t.insightCard2Title}</p>
              <p className="text-[14.5px] leading-relaxed text-[#B9C1D0]">{t.insightCard2Desc}</p>
            </div>
          </div>
        </div>
      </section>

      {/* stat bar */}
      <div className="border-t border-parchment/[0.08] bg-ink-soft text-parchment">
        <div className="mx-auto grid max-w-6xl grid-cols-1 py-11 sm:grid-cols-3">
          {[
            ["3", t.trustStat1],
            ["2", t.trustStat2],
            ["1 мин", t.trustStat3],
          ].map(([num, label], i) => (
            <div
              key={i}
              className={`px-5 text-center ${i > 0 ? "border-t border-parchment/[0.12] pt-4 sm:border-l sm:border-t-0 sm:pt-0" : ""}`}
            >
              <p className="font-display text-2xl font-bold text-gold">{num}</p>
              <p className="mt-1.5 text-[13px] text-[#B9C1D0]">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <footer className="border-t border-parchment/[0.08] bg-ink py-9">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 text-[13px] text-[#8B94A8]">
          <span>{t.footerNote}</span>
          <LanguageSwitcher lang={lang} onChange={setLang} />
        </div>
      </footer>
    </main>
  );
}
