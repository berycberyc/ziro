"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type BankTest = {
  id: string;
  code: string;
  title: string;
  profile_id: string;
  status: string;
  item_count: number;
};

export default function QuestionBankListPage() {
  const [tests, setTests] = useState<BankTest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: bankTests } = await supabase
        .from("question_bank_tests")
        .select("id, code, title, profile_id, status")
        .order("code");

      const withCounts: BankTest[] = [];
      for (const t of bankTests ?? []) {
        const { count } = await supabase
          .from("question_bank_items")
          .select("id", { count: "exact", head: true })
          .eq("test_id", t.id);
        withCounts.push({ ...t, item_count: count ?? 0 });
      }
      setTests(withCounts);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-admin">Сұрақтар банкі</h1>
      <p className="mt-2 text-sm text-ink/60">
        Жасалған тесттерді таңдап, ішіндегі сұрақтарды өзгертуге болады.
      </p>

      {loading && <p className="mt-6 text-sm text-ink/50">Жүктелуде...</p>}

      <div className="mt-6 flex flex-col gap-3">
        {tests.map((t) => (
          <Link
            key={t.id}
            href={`/admin/question-bank/${t.id}`}
            className="focus-ring flex items-center justify-between rounded-2xl border border-ink/10 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <div>
              <p className="font-display font-bold text-ink">{t.title}</p>
              <p className="text-xs text-ink/50">{t.code} · {t.profile_id}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-admin-soft px-3 py-1 text-xs font-semibold text-admin">
                {t.item_count} сұрақ
              </span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  t.status === "ready" ? "bg-parent-soft text-parent" : "bg-teacher-soft text-teacher"
                }`}
              >
                {t.status === "ready" ? "Дайын" : "Жоба"}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
