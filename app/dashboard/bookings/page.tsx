"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useLang } from "@/lib/LangContext";

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
  const { t, lang } = useLang();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: rows } = await supabase
        .from("registrations")
        .select(
          `
          id, short_code, format, payment_status, classroom, test_variant,
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
    if (status === "paid") return { text: t.statusPaid, color: "bg-parent-soft text-parent" };
    return { text: t.statusPending, color: "bg-teacher-soft text-teacher" };
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">{t.bookingsTitle}</h1>

      {loading && <p className="mt-6 text-sm text-ink/50">{t.loading}</p>}
      {!loading && bookings.length === 0 && (
        <p className="mt-6 text-sm text-ink/50">{t.noBookings}</p>
      )}

      <div className="mt-6 flex flex-col gap-4">
        {bookings.map((b) => {
          const status = statusLabel(b.payment_status);
          // QR encodes only the short booking code — everything else is looked up server-side by it.
          const qrContent = b.short_code ?? b.id;
          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(qrContent)}`;
          const sessionTitle = lang === "kk" ? b.test_sessions?.title_kk : b.test_sessions?.title_ru;
          const testTypeName = lang === "kk" ? b.test_types?.name_kk : b.test_types?.name_ru;

          return (
            <div key={b.id} className="rounded-2xl border border-ink/10 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-display font-bold text-ink">
                    {b.students?.full_name}
                  </p>
                  <p className="text-sm text-ink/60">
                    {t.testTypeLabel}: {testTypeName}
                  </p>
                  <p className="text-sm text-ink/50">
                    {sessionTitle} · {t.dateLabel}: {b.test_sessions?.session_date}
                    {b.test_sessions?.start_time ? ` ${b.test_sessions.start_time}` : ""}
                  </p>
                  {b.test_sessions?.address && (
                    <p className="text-sm text-ink/50">
                      {t.addressLabel}: {b.test_sessions.address}
                    </p>
                  )}
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${status.color}`}>
                  {status.text}
                </span>
              </div>

              {b.payment_status === "paid" && (
                <div className="mt-4 flex flex-col items-start gap-4 rounded-xl bg-parchment p-4 sm:flex-row sm:items-center">
                  <img src={qrUrl} alt="QR" width={90} height={90} />
                  <div className="text-xs text-ink/70">
                    <p>{t.passArriveNote}</p>
                    <p className="mt-1">{t.passBringNote}</p>
                    {b.classroom && (
                      <p className="mt-1 font-semibold">
                        {t.roomLabel}: {b.classroom}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {b.test_sessions?.has_results && (
                <p className="mt-4 text-sm font-semibold text-parent">{t.resultsReady}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
