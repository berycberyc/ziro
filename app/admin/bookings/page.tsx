"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Booking = {
  id: string;
  payment_status: string;
  students: { full_name: string } | null;
  test_types: { name_kk: string; name_ru: string } | null;
  test_sessions: { title_kk: string; title_ru: string } | null;
};

type TrialTest = { id: string; title_kk: string; title_ru: string; session_date: string };

export default function BookingsPage() {
  const [trialTests, setTrialTests] = useState<TrialTest[]>([]);
  const [selectedTestId, setSelectedTestId] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingToggleId, setPendingToggleId] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("test_sessions")
      .select("id, title_kk, title_ru, session_date")
      .order("session_date", { ascending: false })
      .then(({ data }) => setTrialTests(data ?? []));
  }, []);

  const load = useCallback(async (testId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from("registrations")
      .select(
        `
        id, payment_status,
        students ( full_name ),
        test_types ( name_kk, name_ru ),
        test_sessions ( title_kk, title_ru )
        `
      )
      .eq("test_session_id", testId)
      .order("created_at", { ascending: false });
    setBookings((data as any) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (selectedTestId) load(selectedTestId);
  }, [selectedTestId, load]);

  async function togglePayment(id: string, currentStatus: string) {
    const newStatus = currentStatus === "paid" ? "pending" : "paid";
    await supabase.from("registrations").update({ payment_status: newStatus }).eq("id", id);
    setPendingToggleId(null);
    load(selectedTestId);
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-admin">Оплата</h1>

      <select
        value={selectedTestId}
        onChange={(e) => setSelectedTestId(e.target.value)}
        className="focus-ring mt-4 w-full max-w-md rounded-xl border border-ink/15 px-3 py-2 text-sm"
      >
        <option value="">— пробный тестті таңдау —</option>
        {trialTests.map((t) => (
          <option key={t.id} value={t.id}>
            {t.title_kk} / {t.title_ru} — {t.session_date}
          </option>
        ))}
      </select>

      {!selectedTestId && (
        <p className="mt-6 text-sm text-ink/50">Алдымен пробный тест таңдаңыз.</p>
      )}

      {selectedTestId && loading && <p className="mt-6 text-sm text-ink/50">Жүктелуде...</p>}
      {selectedTestId && !loading && bookings.length === 0 && (
        <p className="mt-6 text-sm text-ink/50">Бұл тест бойынша брондау жоқ.</p>
      )}

      <div className="mt-6 flex flex-col gap-2">
        {bookings.map((b) => (
          <div key={b.id} className="rounded-xl border border-ink/10 bg-white px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-ink">{b.students?.full_name}</p>
                <p className="text-sm text-ink/50">
                  {b.test_types?.name_kk} / {b.test_types?.name_ru}
                </p>
              </div>

              {b.payment_status === "paid" ? (
                <button
                  onClick={() => setPendingToggleId(b.id)}
                  className="focus-ring rounded-full bg-parent-soft px-4 py-1.5 text-xs font-semibold text-parent hover:bg-parent hover:text-white"
                >
                  Төленді ✓
                </button>
              ) : (
                <button
                  onClick={() => setPendingToggleId(b.id)}
                  className="focus-ring rounded-full border border-admin px-4 py-1.5 text-xs font-semibold text-admin hover:bg-admin-soft"
                >
                  Растау
                </button>
              )}
            </div>

            {pendingToggleId === b.id && (
              <div className="mt-3 flex items-center justify-between rounded-xl bg-parchment px-3 py-2">
                <span className="text-sm text-ink/70">
                  {b.payment_status === "paid"
                    ? "Төлемді \"күтілуде\" деп белгілеу керек пе?"
                    : "Төлемді \"төленді\" деп белгілеу керек пе?"}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => togglePayment(b.id, b.payment_status)}
                    className="focus-ring rounded-full bg-admin px-3 py-1 text-xs font-semibold text-white hover:opacity-90"
                  >
                    Иә
                  </button>
                  <button
                    onClick={() => setPendingToggleId(null)}
                    className="focus-ring rounded-full border border-ink/15 px-3 py-1 text-xs font-semibold text-ink hover:bg-white"
                  >
                    Бас тарту
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
