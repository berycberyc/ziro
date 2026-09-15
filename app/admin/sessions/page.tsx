"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useStaffRole } from "@/lib/StaffRoleContext";
import CreateSessionForm from "@/components/CreateSessionForm";

type TestType = { id: string; code: string; name_kk: string; name_ru: string };
type Session = {
  id: string;
  title_kk: string;
  title_ru: string;
  session_date: string;
};

export default function AdminSessionsPage() {
  const role = useStaffRole();
  return role === "admin" ? <SessionsEditor /> : <SessionsReadOnly />;
}

/** Әкімшіге: бұрынғыдай — таңдап өңдеуге кіру және жаңа сессия қосу. */
function SessionsEditor() {
  const router = useRouter();
  const [testTypes, setTestTypes] = useState<TestType[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedId, setSelectedId] = useState("");

  const loadSessions = useCallback(async () => {
    const { data } = await supabase
      .from("test_sessions")
      .select("id, title_kk, title_ru, session_date")
      .order("session_date", { ascending: false });
    setSessions(data ?? []);
  }, []);

  useEffect(() => {
    supabase
      .from("test_types")
      .select("id, code, name_kk, name_ru")
      .then(({ data }) => setTestTypes(data ?? []));
    loadSessions();
  }, [loadSessions]);

  function handleSelect(id: string) {
    setSelectedId(id);
    if (id) router.push(`/admin/sessions/${id}`);
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-admin">
        Пробные тесттер
      </h1>

      <select
        value={selectedId}
        onChange={(e) => handleSelect(e.target.value)}
        className="focus-ring mt-4 w-full max-w-md rounded-xl border border-ink/15 px-3 py-2 text-sm"
      >
        <option value="">— байқау тестті таңдау —</option>
        {sessions.map((s) => (
          <option key={s.id} value={s.id}>
            {s.title_kk} / {s.title_ru} — {s.session_date}
          </option>
        ))}
      </select>

      <section className="mt-8">
        <h2 className="font-display text-lg font-bold text-ink">Жаңа сессия қосу</h2>
        <div className="mt-3">
          <CreateSessionForm testTypes={testTypes} onCreated={loadSessions} />
        </div>
      </section>
    </div>
  );
}

type SessionRow = {
  id: string;
  title_kk: string;
  title_ru: string;
  session_date: string;
  start_time: string | null;
  address: string | null;
  price: number;
  is_active: boolean | null;
};

function formatDate(isoDate: string) {
  const [y, m, d] = isoDate.split("-");
  return d && m && y ? `${d}.${m}.${y}` : isoDate;
}

/** Бухгалтерге: тек тізім, өңдеу де, жаңасын қосу да жоқ. */
function SessionsReadOnly() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase
      .from("test_sessions")
      .select("id, title_kk, title_ru, session_date, start_time, address, price, is_active")
      .order("session_date", { ascending: false })
      .then(({ data, error: dbError }) => {
        if (dbError) {
          console.error("Sessions failed to load:", dbError);
          setError("Тізімді жүктеу мүмкін болмады: " + dbError.message);
        } else {
          setSessions((data as SessionRow[]) ?? []);
        }
        setLoading(false);
      });
  }, []);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-admin">
        Пробные тесттер
      </h1>

      {loading && <p className="mt-6 text-sm text-ink/50">Жүктелуде...</p>}
      {error && <p className="mt-6 text-sm text-red-600">{error}</p>}
      {!loading && !error && sessions.length === 0 && (
        <p className="mt-6 text-sm text-ink/50">Әзірге сессия жоқ.</p>
      )}

      <div className="mt-6 flex max-w-2xl flex-col gap-2">
        {sessions.map((s) => (
          <div
            key={s.id}
            className="rounded-2xl border border-ink/10 bg-white px-4 py-3 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display font-semibold text-ink">
                  {s.title_kk} / {s.title_ru}
                </p>
                <p className="mt-0.5 font-mono text-sm text-ink/60">
                  {formatDate(s.session_date)}
                  {s.start_time ? ` · ${s.start_time.slice(0, 5)}` : ""}
                </p>
                {s.address && <p className="mt-0.5 text-sm text-ink/50">{s.address}</p>}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="font-mono text-sm font-semibold text-gold-deep">
                  {Number(s.price).toLocaleString("ru-RU")} ₸
                </span>
                {s.is_active === false && (
                  <span className="rounded-full bg-ink/5 px-2 py-0.5 text-xs text-ink/50">
                    Белсенді емес
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
