"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { fetchAll } from "@/lib/fetchAll";

type ResultRow = { zipgrade_id: string; subject_label: string; score: number };

export default function ResultsPage() {
  const params = useParams();
  const registrationId = params.registrationId as string;

  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"mine" | "all">("mine");
  const [studentName, setStudentName] = useState("");
  const [myZipgradeId, setMyZipgradeId] = useState("");
  const [myResults, setMyResults] = useState<ResultRow[]>([]);
  const [allResults, setAllResults] = useState<ResultRow[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: reg } = await supabase
        .from("registrations")
        .select("test_session_id, student_id")
        .eq("id", registrationId)
        .single();
      if (!reg) {
        setLoading(false);
        return;
      }

      const { data: student } = await supabase
        .from("students")
        .select("full_name, zipgrade_id")
        .eq("id", reg.student_id)
        .single();
      setStudentName(student?.full_name ?? "");
      setMyZipgradeId(student?.zipgrade_id ?? "");

      // Толық рейтинг керек — 1000 жолдық шектен асып кетсе, орын дұрыс
      // есептелмейді, сондықтан беттеп оқимыз.
      let results: ResultRow[] = [];
      try {
        results = await fetchAll<ResultRow>((from, to) =>
          supabase
            .from("results")
            .select("zipgrade_id, subject_label, score")
            .eq("test_session_id", reg.test_session_id)
            .order("id")
            .range(from, to)
        );
      } catch (err) {
        console.error("Results failed to load:", err);
      }

      setAllResults(results);
      setMyResults(results.filter((r) => r.zipgrade_id === student?.zipgrade_id));
      setLoading(false);
    }
    load();
  }, [registrationId]);

  // Group the anonymized full list by subject, sorted best-to-worst.
  const bySubject = new Map<string, ResultRow[]>();
  for (const r of allResults) {
    if (!bySubject.has(r.subject_label)) bySubject.set(r.subject_label, []);
    bySubject.get(r.subject_label)!.push(r);
  }
  for (const rows of bySubject.values()) {
    rows.sort((a, b) => b.score - a.score);
  }

  if (loading) return <main className="p-10 text-ink/50">Жүктелуде...</main>;

  return (
    <div>
      <Link href="/dashboard/bookings" className="text-sm text-ink/50 hover:underline">
        ← Брондарым
      </Link>
      <h1 className="font-display text-2xl font-bold text-ink">Нәтижелер</h1>

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => setView("mine")}
          className={`focus-ring rounded-full px-4 py-2 text-sm font-semibold ${
            view === "mine" ? "bg-parent text-white" : "bg-parent-soft text-parent"
          }`}
        >
          Менің нәтижем
        </button>
        <button
          onClick={() => setView("all")}
          className={`focus-ring rounded-full px-4 py-2 text-sm font-semibold ${
            view === "all" ? "bg-parent text-white" : "bg-parent-soft text-parent"
          }`}
        >
          Барлық тізім
        </button>
      </div>

      {view === "mine" && (
        <div className="mt-6">
          <p className="mb-3 text-sm text-ink/60">{studentName}</p>
          {myResults.length === 0 ? (
            <p className="text-sm text-ink/40">Нәтиже әлі жоқ.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {myResults.map((r) => (
                <div
                  key={r.subject_label}
                  className="flex items-center justify-between rounded-xl border border-ink/10 bg-white px-4 py-3"
                >
                  <span className="text-sm font-medium text-ink">{r.subject_label}</span>
                  <span className="font-display text-lg font-bold text-parent">{r.score}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === "all" && (
        <div className="mt-6 flex flex-col gap-6">
          {[...bySubject.entries()].map(([subject, rows]) => (
            <div key={subject}>
              <p className="mb-2 text-sm font-semibold text-ink/70">{subject}</p>
              <div className="flex flex-col gap-1">
                {rows.map((r, i) => (
                  <div
                    key={r.zipgrade_id}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                      r.zipgrade_id === myZipgradeId ? "bg-parent-soft font-semibold text-parent" : "bg-white"
                    }`}
                  >
                    <span>
                      {i + 1}. #{r.zipgrade_id}
                    </span>
                    <span>{r.score}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {bySubject.size === 0 && <p className="text-sm text-ink/40">Нәтиже әлі жоқ.</p>}
        </div>
      )}
    </div>
  );
}
