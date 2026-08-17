"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useLang } from "@/lib/LangContext";

type Registration = {
  id: string;
  short_code: string | null;
  format: string;
  payment_status: string;
  classroom: string | null;
  test_variant: string | null;
  student_id: string;
  test_type_id: string;
  test_session_id: string;
};

type StudentInfo = { id: string; full_name: string; photo_url: string | null };
type TestTypeInfo = { id: string; name_kk: string; name_ru: string };
type SessionInfo = {
  id: string;
  title_kk: string;
  title_ru: string;
  session_date: string;
  start_time: string | null;
  address: string | null;
  has_results: boolean;
};

type Booking = Registration & {
  student: StudentInfo | null;
  testType: TestTypeInfo | null;
  session: SessionInfo | null;
};

export default function BookingsPage() {
  const { t, lang } = useLang();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErrorMsg("");

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setLoading(false);
        return;
      }

      // Fetch the base registrations first — kept as a flat, unjoined query
      // so a problem embedding one related table can't blank out the whole list.
      const { data: regs, error: regsError } = await supabase
        .from("registrations")
        .select(
          "id, short_code, format, payment_status, classroom, test_variant, student_id, test_type_id, test_session_id"
        )
        .eq("parent_id", userData.user.id)
        .order("created_at", { ascending: false });

      if (regsError) {
        console.error("registrations load error:", regsError);
        setErrorMsg(regsError.message);
        setLoading(false);
        return;
      }

      const registrations = regs ?? [];
      if (registrations.length === 0) {
        setBookings([]);
        setLoading(false);
        return;
      }

      const studentIds = [...new Set(registrations.map((r) => r.student_id))];
      const testTypeIds = [...new Set(registrations.map((r) => r.test_type_id))];
      const sessionIds = [...new Set(registrations.map((r) => r.test_session_id))];

      const [studentsRes, testTypesRes, sessionsRes] = await Promise.all([
        supabase.from("students").select("id, full_name, photo_url").in("id", studentIds),
        supabase.from("test_types").select("id, name_kk, name_ru").in("id", testTypeIds),
        supabase
          .from("test_sessions")
          .select("id, title_kk, title_ru, session_date, start_time, address, has_results")
          .in("id", sessionIds),
      ]);

      if (studentsRes.error || testTypesRes.error || sessionsRes.error) {
        console.error(
          "related data load error:",
          studentsRes.error,
          testTypesRes.error,
          sessionsRes.error
        );
        setErrorMsg(
          (studentsRes.error || testTypesRes.error || sessionsRes.error)?.message ?? t.errorGeneric
        );
      }

      const studentsMap = new Map((studentsRes.data ?? []).map((s) => [s.id, s]));
      const testTypesMap = new Map((testTypesRes.data ?? []).map((tt) => [tt.id, tt]));
      const sessionsMap = new Map((sessionsRes.data ?? []).map((s) => [s.id, s]));

      const merged: Booking[] = registrations.map((r) => ({
        ...r,
        student: studentsMap.get(r.student_id) ?? null,
        testType: testTypesMap.get(r.test_type_id) ?? null,
        session: sessionsMap.get(r.test_session_id) ?? null,
      }));

      setBookings(merged);
      setLoading(false);
    }

    load();
  }, [t.errorGeneric]);

  function statusLabel(status: string) {
    if (status === "paid") return { text: t.statusPaid, color: "bg-parent-soft text-parent" };
    return { text: t.statusPending, color: "bg-teacher-soft text-teacher" };
  }

  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  async function downloadPass(id: string, fileName: string) {
    const node = document.querySelector<HTMLElement>(`[data-pass-card][data-id="${id}"]`);
    if (!node) return;

    setDownloadingId(id);
    const actionBtn = node.querySelector<HTMLElement>("[data-no-capture]");
    if (actionBtn) actionBtn.style.visibility = "hidden";

    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(node, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
      });
      const { jsPDF } = await import("jspdf");
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: canvas.width >= canvas.height ? "landscape" : "portrait",
        unit: "px",
        format: [canvas.width, canvas.height],
      });
      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save(`${fileName}.pdf`);
    } finally {
      if (actionBtn) actionBtn.style.visibility = "";
      setDownloadingId(null);
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">{t.bookingsTitle}</h1>

      {loading && <p className="mt-6 text-sm text-ink/50">{t.loading}</p>}
      {errorMsg && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{errorMsg}</p>
      )}
      {!loading && !errorMsg && bookings.length === 0 && (
        <p className="mt-6 text-sm text-ink/50">{t.noBookings}</p>
      )}

      <div className="mt-6 flex flex-col gap-6">
        {bookings.map((b) => {
          const status = statusLabel(b.payment_status);
          const qrContent = b.short_code ?? b.id;
          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(qrContent)}`;
          const sessionTitle = lang === "kk" ? b.session?.title_kk : b.session?.title_ru;
          const testTypeName = lang === "kk" ? b.testType?.name_kk : b.testType?.name_ru;

          return (
            <div
              key={b.id}
              data-pass-card
              data-id={b.id}
              className="overflow-hidden rounded-3xl border border-ink/10 bg-white shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink/10 bg-parent-soft/30 px-5 py-4">
                <div className="flex items-center gap-3">
                  {b.student?.photo_url ? (
                    <img
                      src={b.student.photo_url}
                      alt={b.student.full_name}
                      className="h-12 w-12 rounded-full object-cover ring-2 ring-white shadow"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-parent-soft" />
                  )}
                  <div>
                    <p className="font-display text-lg font-bold text-ink">{b.student?.full_name}</p>
                    <p className="text-sm text-ink/60">{testTypeName}</p>
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${status.color}`}>
                  {status.text}
                </span>
              </div>

              {b.payment_status === "paid" ? (
                <div className="grid gap-6 p-5 sm:grid-cols-[auto_1fr] sm:items-center">
                  <div className="flex justify-center">
                    <img
                      src={qrUrl}
                      alt="QR"
                      width={160}
                      height={160}
                      className="rounded-2xl border border-ink/10 bg-white p-2 shadow-sm"
                    />
                  </div>
                  <div className="space-y-2 text-sm text-ink/80">
                    <p>
                      <span className="font-semibold text-ink">{sessionTitle}</span>
                    </p>
                    <p>
                      {t.dateLabel}: {b.session?.session_date}
                      {b.session?.start_time ? `, ${t.timeLabel.toLowerCase()}: ${b.session.start_time}` : ""}
                    </p>
                    {b.session?.address && (
                      <p>
                        {t.addressLabel}: {b.session.address}
                      </p>
                    )}
                    {b.classroom && (
                      <p className="font-semibold text-ink">
                        {t.roomLabel}: {b.classroom}
                      </p>
                    )}
                    <div className="mt-3 rounded-xl bg-parchment px-4 py-3 text-xs leading-relaxed text-ink/60">
                      <p>{t.passArriveNote}</p>
                      <p className="mt-1">{t.passBringNote}</p>
                    </div>
                    <button
                      data-no-capture
                      onClick={() =>
                        downloadPass(b.id, `ziro-propusk-${b.student?.full_name ?? b.short_code ?? b.id}`)
                      }
                      disabled={downloadingId === b.id}
                      className="focus-ring mt-2 inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink shadow-sm hover:bg-ink/5 disabled:opacity-50"
                    >
                      {downloadingId === b.id ? t.loading : t.printSave}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-5 text-sm text-ink/50">{t.passWaitingPayment}</div>
              )}

              {b.session?.has_results && (
                <p className="border-t border-ink/10 px-5 py-3 text-sm font-semibold text-parent">
                  {t.resultsReady}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
