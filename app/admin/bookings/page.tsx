"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Booking = {
  id: string;
  payment_status: string;
  student_id: string;
  parent_id: string;
  receipt_url: string | null;
  students: {
    full_name: string;
    iin: string | null;
    grade: string | null;
    region: string | null;
    city: string | null;
    school: string | null;
    language: string | null;
  } | null;
  test_types: { name_kk: string; name_ru: string } | null;
};

type ParentDetail = {
  full_name: string | null;
  phone: string | null;
  email: string | null;
};

type TrialTest = { id: string; title_kk: string; title_ru: string; session_date: string };

export default function BookingsPage() {
  const [trialTests, setTrialTests] = useState<TrialTest[]>([]);
  const [selectedTestId, setSelectedTestId] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingToggleId, setPendingToggleId] = useState<string | null>(null);
  const [detailBooking, setDetailBooking] = useState<Booking | null>(null);
  const [detailParent, setDetailParent] = useState<ParentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

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
        id, payment_status, student_id, parent_id, receipt_url,
        students ( full_name, iin, grade, region, city, school, language ),
        test_types ( name_kk, name_ru )
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

  async function openDetail(b: Booking) {
    setDetailBooking(b);
    setDetailLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("full_name, phone, email")
      .eq("id", b.parent_id)
      .single();
    setDetailParent(data ?? null);
    setDetailLoading(false);
  }

  const unpaid = bookings.filter((b) => b.payment_status !== "paid");
  const paid = bookings.filter((b) => b.payment_status === "paid");

  function BookingCard({ b }: { b: Booking }) {
    return (
      <div className="rounded-2xl border border-ink/10 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => openDetail(b)}
            className="focus-ring flex-1 text-left"
          >
            <p className="font-display font-semibold text-ink hover:underline">{b.students?.full_name}</p>
            <p className="text-sm text-ink/50">
              {b.test_types?.name_kk} / {b.test_types?.name_ru}
            </p>
          </button>

          {b.receipt_url && (
            <a
              href={b.receipt_url}
              target="_blank"
              rel="noreferrer"
              title="Түбіртекті қарау"
              className="focus-ring shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-gold/15 text-gold-deep hover:bg-gold/25"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 2H4a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h5m0-20h9a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H9m0-20v20" />
                <path d="M13 8h4M13 12h4M13 16h4" strokeLinecap="round" />
              </svg>
            </a>
          )}

          {b.payment_status === "paid" ? (
            <button
              onClick={() => setPendingToggleId(b.id)}
              className="focus-ring shrink-0 rounded-full bg-parent-soft px-4 py-1.5 text-xs font-semibold text-parent hover:bg-parent hover:text-white"
            >
              Төленді ✓
            </button>
          ) : (
            <button
              onClick={() => setPendingToggleId(b.id)}
              className="focus-ring shrink-0 rounded-full border border-admin px-4 py-1.5 text-xs font-semibold text-admin hover:bg-admin-soft"
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
    );
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

      {selectedTestId && !loading && bookings.length > 0 && (
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-clay">
              Төленбеген <span className="font-mono text-ink/40">({unpaid.length})</span>
            </h2>
            <div className="flex flex-col gap-2">
              {unpaid.map((b) => (
                <BookingCard key={b.id} b={b} />
              ))}
              {unpaid.length === 0 && <p className="text-sm text-ink/40">Барлығы төленген.</p>}
            </div>
          </div>
          <div>
            <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-parent">
              Төленген <span className="font-mono text-ink/40">({paid.length})</span>
            </h2>
            <div className="flex flex-col gap-2">
              {paid.map((b) => (
                <BookingCard key={b.id} b={b} />
              ))}
              {paid.length === 0 && <p className="text-sm text-ink/40">Әзірге ешкім төлемеген.</p>}
            </div>
          </div>
        </div>
      )}

      {detailBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/50 backdrop-blur-[2px]"
            onClick={() => setDetailBooking(null)}
          />
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <h3 className="font-display text-lg font-bold text-ink">
                {detailBooking.students?.full_name}
              </h3>
              <button
                onClick={() => setDetailBooking(null)}
                className="focus-ring rounded-lg p-1 text-ink/40 hover:bg-ink/5"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {detailLoading ? (
              <p className="mt-4 text-sm text-ink/50">Жүктелуде...</p>
            ) : (
              <>
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink/40">Ата-ана</p>
                  <p className="mt-1 font-display font-semibold text-ink">
                    {detailParent?.full_name ?? "—"}
                  </p>
                  <div className="mt-2 flex flex-col gap-1 font-mono text-sm">
                    {detailParent?.phone ? (
                      <a href={`tel:${detailParent.phone}`} className="text-admin hover:underline">
                        {detailParent.phone}
                      </a>
                    ) : (
                      <span className="text-ink/40">Телефон көрсетілмеген</span>
                    )}
                    {detailParent?.email ? (
                      <a href={`mailto:${detailParent.email}`} className="text-admin hover:underline">
                        {detailParent.email}
                      </a>
                    ) : (
                      <span className="text-ink/40">Email көрсетілмеген</span>
                    )}
                  </div>
                </div>

                <div className="mt-5 border-t border-ink/10 pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink/40">Оқушы</p>
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-sm text-ink/70">
                    <span>ИИН: {detailBooking.students?.iin ?? "—"}</span>
                    <span>Сынып: {detailBooking.students?.grade ?? "—"}</span>
                    <span>Тіл: {detailBooking.students?.language ?? "—"}</span>
                    <span>Облыс: {detailBooking.students?.region ?? "—"}</span>
                    <span>Қала: {detailBooking.students?.city ?? "—"}</span>
                    <span>Мектеп: {detailBooking.students?.school ?? "—"}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
