"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import CreateSessionForm from "@/components/CreateSessionForm";
import SessionsList from "@/components/SessionsList";

type TestType = { id: string; code: string; name_kk: string; name_ru: string };
type Session = {
  id: string;
  title_kk: string;
  title_ru: string;
  session_date: string;
  price: number;
  is_active: boolean;
  is_checking: boolean;
  has_results: boolean;
};

export default function AdminSessionsPage() {
  const [testTypes, setTestTypes] = useState<TestType[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);

  const loadSessions = useCallback(async () => {
    const { data } = await supabase
      .from("test_sessions")
      .select("id, title_kk, title_ru, session_date, price, is_active, is_checking, has_results")
      .order("session_date", { ascending: true });
    setSessions(data ?? []);
  }, []);

  useEffect(() => {
    supabase
      .from("test_types")
      .select("id, code, name_kk, name_ru")
      .then(({ data }) => setTestTypes(data ?? []));
    loadSessions();
  }, [loadSessions]);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-admin">
        Сессиялар
      </h1>

      <section className="mt-8">
        <SessionsList sessions={sessions} />
      </section>

      <section className="mt-6">
        <CreateSessionForm testTypes={testTypes} onCreated={loadSessions} />
      </section>
    </div>
  );
}
