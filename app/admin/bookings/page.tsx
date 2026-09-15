"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { receiptSignedUrl } from "@/lib/receipts";
import { fetchAll } from "@/lib/fetchAll";
import PushNotificationButton from "@/components/PushNotificationButton";

type Booking = {
  id: string;
  payment_status: string;
  student_id: string;
  parent_id: string;
  test_type_id: string;
  receipt_url: string | null;
  payment_confirmed_by: string | null;
  payment_confirmed_at: string | null;
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

type TrialTest = {
  id: string;
  title_kk: string;
  title_ru: string;
  session_date: string;
  price: number;
};

function formatMoney(amount: number) {
  return `${Math.round(amount).toLocaleString("ru-RU")} ₸`;
}

/**
 * Астана уақыты (+05:00) — жобада уақыт бүкіл жерде осылай тіркелген.
 * Браузердің уақыт белдеуіне сенбейміз: Қазақстан 2024 жылы белдеуін
 * ауыстырды, ескі құрылғылар әлі +06:00 көрсетуі мүмкін.
 */
function formatAstanaTime(iso: string) {
  const d = new Date(new Date(iso).getTime() + 5 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()} ${pad(
    d.getUTCHours()
  )}:${pad(d.getUTCMinutes())}`;
}

export default function BookingsPage() {
  const [trialTests, setTrialTests] = useState<TrialTest[]>([]);
  const [selectedTestId, setSelectedTestId] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingToggleId, setPendingToggleId] = useState<string | null>(null);
  const [detailBooking, setDetailBooking] = useState<Booking | null>(null);
  const [detailParent, setDetailParent] = useState<ParentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  // Тест түрі бойынша жеке баға (session_test_types.price). Жоқ болса — сессия бағасы.
  const [priceOverrides, setPriceOverrides] = useState<Record<string, number>>({});
  // Растаған адамның аты: profile id -> аты.
  const [confirmerNames, setConfirmerNames] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase
      .from("test_sessions")
      .select("id, title_kk, title_ru, session_date, price")
      .order("session_date", { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error("Trial tests failed to load:", error);
        setTrialTests((data as TrialTest[]) ?? []);
      });
  }, []);

  const load = useCallback(async (testId: string) => {
    setLoading(true);
    try {
      const data = await fetchAll<any>((from, to) =>
        supabase
          .from("registrations")
          .select(
            `
            id, payment_status, student_id, parent_id, test_type_id, receipt_url,
            payment_confirmed_by, payment_confirmed_at,
            students ( full_name, iin, grade, region, city, school, language ),
            test_types ( name_kk, name_ru )
            `
          )
          .eq("test_session_id", testId)
          .order("created_at", { ascending: false })
          .order("id")
          .range(from, to)
      );
      setBookings(data as any);

      const { data: links, error: linksError } = await supabase
        .from("session_test_types")
        .select("test_type_id, price")
        .eq("test_session_id", testId);
      if (linksError) console.error("Test type prices failed to load:", linksError);
      const overrides: Record<string, number> = {};
      for (const row of links ?? []) {
        if (row.price !== null && row.price !== undefined) {
          overrides[row.test_type_id] = Number(row.price);
        }
      }
      setPriceOverrides(overrides);

      const confirmerIds = Array.from(
        new Set(
          (data as Booking[])
            .map((b) => b.payment_confirmed_by)
            .filter((id): id is string => !!id)
        )
      );
      const names: Record<string, string> = {};
      if (confirmerIds.length > 0) {
        const { data: people, error: peopleError } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", confirmerIds);
        if (peopleError) console.error("Confirmer names failed to load:", peopleError);
        for (const p of people ?? []) {
          names[p.id] = p.full_name?.trim() || p.email || "—";
        }
      }
      setConfirmerNames(names);
    } catch (err) {
      console.error("Bookings failed to load:", err);
      setBookings([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (selectedTestId) load(selectedTestId);
  }, [selectedTestId, load]);

  async function togglePayment(id: string, currentStatus: string) {
    const newStatus = currentStatus === "paid" ? "pending" : "paid";
    // Кім және қашан растағанын база өзі жазады (064 миграциясы).
    const { error } = await supabase
      .from("registrations")
      .update({ payment_status: newStatus })
      .eq("id", id);
    setPendingToggleId(null);
    if (error) {
      alert("Қате: " + error.message);
      return;
    }
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

  const sessionPrice = Number(trialTests.find((t) => t.id === selectedTestId)?.price ?? 0);
  const amountOf = (b: Booking) => priceOverrides[b.test_type_id] ?? sessionPrice;
  const unpaidTotal = unpaid.reduce((sum, b) => sum + amountOf(b), 0);
  const paidTotal = paid.reduce((sum, b) => sum + amountOf(b), 0);

  /**
   * Түбіртек қоймасы жабық (057 миграциясы): тікелей сілтеме жұмыс істемейді,
   * қарар алдында 10 минуттық уақытша сілтеме сұраймыз.
   */
  async function openReceipt(path: string) {
    const url = await receiptSignedUrl(supabase.storage, path);
    if (!url) {
      alert("Түбіртекті ашу мүмкін болмады.");
      return;
    }
    window.open(url, "_blank", "noopener");
  }

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
              <span className="ml-2 font-mono font-semibold text-ink/80">
                {formatMoney(amountOf(b))}
              </span>
            </p>
            {b.payment_status === "paid" && (
              <p className="mt-0.5 text-xs text-ink/45">
                {b.payment_confirmed_by
                  ? `Растады: ${confirmerNames[b.payment_confirmed_by] ?? "—"}`
                  : "Растаушы белгісіз"}
                {b.payment_confirmed_at && (
                  <span className="font-mono"> · {formatAstanaTime(b.payment_confirmed_at)}</span>
                )}
              </p>
            )}
          </button>

          {b.receipt_url && (
            <button
              onClick={() => openReceipt(b.receipt_url!)}
              title="Түбіртекті қарау"
              className="focus-ring shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-gold/15 text-gold-deep hover:bg-gold/25"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 2H4a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h5m0-20h9a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H9m0-20v20" />
                <path d="M13 8h4M13 12h4M13 16h4" strokeLinecap="round" />
              </svg>
            </button>
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-admin">Оплата</h1>
        <PushNotificationButton />
      </div>

      <select
        value={selectedTestId}
        onChange={(e) => setSelectedTestId(e.target.value)}
        className="focus-ring mt-4 w-full max-w-md rounded-xl border border-ink/15 px-3 py-2 text-sm"
      >
        <option value="">— байқау тестті таңдау —</option>
        {trialTests.map((t) => (
          <option key={t.id} value={t.id}>
            {t.title_kk} / {t.title_ru} — {t.session_date}
          </option>
        ))}
      </select>

      {!selectedTestId && (
        <p className="mt-6 text-sm text-ink/50">Алдымен байқау тест таңдаңыз.</p>
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
              <span className="ml-2 font-mono normal-case text-ink/60">{formatMoney(unpaidTotal)}</span>
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
              <span className="ml-2 font-mono normal-case text-ink/60">{formatMoney(paidTotal)}</span>
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
