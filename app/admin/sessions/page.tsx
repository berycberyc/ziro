"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import CreateSessionForm from "@/components/CreateSessionForm";
import DummyDataButton from "@/components/DummyDataButton";

type TestType = { id: string; code: string; name_kk: string; name_ru: string };
type Session = {
  id: string;
  title_kk: string;
  title_ru: string;
  session_date: string;
};

export default function AdminSessionsPage() {
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
        <option value="">— пробный тестті таңдау —</option>
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

      <section className="mt-6">
        <DummyDataButton />
      </section>
    </div>
  );
}
