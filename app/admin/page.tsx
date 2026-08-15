"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import CreateSessionForm from "@/components/CreateSessionForm";
import SessionsList from "@/components/SessionsList";
import CreateTestTypeForm from "@/components/CreateTestTypeForm";
import TestTypesList from "@/components/TestTypesList";

type TestType = {
  id: string;
  code: string;
  name_kk: string;
  name_ru: string;
  stages: any[];
  scoring_scheme: string;
};
type Session = {
  id: string;
  title_kk: string;
  title_ru: string;
  session_date: string;
  price: number;
  is_active: boolean;
};

export default function AdminPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [testTypes, setTestTypes] = useState<TestType[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);

  const loadTestTypes = useCallback(async () => {
    const { data } = await supabase
      .from("test_types")
      .select("id, code, name_kk, name_ru, stages, scoring_scheme")
      .order("created_at", { ascending: false });
    setTestTypes(data ?? []);
  }, []);

  const loadSessions = useCallback(async () => {
    const { data } = await supabase
      .from("test_sessions")
      .select("id, title_kk, title_ru, session_date, price, is_active")
      .order("session_date", { ascending: true });
    setSessions(data ?? []);
  }, []);

  useEffect(() => {
    async function check() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.push("/login");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userData.user.id)
        .single();

      if (profile?.role !== "admin") {
        setAllowed(false);
        return;
      }
      setAllowed(true);
      loadTestTypes();
      loadSessions();
    }
    check();
  }, [router, loadTestTypes, loadSessions]);

  if (allowed === null) {
    return <main className="p-10 text-ink/50">Жүктелуде...</main>;
  }

  if (allowed === false) {
    return (
      <main className="p-10 text-ink/70">
        Бұл бетке қол жеткізу құқығыңыз жоқ.
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="font-display text-2xl font-bold text-admin">
        Админ панелі
      </h1>

      <section className="mt-10">
        <h2 className="font-display text-lg font-bold text-ink">
          Тест түрлері
        </h2>
        <div className="mt-4">
          <TestTypesList testTypes={testTypes} />
        </div>
        <div className="mt-4">
          <CreateTestTypeForm onCreated={loadTestTypes} />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-lg font-bold text-ink">
          Жаңа сессия құру
        </h2>
        <div className="mt-4">
          <CreateSessionForm testTypes={testTypes} onCreated={loadSessions} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-lg font-bold text-ink">
          Сессиялар тізімі
        </h2>
        <div className="mt-4">
          <SessionsList sessions={sessions} />
        </div>
      </section>
    </main>
  );
}
