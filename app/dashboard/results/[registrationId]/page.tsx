"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { fetchAll } from "@/lib/fetchAll";
import { useLang } from "@/lib/LangContext";
import { SUBJECT_LABELS, type SubjectKey } from "@/lib/questions/subjects";

/**
 * Ата-ана көретін нәтиже.
 *
 * Ресми НИШ/БИЛ парақтарының құрылымы қайталанады — ата-ана таныс форматты
 * көреді. Бір айырмашылық, әрі ең пайдалысы: тақырыптар бойынша талдау.
 * Ресми парақтарда ол жоқ, сондықтан «нені істеу керек» деген сұрақ
 * жауапсыз қалады.
 *
 * Дұрыс жауап кілті де, қай сұраққа қалай жауап бергені де көрсетілмейді —
 * тек тақырып деңгейіндегі талдау.
 */

type Published = {
  zipgrade_id: string;
  place: number;
  total_score: number;
  breakdown: any;
  topics: { subject: string; topic: string; correct: number; total: number }[];
};

type Row = { zipgrade_id: string; place: number; total_score: number; breakdown: any };

const NIS_ORDER = [
  { key: "math", label: "Математика", max: 400 },
  { key: "sandyq", label: "Сандық сипаттамалар", max: 300 },
  { key: "zharatylystanu", label: "Жаратылыстану", max: 200 },
  { key: "tilder_kk", label: "Қазақ тілі", max: 200 },
  { key: "tilder_ru", label: "Орыс тілі", max: 200 },
  { key: "tilder_en", label: "Ағылшын тілі", max: 200 },
];

const BIL_ORDER = [
  { key: "bil_math", label: "Математика-логика" },
  { key: "bil_reading", label: "Оқу сауаттылығы" },
];

