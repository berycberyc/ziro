"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { fetchAll } from "@/lib/fetchAll";

/**
 * Жалпы нәтижелер — кіруді қажет етпейтін ашық бет.
 *
 * Тестке қатыспаған адам да QR-код немесе WhatsApp сілтемесі арқылы
 * жауаптардың не екенін жалпы бақылай алады. Аты-жөн жоқ — тек орын, ID,
 * пән бойынша баллдар. Дәл бір оқушыны тауып алу үшін ID керек, ол тек
 * сол оқушыда бар — бұл жеткілікті «псевдоанонимдік».
 *
 * published_results ашық оқылады (RLS: Anyone can view) — қосымша
 * эндпоинт не рұқсат өзгерісі талап етілмейді.
 */

type Row = {
  zipgrade_id: string;
  place: number;
  total_score: number;
  breakdown: any;
};

const NIS_COLS = [
  { key: "math", label: "Мат-лог" },
  { key: "sandyq", label: "Сандық" },
  { key: "zharatylystanu", label: "Жарат." },
  { key: "tilder", label: "Тілдер" },
  { key: "bil_math", label: "Мат-лог" },
  { key: "bil_reading", label: "Оқу" },
];

const BIL_COLS = [
  { key: "bil_math", label: "Математика" },
  { key: "bil_reading", label: "Оқу" },
];

const CODE_LABELS: Record<string, string> = {
  NIS: "НИШ",
  BIL: "БИЛ",
  RFMS: "РФМШ",
};

export default function PublicResultsPage() {
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [active, setActive] = useState("");
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);

      const { data: sess } = await supabase
        .from("test_sessions")
        .select("title_kk, session_date, has_results")
        .eq("id", id)
        .single();

      if (!sess?.has_results) {
        setLoading(false);
        return;
      }

      setTitle(sess.title_kk ?? "");
      setDate(sess.session_date ?? "");

      // Қандай тест түрлері бар — тізімнен аламыз.
      const { data: distinct } = await supabase
        .from("published_results")
        .select("test_type_code")
        .eq("test_session_id", id);

      const found = [...new Set((distinct ?? []).map((r: any) => r.test_type_code as string))].sort();
      setCodes(found);
      setActive((prev) => (found.includes(prev) ? prev : found[0] ?? ""));
      setLoading(false);
    }
    load();
  }, [id]);

  useEffect(() => {
    if (!active) return;
    setRows([]);
    fetchAll<Row>((from, to) =>
      supabase
        .from("published_results")
        .select("zipgrade_id, place, total_score, breakdown")
        .eq("test_session_id", id)
        .eq("test_type_code", active)
        .order("place")
        .range(from, to)
    ).then(setRows);
  }, [id, active]);

  if (loading) return <p className="mx-auto mt-20 max-w-2xl px-4 text-sm text-ink/50">Жүктелуде...</p>;

  if (codes.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-sm text-ink/50">Нәтиже әлі жарияланған жоқ.</p>
        <Link href="/" className="mt-4 inline-block text-sm text-parent hover:underline">← Басты бет</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/" className="text-sm text-ink/50 hover:underline">← Басты бет</Link>
      <h1 className="mt-3 font-display text-2xl font-bold text-ink">{title}</h1>
      <p className="mt-1 text-sm text-ink/50">{date}</p>

      {/* Тест түрін таңдау */}
      {codes.length > 1 && (
        <div className="mt-5 flex gap-2">
          {codes.map((c) => (
            <button
              key={c}
              onClick={() => setActive(c)}
              className={`focus-ring rounded-full px-5 py-2 text-sm font-semibold ${
                active === c ? "bg-parent text-white" : "bg-parent/10 text-parent"
              }`}
            >
              {CODE_LABELS[c] ?? c}
            </button>
          ))}
        </div>
      )}

      {/* Кесте */}
      <div className="mt-5 overflow-x-auto rounded-2xl border border-ink/10 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink/5 font-mono text-xs text-ink/50">
            <tr>
              <th className="px-3 py-2">Орын</th>
              <th className="px-3 py-2">ID</th>
              {active === "NIS" &&
                NIS_COLS.map((c) => (
                  <th key={c.key} className="px-3 py-2 text-right">{c.label}</th>
                ))}
              {active === "BIL" &&
                BIL_COLS.map((c) => (
                  <th key={c.key} className="px-3 py-2 text-right">{c.label}</th>
                ))}
              {active === "RFMS" && (
                <>
                  <th className="px-3 py-2 text-right">1–10</th>
                  <th className="px-3 py-2 text-right">11–20</th>
                  <th className="px-3 py-2 text-right">21–30</th>
                </>
              )}
              <th className="px-3 py-2 text-right font-bold">Жалпы</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const b = r.breakdown ?? {};
              return (
                <tr key={r.zipgrade_id} className="border-t border-ink/5 hover:bg-ink/[0.02]">
                  <td className="px-3 py-1.5 font-mono">{r.place}</td>
                  <td className="px-3 py-1.5 font-mono text-ink/60">{r.zipgrade_id}</td>
                  {active === "NIS" &&
                    NIS_COLS.map((c) => (
                      <td key={c.key} className="px-3 py-1.5 text-right font-mono">
                        {b.subjects?.[c.key]?.score ?? 0}
                      </td>
                    ))}
                  {active === "BIL" &&
                    BIL_COLS.map((c) => (
                      <td key={c.key} className="px-3 py-1.5 text-right font-mono">
                        {b.parts?.[c.key]?.score ?? 0}
                      </td>
                    ))}
                  {active === "RFMS" &&
                    (b.bands ?? [{}, {}, {}]).map((band: any, i: number) => (
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

      <p className="mt-4 text-xs text-ink/35">
        Аты-жөн жоқ. Өзіңізді табу үшін пропусктегі ID-ді қолданыңыз.
      </p>
    </div>
  );
}
