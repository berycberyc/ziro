"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  SUBJECT_MAX_COUNT,
  SUBJECT_LABELS,
  SIMPLE_ABCD_SUBJECTS,
  TEST_TYPE_SUBJECTS,
  type SubjectKey,
} from "@/lib/questions/subjects";

const TEST_TYPES = [
  { code: "NIS", label: "НИШ" },
  { code: "BIL", label: "БІЛ" },
  { code: "RFMS", label: "РФМШ" },
];

export default function SessionQuestionsSelectorPage() {
  const params = useParams();
  const sessionId = params.id as string;

  const [variant, setVariant] = useState(1);
  const [testType, setTestType] = useState("NIS");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("questions")
        .select("subject, variant_number")
        .eq("session_id", sessionId);
      const map: Record<string, number> = {};
      (data ?? []).forEach((row: any) => {
        const key = `${row.variant_number}:${row.subject}`;
        map[key] = (map[key] ?? 0) + 1;
      });
      setCounts(map);
      setLoading(false);
    }
    load();
  }, [sessionId]);

  const subjects = TEST_TYPE_SUBJECTS[testType] ?? [];

  return (
    <div>
      <Link href={`/admin/sessions/${sessionId}`} className="text-sm text-ink/50 hover:underline">
        ← Сессияға оралу
      </Link>
      <h1 className="font-display text-2xl font-bold text-admin">Сұрақтарды енгізу</h1>

      <div className="mt-6 flex flex-wrap gap-2">
        {[1, 2, 3, 4].map((v) => (
          <button
            key={v}
            onClick={() => setVariant(v)}
            className={`focus-ring rounded-full px-5 py-2 text-sm font-semibold ${
              variant === v ? "bg-admin text-white" : "bg-admin-soft text-admin"
            }`}
          >
            Нұсқа {v}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {TEST_TYPES.map((t) => (
          <button
            key={t.code}
            onClick={() => setTestType(t.code)}
            className={`focus-ring rounded-full px-5 py-2 text-sm font-semibold ${
              testType === t.code ? "bg-teacher text-white" : "bg-teacher-soft text-teacher"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-ink/50">Жүктелуде...</p>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {subjects.map((subj) => {
            const max = SUBJECT_MAX_COUNT[subj as SubjectKey];
            const current = counts[`${variant}:${subj}`] ?? 0;
            const complete = current >= max;
            const isSimpleForm = SIMPLE_ABCD_SUBJECTS.includes(subj as SubjectKey);
            return (
              <div
                key={subj}
                className="flex items-center justify-between rounded-2xl border border-ink/10 bg-white p-4"
              >
                <div>
                  <p className="font-medium text-ink">{SUBJECT_LABELS[subj as SubjectKey]}</p>
                  <p className={`text-xs ${complete ? "text-parent" : "text-ink/50"}`}>
                    {current} / {max} сұрақ {complete ? "— дайын" : ""}
                  </p>
                </div>
                {isSimpleForm ? (
                  <Link
                    href={`/admin/sessions/${sessionId}/questions/entry?variant=${variant}&subject=${subj}`}
                    className="focus-ring rounded-full bg-admin px-5 py-2 text-sm font-semibold text-white hover:opacity-90"
                  >
                    Енгізу
                  </Link>
                ) : (
                  <span className="rounded-full bg-ink/5 px-4 py-2 text-xs text-ink/40">Жақында</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