export default function ResultsPage() {
  const params = useParams();
  const registrationId = params.registrationId as string;
  const { t } = useLang();

  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"mine" | "all">("mine");
  const [studentName, setStudentName] = useState("");
  const [testTypeCode, setTestTypeCode] = useState<string>("");
  const [mine, setMine] = useState<Published | null>(null);
  const [all, setAll] = useState<Row[]>([]);
  // Нәтиже жарияланған ба — «әлі дайын емес» пен «тапсырмаған» екеуін
  // ажырату үшін керек. Бұрын екеуіне бірдей хабарлама шығатын.
  const [published, setPublished] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);

      const { data: reg } = await supabase
        .from("registrations")
        .select("test_session_id, student_id, test_types ( code )")
        .eq("id", registrationId)
        .single();
      if (!reg) {
        setLoading(false);
        return;
      }
      const code = (reg as any).test_types?.code ?? "";
      setTestTypeCode(code);

      const { data: student } = await supabase
        .from("students")
        .select("full_name, zipgrade_id")
        .eq("id", (reg as any).student_id)
        .single();
      setStudentName(student?.full_name ?? "");

      const { data: sess } = await supabase
        .from("test_sessions")
        .select("results_published_at")
        .eq("id", (reg as any).test_session_id)
        .single();
      setPublished(Boolean((sess as any)?.results_published_at));

      try {
        const rows = await fetchAll<Published>((from, to) =>
          supabase
            .from("published_results")
            .select("zipgrade_id, place, total_score, breakdown, topics")
            .eq("test_session_id", (reg as any).test_session_id)
            .eq("test_type_code", code)
            .order("place")
            .range(from, to)
        );
        setAll(rows);
        setMine(rows.find((r) => r.zipgrade_id === student?.zipgrade_id) ?? null);
      } catch (err) {
        console.error("Results failed to load:", err);
      }
      setLoading(false);
    }
    load();
  }, [registrationId]);

  if (loading) return <p className="mt-6 text-sm text-ink/50">{t.loading}</p>;

  if (!mine) {
    // Нәтиже жарияланған, бірақ бұл баланың жолы жоқ — демек тестке кірмеген.
    // Ата-анаға «әлі дайын емес» деу дұрыс емес: ол бекер күтіп жүреді.
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="font-display text-2xl font-bold text-ink">{t.resultsTitle}</h1>
        {published ? (
          <div className="mt-4 rounded-2xl border border-clay/30 bg-clay/5 px-4 py-4">
            <p className="text-sm font-semibold text-ink">{t.resultsNotTaken}</p>
            <p className="mt-2 text-sm leading-relaxed text-ink/60">{t.resultsNotTakenNote}</p>
          </div>
        ) : (
          <p className="mt-4 rounded-2xl bg-ink/5 px-4 py-3 text-sm text-ink/60">
            {t.resultsNotReady}
          </p>
        )}
        <Link href="/dashboard/bookings" className="mt-4 inline-block text-sm text-parent hover:underline">
          ← {t.backToBookings}
        </Link>
      </div>
    );
  }

  const b = mine.breakdown ?? {};

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="font-display text-2xl font-bold text-ink">{t.resultsTitle}</h1>

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => setView("mine")}
          className={`focus-ring rounded-full px-5 py-2 text-sm font-semibold ${
            view === "mine" ? "bg-parent text-white" : "bg-parent-soft text-parent"
          }`}
        >
          {t.resultsMine}
        </button>
        <button
          onClick={() => setView("all")}
          className={`focus-ring rounded-full px-5 py-2 text-sm font-semibold ${
            view === "all" ? "bg-parent text-white" : "bg-parent-soft text-parent"
          }`}
        >
          {t.resultsAll}
        </button>
      </div>

      {view === "mine" ? (
        <>
          {/* Шапка: орын бірінші жолда — ресми парақтағыдай */}
          <div className="mt-5 overflow-hidden rounded-2xl border border-ink/10 bg-white">
            <Line label={t.resultsPlace} value={`${mine.place} / ${all.length}`} strong />
            <Line label={t.fullNameLabel} value={studentName} />
            <Line label={t.testTypeLabel} value={testTypeCode} />
          </div>

          {/* ---- НИШ ---- */}
          {testTypeCode === "NIS" && (
            <div className="mt-4 overflow-hidden rounded-2xl border border-ink/10 bg-white">
              <SectionHeader text={t.resultsDay1} />
              {NIS_ORDER.slice(0, 3).map((s) => (
                <ScoreLine key={s.key} label={s.label} max={s.max} data={b.subjects?.[s.key]} />
              ))}
              <Line label={`${t.resultsTotal} (900)`} value={String(b.day1 ?? 0)} strong />

              <SectionHeader text={t.resultsDay2} />
              {NIS_ORDER.slice(3).map((s) => (
                <ScoreLine key={s.key} label={s.label} max={s.max} data={b.subjects?.[s.key]} />
              ))}
              <Line label={`${t.resultsTotal} (600)`} value={String(b.day2 ?? 0)} strong />

              <Line
                label={`${t.resultsFinalScore} (1500)`}
                value={String(mine.total_score)}
                strong
              />
              <Line
                label={t.resultsThreshold}
                value={
                  (b.below ?? []).length === 0
                    ? t.resultsThresholdOk
                    : `${t.resultsThresholdFail}: ${(b.below ?? [])
                        .map((k: string) => NIS_ORDER.find((s) => s.key === k)?.label ?? k)
                        .join(", ")}`
                }
                danger={(b.below ?? []).length > 0}
                strong
              />
            </div>
          )}

          {/* ---- БИЛ ---- */}
          {testTypeCode === "BIL" && (
            <div className="mt-4 overflow-hidden rounded-2xl border border-ink/10 bg-white">
              {BIL_ORDER.map((s) => {
                const p = b.parts?.[s.key] ?? {};
                return (
                  <div key={s.key}>
                    <SectionHeader text={s.label} />
                    <Line label={t.resultsCorrect} value={String(p.correct ?? 0)} />
                    <Line label={t.resultsWrong} value={String(p.wrong ?? 0)} />
                    <Line label={t.resultsBlank} value={String(p.blank ?? 0)} />
                    <Line label={t.resultsScore} value={String(p.score ?? 0)} strong />
                  </div>
                );
              })}
              <SectionHeader text={t.resultsTotal} />
              <Line label={t.resultsCorrect} value={String(b.correct ?? 0)} />
              <Line label={t.resultsWrong} value={String(b.wrong ?? 0)} />
              <Line label={t.resultsBlank} value={String(b.blank ?? 0)} />
              <Line
                label={`${t.resultsFinalScore} (${b.max ?? 240})`}
                value={String(mine.total_score)}
                strong
              />
            </div>
          )}

          {/* ---- РФМШ ---- */}
          {testTypeCode === "RFMS" && (
            <div className="mt-4 overflow-hidden rounded-2xl border border-ink/10 bg-white">
              {(b.bands ?? []).map((band: any) => (
                <Line
                  key={band.from}
                  label={`${band.from}–${band.to} ${t.resultsQuestions}`}
                  value={`${band.correct} / ${band.to - band.from + 1}`}
                />
              ))}
              <Line label={t.resultsCorrect} value={String(b.correct ?? 0)} />
              <Line label={t.resultsWrong} value={String(b.wrong ?? 0)} />
              <Line label={t.resultsBlank} value={String(b.blank ?? 0)} />
              <Line
                label={`${t.resultsFinalScore} (${b.max ?? 150})`}
                value={String(mine.total_score)}
                strong
              />
            </div>
          )}

          {/* ---- Тақырыптар: ресми парақтарда жоқ, ең пайдалы бөлік ---- */}
          {mine.topics && mine.topics.length > 0 && (
            <div className="mt-5">
              <h2 className="font-display text-lg font-bold text-ink">{t.resultsTopics}</h2>
              <p className="mt-1 text-sm text-ink/60">{t.resultsTopicsNote}</p>
              <div className="mt-3 flex flex-col gap-2">
                {mine.topics.map((tp, i) => {
                  const share = tp.total > 0 ? tp.correct / tp.total : 0;
                  return (
                    <div
                      key={i}
                      className="rounded-xl border border-ink/10 bg-white px-4 py-3"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm font-medium text-ink">{tp.topic}</span>
                        <span className="font-mono text-sm text-ink/60">
                          {tp.correct} / {tp.total}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/10">
                        <div
                          className={`h-full rounded-full ${
                            share < 0.5 ? "bg-clay" : share < 0.8 ? "bg-gold" : "bg-parent"
                          }`}
                          style={{ width: `${Math.round(share * 100)}%` }}
                        />
                      </div>
                      <p className="mt-1 font-mono text-[11px] text-ink/40">
                        {SUBJECT_LABELS[tp.subject as SubjectKey] ?? tp.subject}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-2xl border border-ink/10 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-ink/5 font-mono text-xs text-ink/50">
              <tr>
                <th className="px-3 py-2">{t.resultsPlace}</th>
                <th className="px-3 py-2">ID</th>
                {testTypeCode === "NIS" &&
                  NIS_ORDER.map((s) => (
                    <th key={s.key} className="px-3 py-2 text-right">
                      {s.label}
                    </th>
                  ))}
                {testTypeCode === "BIL" &&
                  BIL_ORDER.map((s) => (
                    <th key={s.key} className="px-3 py-2 text-right">
                      {s.label}
                    </th>
                  ))}
                {testTypeCode === "RFMS" && (
                  <>
                    <th className="px-3 py-2 text-right">1–10</th>
                    <th className="px-3 py-2 text-right">11–20</th>
                    <th className="px-3 py-2 text-right">21–30</th>
                  </>
                )}
                <th className="px-3 py-2 text-right">{t.resultsFinalScore}</th>
              </tr>
            </thead>
            <tbody>
              {all.map((r) => {
                const isMine = r.zipgrade_id === mine.zipgrade_id;
                const rb = r.breakdown ?? {};
                return (
                  <tr
                    key={r.zipgrade_id}
                    className={`border-t border-ink/5 ${isMine ? "bg-parent-soft font-semibold" : ""}`}
                  >
                    <td className="px-3 py-1.5 font-mono">{r.place}</td>
                    <td className="px-3 py-1.5 font-mono">{r.zipgrade_id}</td>
                    {testTypeCode === "NIS" &&
                      NIS_ORDER.map((s) => (
                        <td key={s.key} className="px-3 py-1.5 text-right font-mono">
                          {rb.subjects?.[s.key]?.score ?? 0}
                        </td>
                      ))}
                    {testTypeCode === "BIL" &&
                      BIL_ORDER.map((s) => (
                        <td key={s.key} className="px-3 py-1.5 text-right font-mono">
                          {rb.parts?.[s.key]?.score ?? 0}
                        </td>
                      ))}
                    {testTypeCode === "RFMS" &&
                      (rb.bands ?? [{}, {}, {}]).map((band: any, i: number) => (
                        <td key={i} className="px-3 py-1.5 text-right font-mono">
                          {band.correct ?? 0}
                        </td>
                      ))}
                    <td className="px-3 py-1.5 text-right font-mono font-bold">{r.total_score}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Link
        href="/dashboard/bookings"
        className="mt-6 inline-block text-sm text-parent hover:underline"
      >
        ← {t.backToBookings}
      </Link>
    </div>
  );
}

function Line({
  label,
  value,
  strong,
  danger,
}: {
  label: string;
  value: string;
  strong?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-ink/5 px-4 py-2.5 first:border-t-0">
      <span className="text-sm text-ink/60">{label}</span>
      <span
        className={`font-mono text-sm ${strong ? "font-bold" : ""} ${
          danger ? "text-clay" : "text-ink"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function ScoreLine({ label, max, data }: { label: string; max: number; data: any }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-ink/5 px-4 py-2.5">
      <span className="text-sm text-ink/60">
        {label} <span className="text-ink/30">({max})</span>
      </span>
      <span className="flex items-baseline gap-3">
        <span className="font-mono text-sm font-semibold text-ink">{data?.score ?? 0}</span>
        {data?.pct != null && (
          <span className="w-14 text-right font-mono text-xs text-ink/40">{data.pct}%</span>
        )}
      </span>
    </div>
  );
}

function SectionHeader({ text }: { text: string }) {
  return (
    <div className="border-t border-ink/5 bg-parchment px-4 py-2 font-display text-xs font-bold uppercase tracking-wide text-ink/50">
      {text}
    </div>
  );
}
