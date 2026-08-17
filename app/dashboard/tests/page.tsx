"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useLang } from "@/lib/LangContext";
import { getSessionDetail, type SessionDetail } from "@/lib/sessions";
import BookingForm from "@/components/BookingForm";

type SessionRow = {
  id: string;
  title_kk: string;
  title_ru: string;
  session_date: string;
  is_active: boolean;
};
type Student = { id: string; full_name: string };

export default function TestsPage() {
  const { t, lang } = useLang();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [bookingSession, setBookingSession] = useState<SessionDetail | null>(null);
  const [bookedMessage, setBookedMessage] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      setUserId(data.user.id);
      supabase
        .from("students")
        .select("id, full_name")
        .eq("parent_id", data.user.id)
        .then(({ data }) => setStudents(data ?? []));
    });

    supabase
      .from("test_sessions")
      .select("id, title_kk, title_ru, session_date, is_active")
      .eq("is_active", true)
      .order("session_date", { ascending: true })
      .then(({ data }) => setSessions(data ?? []));
  }, []);

  async function openBooking(sessionId: string) {
    const detail = await getSessionDetail(sessionId);
    if (detail) setBookingSession(detail);
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">{t.testsPageTitle}</h1>

      {bookedMessage && (
        <p className="mt-4 rounded-xl bg-parent-soft px-4 py-3 text-sm text-parent">
          {bookedMessage}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {sessions.length === 0 && (
          <p className="text-sm text-ink/50">{t.noAvailableTests}</p>
        )}
        {sessions.map((s) => (
          <div
            key={s.id}
            className="flex flex-col gap-3 rounded-xl border border-ink/10 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium text-ink">
                {lang === "kk" ? s.title_kk : s.title_ru}
              </p>
              <p className="text-sm text-ink/50">{s.session_date}</p>
            </div>
            <button
              onClick={() => openBooking(s.id)}
              className="focus-ring self-start rounded-full bg-parent px-5 py-2 text-sm font-semibold text-white hover:opacity-90 sm:self-auto"
            >
              {t.book}
            </button>
          </div>
        ))}
      </div>

      {bookingSession && userId && (
        <BookingForm
          session={bookingSession}
          students={students}
          parentId={userId}
          onClose={() => setBookingSession(null)}
          onBooked={() => {
            setBookingSession(null);
            setBookedMessage(t.bookedMessage);
          }}
        />
      )}
    </div>
  );
}
