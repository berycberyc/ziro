"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useLang } from "@/lib/LangContext";

type SessionRow = {
  id: string;
  title_kk: string;
  title_ru: string;
  session_date: string;
  booked: number;
  arrived: number;
};

export default function TeacherScanSessionsPage() {
  const { t, lang } = useLang();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: sessionsData } = await supabase
        .from("test_sessions")
        .select("id, title_kk, title_ru, session_date")
        .eq("is_checking", true)
        .order("session_date", { ascending: true });

      const rows: SessionRow[] = [];
      for (const s of sessionsData ?? []) {
        const [{ count: booked }, { count: arrived }] = await Promise.all([
          supabase
            .from("registrations")
            .select("id", { count: "exact", head: true })
            .eq("test_session_id", s.id)
            .eq("payment_status", "paid"),
          supabase
            .from("registrations")
            .select("id", { count: "exact", head: true })
            .eq("test_session_id", s.id)
            .eq("payment_status", "paid")
            .not("checked_in_at", "is", null),
        ]);
        rows.push({ ...s, booked: booked ?? 0, arrived: arrived ?? 0 });
      }
      setSessions(rows);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">{t.teacherScanTitle}</h1>

      {loading && <p className="mt-6 text-sm text-ink/50">{t.loading}</p>}
      {!loading && sessions.length === 0 && (
        <p className="mt-6 text-sm text-ink/50">{t.scanNoSessions}</p>
      )}

      <div className="mt-6 flex flex-col gap-4">
        {sessions.map((s) => (
          <Link
            key={s.id}
            href={`/teacher/scan/${s.id}`}
            className="focus-ring flex flex-col gap-3 rounded-2xl border border-ink/10 bg-white p-5 shadow-sm transition-shadow hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-display text-lg font-bold text-ink">
                {lang === "kk" ? s.title_kk : s.title_ru}
              </p>
              <p className="text-sm text-ink/50">{s.session_date}</p>
            </div>
            <div className="flex gap-4 text-sm">
              <span className="rounded-full bg-teacher-soft px-3 py-1.5 font-semibold text-teacher">
                {t.scanBooked}: {s.booked}
              </span>
              <span className="rounded-full bg-parent-soft px-3 py-1.5 font-semibold text-parent">
                {t.scanArrived}: {s.arrived}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
