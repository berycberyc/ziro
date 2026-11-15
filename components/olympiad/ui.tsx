"use client";

import { useLang } from "@/lib/LangContext";

/** Олимпиада беттеріне ортақ ұсақ бөлшектер. */

export function useL() {
  const { lang, setLang } = useLang();
  const L = (kk: string, ru: string) => (lang === "kk" ? kk : ru);
  return { lang, setLang, L };
}

export function Card({
  title,
  id,
  children,
}: {
  title?: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 rounded-3xl border border-ink/10 bg-white p-5 shadow-sm sm:p-6">
      {title && <h2 className="mb-4 font-display text-lg font-bold text-ink">{title}</h2>}
      {children}
    </section>
  );
}

export const inputCls =
  "focus-ring w-full rounded-xl border border-ink/15 px-3 py-2 text-sm disabled:bg-ink/5 disabled:text-ink/50";

export const primaryBtn =
  "focus-ring rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-ink shadow-[0_6px_16px_rgba(198,154,58,0.28)] transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0";

export const darkBtn =
  "focus-ring rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0";

export const ghostBtn =
  "focus-ring rounded-full border border-ink/15 px-5 py-2.5 text-sm font-semibold text-ink/70 hover:bg-parchment disabled:opacity-50";

export function Msg({ kind, children }: { kind: "ok" | "err" | "warn"; children: React.ReactNode }) {
  const cls =
    kind === "ok"
      ? "border-mint/30 bg-mint/10 text-mint"
      : kind === "err"
      ? "border-clay/30 bg-clay/10 text-clay"
      : "border-gold/40 bg-gold/10 text-ink/80";
  return <div className={`rounded-xl border px-4 py-3 text-sm ${cls}`}>{children}</div>;
}

export function ProblemList({ title, items, kind }: { title: string; items: string[]; kind: "err" | "warn" }) {
  if (!items.length) return null;
  return (
    <Msg kind={kind}>
      <p className="font-semibold">
        {title} ({items.length})
      </p>
      <ul className="mt-2 max-h-64 list-disc overflow-y-auto pl-5">
        {items.map((e, i) => (
          <li key={i}>{e}</li>
        ))}
      </ul>
    </Msg>
  );
}
