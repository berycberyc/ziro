"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { fetchAll } from "@/lib/fetchAll";

type ResultRow = { zipgrade_id: string; subject_label: string; score: number };

export default function AdminResultsPreviewPage() {
  const params = useParams();
  const sessionId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [sessionTitle, setSessionTitle] = useState("");
  const [results, setResults] = useState<ResultRow[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: session } = await supabase
        .from("test_sessions")
        .select("title_kk, title_ru")
        .eq("id", sessionId)
        .single();
      setSessionTitle(session ? `${session.title_kk} / ${session.title_ru}` : "");

      // Нәтиже саны = қатысушы × пән, 1000-нан оңай асады.
      try {
        const data = await fetchAll<ResultRow>((from, to) =>
          supabase
            .from("results")
            .select("zipgrade_id, subject_label, score")
            .eq("test_session_id", sessionId)
            .order("id")
            .range(from, to)
        );
        setResults(data);
      } catch (err) {
        console.error("Results preview failed to load:", err);
        setResults([]);
      }
      setLoading(false);
    }
    load();
  }, [sessionId]);

  const bySubject = new Map<string, ResultRow[]>();
  for (const r of results) {
    if (!bySubject.has(r.subject_label)) bySubject.set(r.subject_label, []);
    bySubject.get(r.subject_label)!.push(r);
  }
  for (const rows of bySubject.values()) {
    rows.sort((a, b) => b.score - a.score);
  }

  if (loading) return <p className="text-sm text-ink/50">Жүктелуде...</p>;

  return (
    <div>
      <Link href={`/admin/sessions/${sessionId}`} className="text-sm text-ink/50 hover:underline">
        ← Артқа
      </Link>
      <h1 className="font-display text-2xl font-bold text-admin">Алдын ала қарау</h1>
      <p className="mt-1 text-sm text-ink/60">
        {sessionTitle} — ата-аналар "Нәтиже дайын" қосылғаннан кейін дәл осылай көреді.
      </p>

      {bySubject.size === 0 ? (
        <p className="mt-6 text-sm text-ink/40">
          Нәтиже әлі жүктелмеген. "Жүктеу/түсіру" бетінен жүктеңіз.
        </p>
      ) : (
        <div className="mt-6 flex flex-col gap-6">
          {[...bySubject.entries()].map(([subject, rows]) => (
            <div key={subject} className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm">
              <p className="mb-3 font-display font-semibold text-ink">
                {subject}{" "}
                <span className="font-mono text-xs font-normal text-ink/40">
                  · {rows.length} қатысушы
                </span>
              </p>
              <div className="flex flex-col gap-1">
                {rows.map((r, i) => (
                  <div
                    key={r.zipgrade_id}
                    className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-parchment"
                  >
                    <span className="font-mono text-ink/70">
                      {String(i + 1).padStart(2, "0")} · #{r.zipgrade_id}
                    </span>
                    <span className="font-display font-semibold text-ink">{r.score}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
