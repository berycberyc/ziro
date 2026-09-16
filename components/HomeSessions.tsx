"use client";

import { useState } from "react";
import Link from "next/link";
import { dict, type Lang } from "@/lib/i18n";
import type { SessionSummary } from "@/lib/sessions";

/**
 * Басты беттегі тесттер блогы. Үш топ:
 *   «Қазір ашық» — брондау қазір жүріп жатыр (ерекшеленеді);
 *   «Алдағы»     — тест әлі болмаған, бірақ брондау ашылмаған не жабылған;
 *   «Өткен»      — тест күні өтті; тек нәтижелер. Соңғы 3-еуі көрінеді,
 *                  қалғаны «Барлығы» түймесінің астында.
 */

const PAST_VISIBLE = 3;

const MONTHS_KK = ["қаңтар", "ақпан", "наурыз", "сәуір", "мамыр", "маусым", "шілде", "тамыз", "қыркүйек", "қазан", "қараша", "желтоқсан"];
// «21 қазанда», «3 қыркүйекте», «5 сәуірде» — жатыс септігі.
const MONTHS_KK_LOC = ["қаңтарда", "ақпанда", "наурызда", "сәуірде", "мамырда", "маусымда", "шілдеде", "тамызда", "қыркүйекте", "қазанда", "қарашада", "желтоқсанда"];
const MONTHS_RU_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

function parts(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return { y, m, d };
}

/** «18 қазан» / «18 октября». Жыл биылғы болмаса — жылымен. */
export function humanDate(iso: string, lang: Lang, locative = false): string {
  const { y, m, d } = parts(iso);
  const month = lang === "kk" ? (locative ? MONTHS_KK_LOC : MONTHS_KK)[m - 1] : MONTHS_RU_GEN[m - 1];
  const year = y !== new Date().getFullYear() ? ` ${y}` : "";
  if (lang === "kk" && locative && year) return `${y} жылғы ${d} ${month}`;
  return `${d} ${month}${year}`;
}

