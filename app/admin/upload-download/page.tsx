"use client";

import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";

type TrialTest = { id: string; title_kk: string; title_ru: string; session_date: string };

export default function UploadDownloadPage() {
  const [trialTests, setTrialTests] = useState<TrialTest[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    supabase
      .from("test_sessions")
      .select("id, title_kk, title_ru, session_date")
      .order("session_date", { ascending: false })
      .then(({ data }) => setTrialTests(data ?? []));
  }, []);

  async function handleDownloadStudents() {
    if (!selectedId) return;
    setDownloading(true);
    setError("");

    const { data: regs } = await supabase
      .from("registrations")
      .select("id, format, payment_status, classroom, seat, test_variant, student_id, test_type_id")
      .eq("test_session_id", selectedId)
      .eq("payment_status", "paid");

    const studentIds = [...new Set((regs ?? []).map((r) => r.student_id))];
    const testTypeIds = [...new Set((regs ?? []).map((r) => r.test_type_id))];

    const [studentsRes, testTypesRes] = await Promise.all([
      supabase.from("students").select("id, full_name, zipgrade_id").in("id", studentIds),
      supabase.from("test_types").select("id, name_kk, name_ru").in("id", testTypeIds),
    ]);
    const studentsMap = new Map((studentsRes.data ?? []).map((s) => [s.id, s]));
    const testTypesMap = new Map((testTypesRes.data ?? []).map((tt) => [tt.id, tt]));

    const rows = (regs ?? []).map((r) => {
      const student = studentsMap.get(r.student_id);
      const testType = testTypesMap.get(r.test_type_id);
      return {
        "ZipGrade ID": student?.zipgrade_id ?? "",
        "Аты-жөні": student?.full_name ?? "",
        "Тест түрі": testType?.name_kk ?? "",
        Формат: r.format,
        Аудитория: r.classroom ?? "",
        Орын: r.seat ?? "",
        Вариант: r.test_variant ?? "",
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Тізім");
    const title = trialTests.find((t) => t.id === selectedId)?.title_ru ?? "session";
    XLSX.writeFile(workbook, `${title}-students.xlsx`);
    setDownloading(false);
  }

  async function handleUploadResults(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedId) return;
    setUploading(true);
    setError("");
    setMessage("");

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any>(sheet);

      // Expected columns: ZipGrade ID / Пән / Балл (or English equivalents)
      const parsed = rows
        .map((r) => ({
          test_session_id: selectedId,
          zipgrade_id: String(r["ZipGrade ID"] ?? r["zipgrade_id"] ?? "").trim(),
          subject_label: String(r["Пән"] ?? r["subject"] ?? "").trim(),
          score: Number(r["Балл"] ?? r["score"] ?? 0),
        }))
        .filter((r) => r.zipgrade_id && r.subject_label);

      if (parsed.length === 0) {
        setError("Файлда дұрыс жолдар табылмады. Бағандар: ZipGrade ID, Пән, Балл.");
        setUploading(false);
        return;
      }

      const { error: upsertErr } = await supabase
        .from("results")
        .upsert(parsed, { onConflict: "test_session_id,zipgrade_id,subject_label" });

      if (upsertErr) {
        setError(upsertErr.message);
        setUploading(false);
        return;
      }

      setMessage(`${parsed.length} жол сәтті жүктелді.`);
    } catch (err: any) {
      setError(err?.message ?? "Файлды оқу кезінде қате шықты.");
    }
    setUploading(false);
    e.target.value = "";
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-admin">Жүктеу / түсіру</h1>

      <select
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        className="focus-ring mt-4 w-full max-w-md rounded-xl border border-ink/15 px-3 py-2 text-sm"
      >
        <option value="">— пробный тестті таңдау —</option>
        {trialTests.map((t) => (
          <option key={t.id} value={t.id}>
            {t.title_kk} / {t.title_ru} — {t.session_date}
          </option>
        ))}
      </select>

      {selectedId && (
        <div className="mt-6 flex flex-col gap-6">
          <div className="rounded-2xl border border-ink/10 bg-white p-5">
            <p className="font-semibold text-ink">Тіркелген оқушылар тізімі</p>
            <p className="mt-1 text-sm text-ink/60">
              Аудитория/орын/вариантты толтыру үшін офлайн басып шығаруға дайындау.
            </p>
            <button
              onClick={handleDownloadStudents}
              disabled={downloading}
              className="focus-ring mt-3 rounded-full bg-admin px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {downloading ? "Жүктелуде..." : "Excel-ге жүктеп алу"}
            </button>
          </div>

          <div className="rounded-2xl border border-ink/10 bg-white p-5">
            <p className="font-semibold text-ink">Қорытынды нәтижелерді жүктеу</p>
            <p className="mt-1 text-sm text-ink/60">
              Онлайн және офлайн нәтижелерді өзіңіз бір файлға біріктіргеннен кейін, дайын файлды осында
              жүктеңіз. Бағандар: <b>ZipGrade ID</b>, <b>Пән</b>, <b>Балл</b>.
            </p>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleUploadResults}
              disabled={uploading}
              className="focus-ring mt-3 block text-sm file:mr-3 file:rounded-full file:border-0 file:bg-admin-soft file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-admin"
            />
            {message && <p className="mt-2 text-sm text-parent">{message}</p>}
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
