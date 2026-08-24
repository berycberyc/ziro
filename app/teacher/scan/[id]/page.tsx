"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { fetchAll, fetchAllByIds } from "@/lib/fetchAll";
import { useLang } from "@/lib/LangContext";

type Registration = {
  id: string;
  short_code: string | null;
  classroom: string | null;
  seat: string | null;
  payment_status: string;
  checked_in_at: string | null;
  student_id: string;
  test_type_id: string;
};

type StudentInfo = { id: string; full_name: string; photo_url: string | null };
type TestTypeInfo = { id: string; name_kk: string; name_ru: string };

type Row = Registration & { student: StudentInfo | null; testType: TestTypeInfo | null };

type ScanState =
  | { kind: "idle" }
  | { kind: "success"; row: Row }
  | { kind: "already"; row: Row }
  | { kind: "wrong_session" }
  | { kind: "unknown" };

export default function TeacherScanSessionPage() {
  const params = useParams();
  const sessionId = params.id as string;
  const { t, lang } = useLang();

  const [sessionTitle, setSessionTitle] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanState, setScanState] = useState<ScanState>({ kind: "idle" });
  const [manualOpen, setManualOpen] = useState(false);
  const [manualQuery, setManualQuery] = useState("");

  const scannerRef = useRef<any>(null);
  const busyRef = useRef(false);
  const handleDecodedRef = useRef<(text: string) => void>(() => {});

  const load = useCallback(async () => {
    setLoading(true);

    const { data: sessionData } = await supabase
      .from("test_sessions")
      .select("title_kk, title_ru")
      .eq("id", sessionId)
      .single();
    if (sessionData) {
      setSessionTitle(lang === "kk" ? sessionData.title_kk : sessionData.title_ru);
    }

    const registrations = await fetchAll<any>((from, to) =>
      supabase
        .from("registrations")
        .select(
          "id, short_code, classroom, seat, payment_status, checked_in_at, student_id, test_type_id"
        )
        .eq("test_session_id", sessionId)
        .eq("payment_status", "paid")
        .order("id")
        .range(from, to)
    );

    const studentIds = registrations.map((r) => r.student_id);
    const testTypeIds = registrations.map((r) => r.test_type_id);

    const [studentsData, testTypesData] = await Promise.all([
      fetchAllByIds<any>(studentIds, (chunk) =>
        supabase.from("students").select("id, full_name, photo_url").in("id", chunk)
      ),
      fetchAllByIds<any>(testTypeIds, (chunk) =>
        supabase.from("test_types").select("id, name_kk, name_ru").in("id", chunk)
      ),
    ]);

    const studentsMap = new Map(studentsData.map((s) => [s.id, s]));
    const testTypesMap = new Map(testTypesData.map((tt) => [tt.id, tt]));

    setRows(
      registrations.map((r) => ({
        ...r,
        student: studentsMap.get(r.student_id) ?? null,
        testType: testTypesMap.get(r.test_type_id) ?? null,
      }))
    );
    setLoading(false);
  }, [sessionId, lang]);

  useEffect(() => {
    load();
  }, [load]);

  const booked = rows.length;
  const arrived = rows.filter((r) => r.checked_in_at).length;
  const remaining = booked - arrived;

  const checkIn = useCallback(
    async (row: Row) => {
      if (row.checked_in_at) {
        setScanState({ kind: "already", row });
        return;
      }
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("registrations")
        .update({ checked_in_at: now })
        .eq("id", row.id);
      if (!error) {
        const updated = { ...row, checked_in_at: now };
        setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)));
        setScanState({ kind: "success", row: updated });
      }
    },
    []
  );

  const handleDecoded = useCallback(
    async (text: string) => {
      if (busyRef.current) return;
      busyRef.current = true;

      const match = rows.find((r) => r.short_code === text || r.id === text);
      if (match) {
        await checkIn(match);
      } else {
        // Not in this session's paid list — check if it belongs to another session at all.
        const { data: elsewhere } = await supabase
          .from("registrations")
          .select("id")
          .or(`short_code.eq.${text},id.eq.${text}`)
          .maybeSingle();
        setScanState({ kind: elsewhere ? "wrong_session" : "unknown" });
      }

      setTimeout(() => {
        busyRef.current = false;
      }, 1500);
    },
    [rows, checkIn]
  );

  // Keep the ref pointed at the latest handler without re-running the camera effect.
  useEffect(() => {
    handleDecodedRef.current = handleDecoded;
  });

  // Camera scanner lifecycle — starts once and is not restarted on every scan.
  useEffect(() => {
    let cancelled = false;
    let started = false;
    let scanner: any = null;

    async function start() {
      if (manualOpen) return;
      const { Html5Qrcode } = await import("html5-qrcode");
      if (cancelled) return;
      scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;
      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 260 },
          (decodedText: string) => {
            handleDecodedRef.current(decodedText.trim());
          },
          () => {}
        );
        started = true;
        if (cancelled) {
          try {
            await scanner.stop();
          } catch {
            // ignore — already stopping/stopped
          }
        }
      } catch {
        // camera unavailable — manual search fallback remains available
      }
    }

    start();

    return () => {
      cancelled = true;
      if (started && scanner) {
        try {
          scanner.stop().catch(() => {});
        } catch {
          // scanner was already stopped/not running — safe to ignore
        }
      }
    };
  }, [sessionId, manualOpen]);

  const manualResults = rows.filter((r) =>
    r.student?.full_name.toLowerCase().includes(manualQuery.toLowerCase()) ||
    r.short_code?.toLowerCase().includes(manualQuery.toLowerCase())
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <Link href="/teacher/scan" className="text-sm text-ink/50 hover:underline">
            ← {t.teacherScanTitle}
          </Link>
          <h1 className="font-display text-xl font-bold text-ink">{sessionTitle}</h1>
        </div>
      </div>

      {/* Sticky counters */}
      <div className="sticky top-0 z-10 mb-4 grid grid-cols-3 gap-2 rounded-2xl border border-ink/10 bg-white/95 p-3 shadow-sm backdrop-blur">
        <div className="text-center">
          <p className="text-2xl font-bold text-ink">{booked}</p>
          <p className="text-xs text-ink/50">{t.scanBooked}</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-parent">{arrived}</p>
          <p className="text-xs text-ink/50">{t.scanArrived}</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-teacher">{remaining}</p>
          <p className="text-xs text-ink/50">{t.scanRemaining}</p>
        </div>
      </div>

      {!manualOpen ? (
        <>
          <div
            id="qr-reader"
            className="mx-auto w-full max-w-sm overflow-hidden rounded-2xl border border-ink/10 bg-black"
          />

          {/* Scan result */}
          <div className="mt-4">
            {scanState.kind === "idle" && (
              <p className="text-center text-sm text-ink/50">{t.scanWaitingForQr}</p>
            )}
            {scanState.kind === "success" && (
              <ResultCard row={scanState.row} lang={lang} t={t} tone="success" />
            )}
            {scanState.kind === "already" && (
              <ResultCard row={scanState.row} lang={lang} t={t} tone="already" />
            )}
            {scanState.kind === "wrong_session" && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-700">
                {t.scanWrongSession}
              </p>
            )}
            {scanState.kind === "unknown" && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-700">
                {t.scanUnknownCode}
              </p>
            )}
          </div>

          <button
            onClick={() => setManualOpen(true)}
            className="focus-ring mt-4 w-full rounded-full border border-ink/15 bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-sm hover:bg-ink/5"
          >
            {t.scanManualToggle}
          </button>
        </>
      ) : (
        <div>
          <input
            autoFocus
            placeholder={t.scanManualPlaceholder}
            value={manualQuery}
            onChange={(e) => setManualQuery(e.target.value)}
            className="focus-ring w-full rounded-xl border border-ink/15 bg-white px-4 py-2.5 text-sm"
          />
          <div className="mt-3 flex flex-col gap-2">
            {manualQuery &&
              manualResults.slice(0, 20).map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-ink/10 bg-white px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-ink">{r.student?.full_name}</p>
                    <p className="text-xs text-ink/50">
                      {r.classroom ? `${t.roomLabel}: ${r.classroom}` : ""}
                      {r.seat ? ` · ${t.scanSeatLabel}: ${r.seat}` : ""}
                    </p>
                  </div>
                  {r.checked_in_at ? (
                    <span className="rounded-full bg-parent-soft px-3 py-1 text-xs font-semibold text-parent">
                      {t.scanAlreadyShort}
                    </span>
                  ) : (
                    <button
                      onClick={() => checkIn(r)}
                      className="focus-ring rounded-full bg-teacher px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                    >
                      {t.scanMarkButton}
                    </button>
                  )}
                </div>
              ))}
          </div>
          <button
            onClick={() => setManualOpen(false)}
            className="focus-ring mt-4 w-full rounded-full border border-ink/15 bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-sm hover:bg-ink/5"
          >
            {t.scanBackToCamera}
          </button>
        </div>
      )}

      {loading && <p className="mt-4 text-center text-sm text-ink/50">{t.loading}</p>}
    </div>
  );
}