/** Пайдаланушы уақыты бойынша бүгінгі күн, «YYYY-MM-DD». */
function todayIso(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${mm}-${dd}`;
}

export function groupSessions(sessions: SessionSummary[]) {
  const today = todayIso();
  const open: SessionSummary[] = [];
  const upcoming: SessionSummary[] = [];
  const past: SessionSummary[] = [];

  for (const s of sessions) {
    if (s.sessionDate < today) {
      past.push(s);
      continue;
    }
    const started = !s.registrationOpensAt || today >= s.registrationOpensAt;
    const notEnded = !s.registrationClosesAt || today <= s.registrationClosesAt;
    if (started && notEnded) open.push(s);
    else upcoming.push(s);
  }

  open.sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));
  upcoming.sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));
  past.sort((a, b) => b.sessionDate.localeCompare(a.sessionDate));
  return { open, upcoming, past, today };
}

function RankingIcon() {
  return (
    <svg width="26" height="18" viewBox="0 0 30 22" aria-hidden="true" className="shrink-0">
      <rect x="0" y="10" width="8" height="12" rx="1.5" fill="#2451B0" opacity="0.55" />
      <rect x="11" y="2" width="8" height="20" rx="1.5" fill="#C69A3A" />
      <rect x="22" y="14" width="8" height="8" rx="1.5" fill="#16233F" opacity="0.25" />
    </svg>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2.5 text-sm font-semibold text-ink/55">{children}</p>;
}

export default function HomeSessions({
  sessions,
  loaded,
  lang,
  bookHref,
}: {
  sessions: SessionSummary[];
  loaded: boolean;
  lang: Lang;
  bookHref: string;
}) {
  const t = dict[lang];
  const [showAllPast, setShowAllPast] = useState(false);
  const { open, upcoming, past, today } = groupSessions(sessions);
  const visiblePast = showAllPast ? past : past.slice(0, PAST_VISIBLE);

  if (loaded && sessions.length === 0) {
    return <p className="mt-6 text-sm text-ink/50">{t.noSessions}</p>;
  }

  return (
    <div className="mt-6 flex flex-col gap-8">
      {open.length > 0 && (
        <div>
          <GroupLabel>{t.sessionsOpen}</GroupLabel>
          <div className="flex flex-col gap-3">
            {open.map((s) => (
              <div
                key={s.sessionId}
                className="flex flex-col justify-between gap-4 rounded-2xl border-2 border-gold bg-white p-6 shadow-[0_10px_30px_-12px_rgba(198,154,58,0.35)] sm:flex-row sm:items-center"
              >
                <div>
                  <p className="font-display text-2xl font-bold text-ink">{humanDate(s.sessionDate, lang)}</p>
                  <p className="mt-1 text-sm text-ink/60">
                    {s.registrationClosesAt && (
                      <>
                        {t.bookingLastDay} — {humanDate(s.registrationClosesAt, lang)}
                        <span className="mx-2 text-ink/30">·</span>
                      </>
                    )}
                    {s.price.toLocaleString("ru-RU")} теңге
                  </p>
                </div>
                <Link
                  href={bookHref}
                  className="focus-ring self-start rounded-full bg-gold px-6 py-3 text-sm font-bold text-ink shadow-[0_6px_16px_rgba(198,154,58,0.28)] transition-transform hover:-translate-y-0.5 sm:self-auto"
                >
                  {t.bookSeat}
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div>
          <GroupLabel>{t.sessionsUpcoming}</GroupLabel>
          <div className="flex flex-col gap-3">
            {upcoming.map((s) => {
              const notYetOpen = s.registrationOpensAt && today < s.registrationOpensAt;
              let note = "";
              if (notYetOpen) note = t.bookingOpensOn(humanDate(s.registrationOpensAt!, lang, true));
              else if (s.registrationClosesAt) note = t.bookingEnded(humanDate(s.registrationClosesAt, lang, true));
              return (
                <div
                  key={s.sessionId}
                  className="flex flex-col justify-between gap-2 rounded-2xl border border-ink/10 bg-white px-6 py-4 sm:flex-row sm:items-center"
                >
                  <p className="font-display text-lg font-bold text-ink">{humanDate(s.sessionDate, lang)}</p>
                  {note && <p className="text-sm text-ink/55">{note}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <GroupLabel>{t.sessionsPast}</GroupLabel>
          <div className="flex flex-col gap-3">
            {visiblePast.map((s) => (
              <div
                key={s.sessionId}
                className="flex flex-col justify-between gap-3 rounded-2xl border border-ink/10 bg-white px-6 py-4 sm:flex-row sm:items-center"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <p className="font-display text-base font-semibold text-ink/70">{humanDate(s.sessionDate, lang)}</p>
                  {s.hasResults ? (
                    <span className="rounded-md bg-mint/10 px-2.5 py-1 text-xs font-semibold text-mint">
                      {t.resultsOut}
                    </span>
                  ) : (
                    <span className="text-xs text-ink/45">{t.resultsPending}</span>
                  )}
                </div>
                {s.hasResults && (
                  <Link
                    href={`/result/${s.sessionId}`}
                    className="focus-ring inline-flex items-center gap-2.5 self-start rounded-full border border-ink/15 bg-white px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-gold hover:bg-gold/5 sm:self-auto"
                  >
                    <RankingIcon />
                    {t.viewRanking}
                  </Link>
                )}
              </div>
            ))}
          </div>
          {past.length > PAST_VISIBLE && (
            <button
              type="button"
              onClick={() => setShowAllPast((v) => !v)}
              aria-expanded={showAllPast}
              className="focus-ring mt-3 rounded-full px-4 py-2 text-sm font-semibold text-ink/60 hover:bg-ink/5 hover:text-ink"
            >
              {showAllPast ? t.sessionsShowLess : `${t.sessionsShowAll} (${past.length})`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
