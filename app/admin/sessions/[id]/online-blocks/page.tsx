"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { TEST_TYPE_BLOCKS } from "@/lib/onlineTest/blocks";

type BankTest = { id: string; code: string; title: string; profile_id: string };
type Assignment = { block_key: string; question_bank_test_id: string };

export default function SessionOnlineBlocksPage() {
  const params = useParams();
  const sessionId = params.id as string;

  const [testTypeCodes, setTestTypeCodes] = useState<string[]>([]);
  const [bankTests, setBankTests] = useState<BankTest[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    const { data: sessionTypes } = await supabase
      .from("session_test_types")
      .select("test_types(code)")
      .eq("test_session_id", sessionId);
    const codes = [...new Set((sessionTypes ?? []).map((r: any) => r.test_types?.code).filter(Boolean))];
    setTestTypeCodes(codes);

    const { data: tests } = await supabase
      .from("question_bank_tests")
      .select("id, code, title, profile_id")
      .order("code");
    setBankTests(tests ?? []);

    const { data: existing } = await supabase
      .from("session_stage_tests")
      .select("block_key, question_bank_test_id")
      .eq("session_id", sessionId);
    const map: Record<string, string> = {};
    (existing ?? []).forEach((a: Assignment) => {
      map[a.block_key] = a.question_bank_test_id;
    });
    setAssignments(map);

    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAssign(blockKey: string, durationMinutes: number, testId: string) {
    setSaving(blockKey);
    if (!testId) {
      await supabase
        .from("session_stage_tests")
        .delete()
        .eq("session_id", sessionId)
        .eq("block_key", blockKey);
    } else {
      await supabase
        .from("session_stage_tests")
        .upsert(
          {
            session_id: sessionId,
            block_key: blockKey,
            question_bank_test_id: testId,
            duration_minutes: durationMinutes,
          },
          { onConflict: "session_id,block_key" }
        );
    }
    setAssignments((prev) => ({ ...prev, [blockKey]: testId }));
    setSaving(null);
  }

  return (
    <div>
      <Link href={`/admin/sessions/${sessionId}`} className="text-sm text-ink/50 hover:underline">
        ← Сессияға оралу
      </Link>
      <h1 className="font-display text-2xl font-bold text-ink">Онлайн тест блоктары</h1>
      <p className="mt-2 text-sm text-ink/60">
        Әр блок үшін банктен қай дайын тестті қолдану керектігін таңдаңыз. Оқушылар онлайн тест
        тапсырғанда осы тесттер көрсетіледі.
      </p>

      {loading && <p className="mt-6 text-sm text-ink/50">Жүктелуде...</p>}

      {!loading && testTypeCodes.length === 0 && (
        <p className="mt-6 text-sm text-ink/50">
          Бұл сессияға әлі тест түрі қосылмаған (Сессиялар бөлімінен қосыңыз).
        </p>
      )}

      <div className="mt-6 flex flex-col gap-8">
        {testTypeCodes.map((code) => (
          <div key={code} className="rounded-2xl border border-ink/10 bg-white p-5">
            <p className="font-display text-lg font-bold text-ink">{code}</p>
            <div className="mt-4 flex flex-col gap-3">
              {(TEST_TYPE_BLOCKS[code] ?? []).map((block) => {
                const options = bankTests.filter((t) => t.profile_id === block.key);
                return (
                  <div key={block.key} className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-ink">{block.labelKk}</p>
                      <p className="text-xs text-ink/50">{block.durationMinutes} мин</p>
                    </div>
                    <select
                      value={assignments[block.key] ?? ""}
                      onChange={(e) => handleAssign(block.key, block.durationMinutes, e.target.value)}
                      disabled={saving === block.key}
                      className="focus-ring min-w-[220px] rounded-xl border border-ink/15 px-3 py-2 text-sm"
                    >
                      <option value="">— таңдалмаған —</option>
                      {options.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
