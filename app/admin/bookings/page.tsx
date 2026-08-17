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

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingToggleId, setPendingToggleId] = useState<string | null>(null);

  const load = useCallback(async () => {
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
      .order("created_at", { ascending: false });
    setBookings((data as any) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function togglePayment(id: string, currentStatus: string) {
    const newStatus = currentStatus === "paid" ? "pending" : "paid";
    await supabase.from("registrations").update({ payment_status: newStatus }).eq("id", id);
    setPendingToggleId(null);
    load();
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-admin">Бронирование</h1>

      {loading && <p className="mt-6 text-sm text-ink/50">Жүктелуде...</p>}
      {!loading && bookings.length === 0 && (
        <p className="mt-6 text-sm text-ink/50">Әзірге брондау жоқ.</p>
      )}

      <div className="mt-6 flex flex-col gap-2">
        {bookings.map((b) => (
          <div key={b.id} className="rounded-xl border border-ink/10 bg-white px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-ink">{b.students?.full_name}</p>
                <p className="text-sm text-ink/50">
                  {b.test_types?.name_kk} / {b.test_types?.name_ru} —{" "}
                  {b.test_sessions?.title_kk}
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
