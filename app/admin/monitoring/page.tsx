"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { fetchAll } from "@/lib/fetchAll";
import OnlineMonitor from "@/components/OnlineMonitor";

type TrialTest = {
  id: string;
  title_kk: string;
  title_ru: string;
  session_date: string;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  is_checking: boolean;
  has_results: boolean;
};

type RegRow = {
  id: string;
  format: string;
  payment_status: string;
  checked_in_at: string | null;
  students: { full_name: string } | null;
  test_types: { name_kk: string; name_ru: string } | null;
};

type Stage = "not_open" | "registration" | "checking" | "after";

function computeStage(t: TrialTest): Stage {
  const today = new Date().toISOString().slice(0, 10);
  if (t.has_results) return "after";
  if (t.is_checking) return "checking";
  if (t.registration_opens_at && today < t.registration_opens_at) return "not_open";
  return "registration";
}

export default function MonitoringPage() {
  const [trialTests, setTrialTests] = useState<TrialTest[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [selected, setSelected] = useState<TrialTest | null>(null);
  const [regs, setRegs] = useState<RegRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"offline" | "online">("offline");

  useEffect(() => {
    supabase
      .from("test_sessions")
      .select("id, title_kk, title_ru, session_date, registration_opens_at, registration_closes_at, is_checking, has_results")
      .order("session_date", { ascending: false })
      .then(({ data }) => setTrialTests(data ?? []));
  }, []);

  useEffect(() => {
    async function load() {
      if (!selectedId) {
        setSelected(null);
        return;
      }
      setLoading(true);
      const t = trialTests.find((x) => x.id === selectedId) ?? null;
      setSelected(t);

      try {
        const data = await fetchAll<any>((from, to) =>
          supabase
            .from("registrations")
            .select(
              `
              id, format, payment_status, checked_in_at,
              students ( full_name ),
              test_types ( name_kk, name_ru )
              `
            )
            .eq("test_session_id", selectedId)
            .order("id")
            .range(from, to)
        );
        setRegs(data as any);
      } catch (err) {
        console.error("Monitoring failed to load registrations:", err);
        setRegs([]);
      }
      setLoading(false);
    }
    load();
  }, [selectedId, trialTests]);

  const stage = selected ? computeStage(selected) : null;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-admin">Мониторинг</h1>

      <select
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        className="focus-ring mt-4 w-full max-w-md rounded-xl border border-ink/15 px-3 py-2 text-sm"
      >
        <option value="">— байқау тестті таңдау —</option>
        {trialTests.map((t) => (
          <option key={t.id} value={t.id}>
            {t.title_kk} / {t.title_ru} — {t.session_date}
          </option>
        ))}
      </select>

      {selectedId && (
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setTab("offline")}
            className={`focus-ring rounded-full px-5 py-2 text-sm font-semibold ${
              tab === "offline" ? "bg-admin text-white" : "bg-admin-soft text-admin"
            }`}
          >
            Офлайн
          </button>
          <button
            onClick={() => setTab("online")}
            className={`focus-ring rounded-full px-5 py-2 text-sm font-semibold ${
              tab === "online" ? "bg-admin text-white" : "bg-admin-soft text-admin"
            }`}
          >
            Онлайн тест
          </button>
        </div>
      )}

      {selectedId && tab === "online" && <OnlineMonitor sessionId={selectedId} />}

      {!selectedId && <p className="mt-6 text-sm text-ink/50">Алдымен байқау тест таңдаңыз.</p>}
      {selectedId && tab === "offline" && loading && <p className="mt-6 text-sm text-ink/50">Жүктелуде...</p>}

      {selectedId && tab === "offline" && !loading && stage === "not_open" && (
        <p className="mt-6 rounded-xl bg-ink/5 px-4 py-3 text-sm text-ink/50">
          Бұл тест үшін тіркеу әлі басталмаған.
        </p>
      )}

      {selectedId && tab === "offline" && !loading && stage === "registration" && (
        <div className="mt-6">
          <p className="mb-3 text-sm font-semibold text-ink/70">
            Тіркелгендер ({regs.length})
          </p>
          <div className="flex flex-col gap-2">
            {regs.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-xl border border-ink/10 bg-white px-4 py-2.5 text-sm">
                <span className="font-medium text-ink">{r.students?.full_name}</span>
                <span className="text-ink/50">
                  {r.test_types?.name_kk} · {r.format === "online" ? "Онлайн" : "Офлайн"} ·{" "}
                  {r.payment_status === "paid" ? "Төленді" : "Күтілуде"}
                </span>
              </div>
            ))}
            {regs.length === 0 && <p className="text-sm text-ink/40">Әзірге ешкім тіркелмеген.</p>}
          </div>
        </div>
      )}

      {selectedId && tab === "offline" && !loading && stage === "checking" && (
        <div className="mt-6">
          {(() => {
            const paid = regs.filter((r) => r.payment_status === "paid");
            const arrived = paid.filter((r) => r.checked_in_at);
            return (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-ink/10 bg-white p-4 text-center shadow-sm">
                  <p className="font-display text-2xl font-bold text-admin">{paid.length}</p>
                  <p className="mt-1 text-xs text-ink/50">Брондалған</p>
                </div>
                <div className="rounded-2xl border border-ink/10 bg-white p-4 text-center shadow-sm">
                  <p className="font-display text-2xl font-bold text-parent">{arrived.length}</p>
                  <p className="mt-1 text-xs text-ink/50">Келді</p>
                </div>
                <div className="rounded-2xl border border-ink/10 bg-white p-4 text-center shadow-sm">
                  <p className="font-display text-2xl font-bold text-clay">{paid.length - arrived.length}</p>
                  <p className="mt-1 text-xs text-ink/50">Қалды</p>
                </div>
                <div className="rounded-2xl border border-ink/10 bg-white p-4 text-center shadow-sm">
                  <p className="font-mono text-sm font-semibold text-ink">
                    {paid.filter((r) => r.format === "online").length} / {paid.filter((r) => r.format === "offline").length}
                  </p>
                  <p className="mt-1 text-xs text-ink/50">Онлайн / Офлайн</p>
                </div>
              </div>
            );
          })()}
          <Link
            href={`/admin/current-testing/${selectedId}`}
            className="focus-ring mt-4 inline-block text-sm font-semibold text-admin hover:underline"
          >
            Толық тізім (аудитория бойынша) →
          </Link>
        </div>
      )}

      {selectedId && tab === "offline" && !loading && stage === "after" && (
        <div className="mt-6">
          <p className="mb-3 text-sm font-semibold text-ink/70">
            Келді/келмеді тізімі (ақшаны қайтару даулары үшін)
          </p>
          <div className="flex flex-col gap-2">
            {regs
              .filter((r) => r.payment_status === "paid")
              .map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-xl border border-ink/10 bg-white px-4 py-2.5 text-sm">
                  <span className="font-medium text-ink">{r.students?.full_name}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-ink/50">{r.format === "online" ? "Онлайн" : "Офлайн"}</span>
                    {r.format === "offline" ? (
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${r.checked_in_at ? "bg-parent-soft text-parent" : "bg-red-50 text-red-600"}`}>
                        {r.checked_in_at ? "Келді" : "Келмеді"}
                      </span>
                    ) : (
                      <span className="rounded-full bg-ink/5 px-3 py-1 text-xs text-ink/40">
                        Онлайн қатысуы әлі бақыланбайды
                      </span>
                    )}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