function ResultCard({
  row,
  lang,
  t,
  tone,
}: {
  row: Row;
  lang: "kk" | "ru";
  t: any;
  tone: "success" | "already";
}) {
  const testTypeName = lang === "kk" ? row.testType?.name_kk : row.testType?.name_ru;
  const border = tone === "success" ? "border-parent" : "border-teacher";
  const bg = tone === "success" ? "bg-parent-soft/40" : "bg-teacher-soft/40";

  return (
    <div className={`flex items-center gap-4 rounded-2xl border-2 ${border} ${bg} p-4`}>
      {row.student?.photo_url ? (
        <img
          src={row.student.photo_url}
          alt={row.student.full_name}
          className="h-16 w-16 rounded-full object-cover ring-2 ring-white shadow"
        />
      ) : (
        <div className="h-16 w-16 rounded-full bg-white" />
      )}
      <div className="min-w-0 flex-1">
        <p className="font-display text-lg font-bold text-ink">{row.student?.full_name}</p>
        <p className="text-sm text-ink/60">{testTypeName}</p>
        <p className="font-mono text-sm text-ink/60">
          {t.roomLabel}: {row.classroom ?? "—"} · {t.scanSeatLabel}: {row.seat ?? "—"}
        </p>
        {tone === "already" && row.checked_in_at && (
          <p className="mt-1 text-xs font-semibold text-teacher">
            {t.scanAlreadyAt} {new Date(row.checked_in_at).toLocaleTimeString(lang === "kk" ? "kk-KZ" : "ru-RU", { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>
    </div>
  );
}
