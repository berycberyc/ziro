"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Booking = {
  id: string;
  short_code: string | null;
  format: string;
  payment_status: string;
  classroom: string | null;
  test_variant: string | null;
  students: { full_name: string } | null;
  test_types: { name_kk: string; name_ru: string } | null;
  test_sessions: {
    title_kk: string;
    title_ru: string;
    session_date: string;
    start_time: string | null;
    address: string | null;
    has_results: boolean;
  } | null;
};

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: rows } = await supabase
        .from("registrations")
        .select(
          `
          id, format, payment_status, classroom, test_variant,
          students ( full_name ),
          test_types ( name_kk, name_ru ),
          test_sessions ( title_kk, title_ru, session_date, start_time, address, has_results )
          `
        )
        .eq("parent_id", data.user.id)
        .order("created_at", { ascending: false });
      setBookings((rows as any) ?? []);
      setLoading(false);
    });
  }, []);

  function statusLabel(status: string) {
    if (status === "paid") return { text: "Төленді", color: "bg-parent-soft text-parent" };
    return { text: "Төлем күтілуде", color: "bg-teacher-soft text-teacher" };
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">Бронирленген</h1>

      {loading && <p className="mt-6 text-sm text-ink/50">Жүктелуде...</p>}
      {!loading && bookings.length === 0 && (
        <p className="mt-6 text-sm text-ink/50">Әзірге брондау жоқ.</p>
      )}

      <div className="mt-6 flex flex-col gap-4">
        {bookings.map((b) => {
          const status = statusLabel(b.payment_status);
          const qrContent = `ziro-pass|${b.id}`;
          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(qrContent)}`;

          return (
            <div key={b.id} className="rounded-2xl border border-ink/10 bg-white p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display font-bold text-ink">
                    {b.students?.full_name}
                  </p>
                  <p className="text-sm text-ink/60">
                    {b.test_types?.name_kk} / {b.test_types?.name_ru}
                  </p>
                  <p className="text-sm text-ink/50">
                    {b.test_sessions?.title_kk} · {b.test_sessions?.session_date}
                    {b.test_sessions?.start_time ? ` ${b.test_sessions.start_time}` : ""}
                  </p>
                  {b.test_sessions?.address && (
                    <p className="text-sm text-ink/50">{b.test_sessions.address}</p>
                  )}
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status.color}`}>
                  {status.text}
                </span>
              </div>

              {b.payment_status === "paid" && (
                <div className="mt-4 flex items-center gap-4 rounded-xl bg-parchment p-4">
                  <img src={qrUrl} alt="QR" width={90} height={90} />
                  <div className="text-xs text-ink/70">
                    <p>
                      Тестке кемінде 15 минут бұрын келуіңізді сұраймыз. Тіркеу тест
                      басталуына 10 минут қалғанда жабылады.
                    </p>
                    <p className="mt-1">
                      Өзіңізбен бірге осы пропускты, туу туралы куәлікті және көк сиялы
                      қалам алып келіңіз.
                    </p>
                    {b.classroom && (
                      <p className="mt-1 font-semibold">Аудитория: {b.classroom}</p>
                    )}
                  </div>
                </div>
              )}

              {b.test_sessions?.has_results && (
                <p className="mt-4 text-sm font-semibold text-parent">
                  Нәтиже дайын — жақын арада осында көрсетіледі.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
