"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  receipt_url: string | null;
};

type StudentInfo = { id: string; full_name: string; photo_url: string | null; zipgrade_id: string | null; iin: string | null };
type TestTypeInfo = { id: string; code: string; name_kk: string; name_ru: string };
type SessionInfo = {
  id: string;
  title_kk: string;
  title_ru: string;
  session_date: string;
  start_time: string | null;
  address: string | null;
  price: number;
  has_results: boolean;
  is_checking: boolean;
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
  const [qrDataUrls, setQrDataUrls] = useState<Record<string, string>>({});

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
          "id, short_code, format, payment_status, classroom, test_variant, student_id, test_type_id, test_session_id, receipt_url"
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
        supabase.from("students").select("id, full_name, photo_url, zipgrade_id, iin").in("id", studentIds),
        supabase.from("test_types").select("id, code, name_kk, name_ru").in("id", testTypeIds),
        supabase
          .from("test_sessions")
          .select("id, title_kk, title_ru, session_date, start_time, address, price, has_results, is_checking")
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

      const QRCode = (await import("qrcode")).default;
      const entries = await Promise.all(
        merged
          .filter((b) => b.payment_status === "paid")
          .map(async (b) => {
            const content = b.short_code ?? b.id;
            const dataUrl = await QRCode.toDataURL(content, { width: 320, margin: 1 });
            return [b.id, dataUrl] as const;
          })
      );
      setQrDataUrls(Object.fromEntries(entries));
    }

    load();
  }, [t.errorGeneric]);

  function statusLabel(status: string) {
    if (status === "paid") return { text: t.statusPaid, color: "bg-parent-soft text-parent" };
    return { text: t.statusPending, color: "bg-teacher-soft text-teacher" };
  }

  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState("");
  const [uploadingReceiptId, setUploadingReceiptId] = useState<string | null>(null);
  const [receiptError, setReceiptError] = useState("");

  async function waitForImages(node: HTMLElement) {
    const imgs = Array.from(node.querySelectorAll("img"));
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete) {
              if (img.naturalWidth === 0) {
                img.remove();
              }
              resolve();
              return;
            }
            const cleanup = () => {
              img.removeEventListener("load", onLoad);
              img.removeEventListener("error", onError);
              resolve();
            };
            const onLoad = () => cleanup();
            const onError = () => {
              img.remove();
              cleanup();
            };
            img.addEventListener("load", onLoad);
            img.addEventListener("error", onError);
            // Safety timeout in case an image hangs indefinitely.
            setTimeout(() => {
              if (img.naturalWidth === 0) img.remove();
              cleanup();
            }, 5000);
          })
      )
    );
  }

  async function downloadPass(id: string, fileName: string) {
    const node = document.querySelector<HTMLElement>(`[data-pass-template][data-id="${id}"]`);
    if (!node) return;

    setDownloadingId(id);
    setDownloadError("");

    try {
      await waitForImages(node);
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(node, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
      });
      const { jsPDF } = await import("jspdf");
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "px",
        format: [canvas.width, canvas.height],
      });
      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save(`${fileName}.pdf`);
    } catch (err) {
      console.error("Pass download failed:", err);
      setDownloadError("Пропускты жүктеу кезінде қате шықты. Қайта көріңіз.");
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleReceiptUpload(registrationId: string, file: File) {
    setUploadingReceiptId(registrationId);
    setReceiptError("");

    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${registrationId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage.from("receipts").upload(path, file, {
        upsert: true,
      });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from("receipts").getPublicUrl(path);

      const { error: updateError } = await supabase
        .from("registrations")
        .update({ receipt_url: publicUrlData.publicUrl })
        .eq("id", registrationId);
      if (updateError) throw updateError;

      setBookings((prev) =>
        prev.map((b) => (b.id === registrationId ? { ...b, receipt_url: publicUrlData.publicUrl } : b))
      );
    } catch (err) {
      console.error("Receipt upload failed:", err);
      setReceiptError("Түбіртекті жүктеу кезінде қате шықты. Қайта көріңіз.");
    } finally {
      setUploadingReceiptId(null);
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
          const qrDataUrl = qrDataUrls[b.id] ?? "";
          const sessionTitle = lang === "kk" ? b.session?.title_kk : b.session?.title_ru;
          const testTypeName = lang === "kk" ? b.testType?.name_kk : b.testType?.name_ru;

          return (
            <div
              key={b.id}
              data-pass-card
              data-id={b.id}
              className="overflow-hidden rounded-3xl border border-ink/10 bg-white shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 bg-ink px-5 py-4">
                <div className="flex items-center gap-3">
                  {b.student?.photo_url ? (
                    <img
                      src={b.student.photo_url}
                      alt={b.student.full_name}
                      className="h-12 w-12 rounded-full object-cover ring-2 ring-gold/40"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-ink-soft" />
                  )}
                  <div>
                    <p className="font-display text-lg font-bold text-parchment">{b.student?.full_name}</p>
                    <p className="font-mono text-xs text-[#B9C1D0]">{testTypeName}</p>
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${status.color}`}>
                  {status.text}
                </span>
              </div>

              {b.payment_status === "paid" ? (
                <div className="grid gap-6 p-5 sm:grid-cols-[auto_1fr] sm:items-center">
                  <div className="flex justify-center">
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt="QR"
                        width={160}
                        height={160}
                        className="rounded-2xl border border-ink/10 bg-white p-2 shadow-sm"
                      />
                    ) : (
                      <div className="flex h-[160px] w-[160px] items-center justify-center rounded-2xl border border-ink/10 bg-ink/5 text-xs text-ink/40">
                        {t.loading}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 text-sm text-ink/80">
                    <p>
                      <span className="font-display font-semibold text-ink">{sessionTitle}</span>
                    </p>
                    <p className="font-mono text-xs text-ink/60">
                      {t.dateLabel}: {b.session?.session_date}
                      {b.session?.start_time ? ` · ${b.session.start_time}` : ""}
                    </p>
                    {b.session?.address && (
                      <p className="font-mono text-xs text-ink/60">
                        {t.addressLabel}: {b.session.address}
                      </p>
                    )}
                    {b.classroom && (
                      <p className="font-mono text-xs font-semibold text-gold-deep">
                        {t.roomLabel}: {b.classroom}
                      </p>
                    )}
                    <div className="mt-3 rounded-xl bg-parchment px-4 py-3 text-xs leading-relaxed text-ink/60">
                      {b.format === "online" ? (
                        <>
                          <p>{t.passOnlineNote1}</p>
                          <p className="mt-1">{t.passOnlineNote2}</p>
                        </>
                      ) : (
                        <>
                          <p>{t.passArriveNote}</p>
                          <p className="mt-1">{t.passBringNote}</p>
                        </>
                      )}
                    </div>
                    <button
                      onClick={() =>
                        downloadPass(b.id, `ziro-propusk-${b.student?.full_name ?? b.short_code ?? b.id}`)
                      }
                      disabled={downloadingId === b.id || !qrDataUrl}
                      className="focus-ring mt-2 inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink shadow-sm hover:bg-ink/5 disabled:opacity-50"
                    >
                      {downloadingId === b.id ? t.loading : t.printSave}
                    </button>
                    {downloadError && downloadingId === null && (
                      <p className="mt-2 text-xs text-red-600">{downloadError}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-5">
                  <div className="flex flex-wrap items-center gap-4">
                    <img
                      src="/kaspi-qr.png"
                      alt="Kaspi QR"
                      className="h-32 w-32 rounded-2xl border border-ink/10 bg-white p-2 shadow-sm"
                    />
                    <div className="flex-1">
                      <p className="text-sm text-ink/70">{t.passWaitingPayment}</p>
                      <p className="mt-1 font-mono text-sm">
                        Сомасы:{" "}
                        <span className="font-semibold text-gold-deep">
                          {b.session?.price?.toLocaleString("ru-RU")} ₸
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-ink/10 pt-4">
                    {b.receipt_url ? (
                      <div className="flex flex-wrap items-center gap-3">
                        <a
                          href={b.receipt_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 rounded-full bg-parent-soft px-4 py-2 text-sm font-semibold text-parent hover:opacity-90"
                        >
                          Түбіртек жіберілді ✓
                        </a>
                        <label className="focus-ring cursor-pointer rounded-full border border-ink/15 px-4 py-2 text-sm font-medium text-ink/60 hover:bg-parchment">
                          {uploadingReceiptId === b.id ? "Жүктелуде..." : "Ауыстыру"}
                          <input
                            key={b.id}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={uploadingReceiptId === b.id}
                            onChange={(e) => e.target.files?.[0] && handleReceiptUpload(b.id, e.target.files[0])}
                          />
                        </label>
                      </div>
                    ) : (
                      <label className="focus-ring inline-flex cursor-pointer items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-ink shadow-[0_6px_16px_rgba(198,154,58,0.28)] transition-transform hover:-translate-y-0.5">
                        {uploadingReceiptId === b.id ? "Жүктелуде..." : "Түбіртекті жіберу"}
                        <input
                          key={b.id}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploadingReceiptId === b.id}
                          onChange={(e) => e.target.files?.[0] && handleReceiptUpload(b.id, e.target.files[0])}
                        />
                      </label>
                    )}
                    {receiptError && uploadingReceiptId === null && (
                      <p className="mt-2 text-xs text-red-600">{receiptError}</p>
                    )}
                  </div>
                </div>
              )}

              {b.session?.has_results && (
                <Link
                  href={`/dashboard/results/${b.id}`}
                  className="block border-t border-ink/10 px-5 py-3 text-sm font-semibold text-parent hover:underline"
                >
                  {t.resultsReady} →
                </Link>
              )}

              {b.format === "online" &&
                b.payment_status === "paid" &&
                b.session?.is_checking &&
                !b.session?.has_results && (
                  <div className="border-t border-ink/10 px-5 py-4">
                    <Link
                      href="/kiru"
                      className="focus-ring inline-flex items-center gap-2 rounded-full bg-teacher px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90"
                    >
                      {t.startOnlineTest}
                    </Link>
                  </div>
                )}

              {b.payment_status === "paid" && (
                <div
                  data-pass-template
                  data-id={b.id}
                  style={{
                    position: "fixed",
                    left: "-3000px",
                    top: 0,
                    width: "800px",
                    height: "1131px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    background: "#ffffff",
                    padding: "56px 64px",
                    boxSizing: "border-box",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "36px" }}>
                    <img src="/logo.jpg" alt="Ziro" style={{ width: "44px", height: "44px", borderRadius: "10px", objectFit: "cover" }} />
                    <span style={{ fontSize: "22px", fontWeight: 700, letterSpacing: "-0.02em" }}>
                      <span style={{ color: "#16233F" }}>zi</span>
                      <span style={{ color: "#A87F26" }}>ro</span>
                    </span>
                  </div>

                  <p style={{ fontSize: "13px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#A87F26", margin: "0 0 28px 0", fontWeight: 700 }}>
                    {t.passLabel}
                  </p>

                  <div
                    style={{
                      width: "220px",
                      height: "280px",
                      borderRadius: "16px",
                      overflow: "hidden",
                      border: "4px solid #F3F5F2",
                      boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
                      background: "#d9d9d9",
                      marginBottom: "28px",
                    }}
                  >
                    {b.student?.photo_url && (
                      <img
                        src={b.student.photo_url}
                        alt={b.student.full_name}
                        crossOrigin="anonymous"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    )}
                  </div>

                  <p style={{ fontSize: "30px", fontWeight: 800, color: "#16233F", margin: "0 0 8px 0", textAlign: "center" }}>
                    {b.student?.full_name}
                  </p>
                  <p style={{ fontSize: "14px", color: "#8a8a8a", margin: "0 0 4px 0", textAlign: "center" }}>
                    {t.studentIdLabel}:{" "}
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: "#16233F" }}>
                      {b.student?.zipgrade_id ?? "—"}
                    </span>
                  </p>
                  {b.student?.iin && (
                    <p style={{ fontSize: "14px", color: "#8a8a8a", margin: "0 0 4px 0", textAlign: "center" }}>
                      {t.iinLabel}: <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: "#16233F" }}>{b.student.iin}</span>
                    </p>
                  )}
                  <p style={{ fontSize: "14px", color: "#8a8a8a", margin: "0 0 32px 0", textAlign: "center" }}>
                    {t.bookingNumberLabel}:{" "}
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: "#16233F" }}>{b.short_code ?? "—"}</span>
                  </p>

                  <img
                    src={qrDataUrl}
                    alt="QR"
                    width={210}
                    height={210}
                    style={{ borderRadius: "16px", background: "#fff", padding: "10px", border: "1px solid #15181e1a", marginBottom: "32px" }}
                  />

                  <div style={{ width: "100%", height: "1px", background: "rgba(198,154,58,0.35)", marginBottom: "28px" }} />

                  <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "16px" }}>
                      <span style={{ color: "#8a8a8a" }}>{t.testTypeLabel}</span>
                      <span style={{ fontWeight: 700, color: "#16233F" }}>{testTypeName}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "16px" }}>
                      <span style={{ color: "#8a8a8a" }}>{t.sessionLabel}</span>
                      <span style={{ fontWeight: 700, color: "#16233F", textAlign: "right" }}>{sessionTitle}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "16px" }}>
                      <span style={{ color: "#8a8a8a" }}>
                        {t.dateLabel} / {t.timeLabel}
                      </span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: "#16233F" }}>
                        {b.session?.session_date}
                        {b.session?.start_time ? `, ${b.session.start_time}` : ""}
                      </span>
                    </div>
                    {b.session?.address && (
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "16px" }}>
                        <span style={{ color: "#8a8a8a" }}>{t.addressLabel}</span>
                        <span style={{ fontWeight: 700, color: "#16233F", textAlign: "right" }}>{b.session.address}</span>
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: "32px", width: "100%", padding: "18px 22px", background: "#F3F5F2", borderRadius: "14px", fontSize: "13.5px", lineHeight: 1.7, color: "#5a5a5a" }}>
                    {b.format === "online" ? (
                      <>
                        <p style={{ margin: 0 }}>{t.passOnlineNote1}</p>
                        <p style={{ margin: "6px 0 0 0" }}>{t.passOnlineNote2}</p>
                      </>
                    ) : (
                      <>
                        <p style={{ margin: 0 }}>{t.passArriveNote}</p>
                        <p style={{ margin: "6px 0 0 0" }}>{t.passBringNote}</p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
