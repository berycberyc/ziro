"use client";

import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { fetchAll, fetchAllByIds } from "@/lib/fetchAll";
import {
  buildSeatPassesPdf,
  compareSeats,
  loadPhotoForPdf,
  type SeatPassStudent,
} from "@/lib/print/buildSeatPassesPdf";

type TrialTest = { id: string; title_kk: string; title_ru: string; session_date: string };

export default function UploadDownloadPage() {
  const [trialTests, setTrialTests] = useState<TrialTest[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingClassroom, setUploadingClassroom] = useState(false);
  const [classroomMessage, setClassroomMessage] = useState("");
  const [classroomError, setClassroomError] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Аудитория парақтары
  const [rooms, setRooms] = useState<string[]>([]);
  const [roomsVersion, setRoomsVersion] = useState(0);
  const [selectedRoom, setSelectedRoom] = useState("");
  const [buildingPasses, setBuildingPasses] = useState(false);
  const [passesProgress, setPassesProgress] = useState("");
  const [passesMessage, setPassesMessage] = useState("");
  const [passesError, setPassesError] = useState("");

  useEffect(() => {
    supabase
      .from("test_sessions")
      .select("id, title_kk, title_ru, session_date")
      .order("session_date", { ascending: false })
      .then(({ data }) => setTrialTests(data ?? []));
  }, []);

  // Таңдалған сессиядағы аудиториялар тізімі. Аудитория/орын файлы жаңадан
  // жүктелгенде (roomsVersion өседі) тізім қайта оқылады.
  useEffect(() => {
    setSelectedRoom("");
    setRooms([]);
    setPassesMessage("");
    setPassesError("");
    if (!selectedId) return;
    let cancelled = false;
    fetchAll<{ id: string; classroom: string | null }>((from, to) =>
      supabase
        .from("registrations")
        .select("id, classroom")
        .eq("test_session_id", selectedId)
        .not("classroom", "is", null)
        .order("id")
        .range(from, to)
    )
      .then((rows) => {
        if (cancelled) return;
        const set = new Set(rows.map((r) => (r.classroom ?? "").trim()).filter(Boolean));
        setRooms([...set].sort(compareSeats));
      })
      .catch((err) => {
        if (!cancelled) setPassesError("Аудиториялар тізімін оқу қатесі: " + (err?.message ?? "белгісіз"));
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, roomsVersion]);

  async function handleDownloadRoomPasses() {
    if (!selectedId || !selectedRoom) return;
    setBuildingPasses(true);
    setPassesError("");
    setPassesMessage("");
    setPassesProgress("Деректер оқылуда...");

    try {
      const { data: session, error: sessErr } = await supabase
        .from("test_sessions")
        .select("title_kk, session_date, start_time")
        .eq("id", selectedId)
        .single();
      if (sessErr || !session) throw new Error(sessErr?.message ?? "Сессия табылмады");

      // Осы аудиторияға жазылғандардың бәрі: төлегені де, төлемегені де.
      const regs = await fetchAll<any>((from, to) =>
        supabase
          .from("registrations")
          .select("id, short_code, format, payment_status, classroom, seat, test_variant, student_id, test_type_id")
          .eq("test_session_id", selectedId)
          .eq("classroom", selectedRoom)
          .order("id")
          .range(from, to)
      );
      if (regs.length === 0) throw new Error("Бұл аудиторияда оқушы жоқ.");

      const [studentRows, typeRows] = await Promise.all([
        fetchAllByIds<any>(
          regs.map((r) => r.student_id),
          (chunk) =>
            supabase
              .from("students")
              .select("id, full_name, first_name, last_name, language, photo_url, zipgrade_id")
              .in("id", chunk)
        ),
        fetchAllByIds<any>(
          regs.map((r) => r.test_type_id),
          (chunk) => supabase.from("test_types").select("id, code, name_kk").in("id", chunk)
        ),
      ]);
      const studentById = new Map<string, any>(studentRows.map((s) => [s.id as string, s]));
      const typeById = new Map<string, any>(typeRows.map((t) => [t.id as string, t]));

      // Орны немесе нұсқасы жоқ оқушылар файлға кірмейді, бірақ қайсысы екенін айтамыз.
      const skipped: string[] = [];
      const ready = regs.filter((r) => {
        const ok = String(r.seat ?? "").trim() !== "" && String(r.test_variant ?? "").trim() !== "";
        if (!ok) skipped.push(studentById.get(r.student_id)?.full_name ?? r.id);
        return ok;
      });
      if (ready.length === 0) throw new Error("Орны мен нұсқасы толтырылған оқушы жоқ.");

      // Фамилия/аты бөлек өрістерде; бос болса full_name-ді бөлеміз.
      const splitName = (s: any) => {
        if (s?.last_name || s?.first_name) return { last: s.last_name ?? "", first: s.first_name ?? "" };
        const full = String(s?.full_name ?? "").trim();
        const i = full.indexOf(" ");
        return i > 0 ? { last: full.slice(0, i), first: full.slice(i + 1).trim() } : { last: full, first: "" };
      };

      // Фотоларды бірнеше-бірнеден параллель жүктейміз.
      const students: SeatPassStudent[] = [];
      const BATCH = 6;
      for (let i = 0; i < ready.length; i += BATCH) {
        setPassesProgress(`Фотолар жүктелуде: ${Math.min(i + BATCH, ready.length)} / ${ready.length}`);
        const chunk = ready.slice(i, i + BATCH);
        const photos = await Promise.all(
          chunk.map((r) => loadPhotoForPdf(studentById.get(r.student_id)?.photo_url))
        );
        chunk.forEach((r, k) => {
          const s = studentById.get(r.student_id);
          const t = typeById.get(r.test_type_id);
          const nm = splitName(s);
          students.push({
            lastName: nm.last,
            firstName: nm.first,
            classroom: String(r.classroom ?? "").trim(),
            seat: String(r.seat).trim(),
            variant: String(r.test_variant).trim(),
            lang: s?.language === "ru" ? "ru" : s?.language === "kk" ? "kk" : null,
            format: r.format === "online" ? "online" : "offline",
            paid: r.payment_status === "paid",
            testTypeCode: t?.code ?? "",
            testTypeName: t?.name_kk ?? "",
            studentId: String(s?.zipgrade_id ?? "").trim(),
            bookingCode: String(r.short_code ?? "").trim(),
            qrText: r.short_code ?? r.id,
            photo: photos[k],
          });
        });
      }

      setPassesProgress("PDF жасалуда...");
      const [fontRegular, fontBold, logoPng] = await Promise.all(
        ["/fonts/print-sans.ttf", "/fonts/print-sans-bold.ttf", "/logo-wide.png"].map((u) =>
          fetch(u).then((r) => {
            if (!r.ok) throw new Error("Файл табылмады: " + u);
            return r.arrayBuffer();
          })
        )
      );

      const bytes = await buildSeatPassesPdf({
        sessionTitle: (session as any).title_kk ?? "",
        sessionDate: (session as any).session_date ?? "",
        sessionTime: (session as any).start_time ?? null,
        students,
        assets: { fontRegular, fontBold, logoPng },
        onProgress: (d, n) => setPassesProgress(`Беттер жасалуда: ${d} / ${n}`),
      });

      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `auditoriya-${selectedRoom.replace(/[^0-9A-Za-zА-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүІіҺһ-]+/g, "_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);

      const unpaid = students.filter((s) => !s.paid).length;
      setPassesMessage(
        `Дайын: ${students.length} бет.` +
          (unpaid > 0 ? ` Төлемі жоқ: ${unpaid}.` : "") +
          (skipped.length > 0
            ? ` Орны не нұсқасы жоқ болғандықтан кірмеді (${skipped.length}): ${skipped.join(", ")}.`
            : "")
      );
    } catch (err: any) {
      setPassesError("PDF жасалмады: " + (err?.message ?? "белгісіз қате"));
    }
    setBuildingPasses(false);
    setPassesProgress("");
  }

  async function handleDownloadStudents() {
    if (!selectedId) return;
    setDownloading(true);
    setError("");

    let regs: any[] = [];
    let studentsData: any[] = [];
    let testTypesData: any[] = [];
    try {
      regs = await fetchAll<any>((from, to) =>
        supabase
          .from("registrations")
          .select("id, format, payment_status, classroom, seat, test_variant, student_id, test_type_id")
          .eq("test_session_id", selectedId)
          .order("id")
          .range(from, to)
      );

      const studentIds = regs.map((r) => r.student_id);
      const testTypeIds = regs.map((r) => r.test_type_id);

      [studentsData, testTypesData] = await Promise.all([
        fetchAllByIds<any>(studentIds, (chunk) =>
          supabase
            .from("students")
            .select("id, first_name, last_name, iin, language, grade, region, city, school, zipgrade_id")
            .in("id", chunk)
        ),
        fetchAllByIds<any>(testTypeIds, (chunk) =>
          supabase.from("test_types").select("id, name_kk, name_ru").in("id", chunk)
        ),
      ]);
    } catch (err: any) {
      setError("Тізімді жүктеу кезінде қате шықты: " + (err?.message ?? "белгісіз қате"));
      setDownloading(false);
      return;
    }

    const studentsMap = new Map(studentsData.map((s) => [s.id, s]));
    const testTypesMap = new Map(testTypesData.map((tt) => [tt.id, tt]));

    const rows = regs.map((r) => {
      const student = studentsMap.get(r.student_id);
      const testType = testTypesMap.get(r.test_type_id);
      return {
        "Тіркеу ID": r.id,
        "ZipGrade ID": student?.zipgrade_id ?? "",
        "Тегі": student?.last_name ?? "",
        "Аты": student?.first_name ?? "",
        "ИИН": student?.iin ?? "",
        "Тіл": student?.language ?? "",
        "Сынып": student?.grade ?? "",
        "Облыс": student?.region ?? "",
        "Қала": student?.city ?? "",
        "Мектеп": student?.school ?? "",
        "Тест түрі": testType?.name_kk ?? "",
        Формат: r.format,
        "Төлем": r.payment_status === "paid" ? "Төленді" : "Күтілуде",
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

  async function handleUploadClassroomAssignments(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingClassroom(true);
    setClassroomError("");
    setClassroomMessage("");

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any>(sheet);

      let updated = 0;
      for (const r of rows) {
        const regId = String(r["Тіркеу ID"] ?? r["registration_id"] ?? "").trim();
        if (!regId) continue;

        const classroom = String(r["Аудитория"] ?? r["classroom"] ?? "").trim();
        const seat = String(r["Орын"] ?? r["seat"] ?? "").trim();
        const variant = String(r["Вариант"] ?? r["variant"] ?? "").trim();

        const { error: updErr } = await supabase
          .from("registrations")
          .update({
            classroom: classroom || null,
            seat: seat || null,
            test_variant: variant || null,
          })
          .eq("id", regId);

        if (!updErr) updated += 1;
      }

      if (updated === 0) {
        setClassroomError("Файлда \"Тіркеу ID\" бағаны бойынша сәйкестік табылмады.");
      } else {
        setClassroomMessage(`${updated} тіркеу жаңартылды.`);
        setRoomsVersion((v) => v + 1);
      }
    } catch (err: any) {
      setClassroomError(err?.message ?? "Файлды оқу кезінде қате шықты.");
    }
    setUploadingClassroom(false);
    e.target.value = "";
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

      // Үлкен файлды бір сұраныспен жіберу тәуекелді — бөліктеп жүктейміз.
      const CHUNK = 500;
      for (let i = 0; i < parsed.length; i += CHUNK) {
        const { error: upsertErr } = await supabase
          .from("results")
          .upsert(parsed.slice(i, i + CHUNK), {
            onConflict: "test_session_id,zipgrade_id,subject_label",
          });

        if (upsertErr) {
          setError(upsertErr.message);
          setUploading(false);
          return;
        }
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
        <option value="">— байқау тестті таңдау —</option>
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
              Барлық тіркелгендер (төлегендер де, төлемегендер де) — "Төлем" бағанынан ажыратуға
              болады. Аудитория/орын/вариантты толтыру үшін офлайн басып шығаруға дайындау.
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
            <p className="font-semibold text-ink">Аудитория/орын/вариантты жүктеу</p>
            <p className="mt-1 text-sm text-ink/60">
              Жоғарыдағы файлды толтырғаннан кейін (Аудитория/Орын/Вариант бағандары), осында қайта
              жүктеңіз — "Тіркеу ID" бойынша сәйкестендіріледі.
            </p>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleUploadClassroomAssignments}
              disabled={uploadingClassroom}
              className="focus-ring mt-3 block text-sm file:mr-3 file:rounded-full file:border-0 file:bg-admin-soft file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-admin"
            />
            {classroomMessage && <p className="mt-2 text-sm text-parent">{classroomMessage}</p>}
            {classroomError && <p className="mt-2 text-sm text-red-600">{classroomError}</p>}
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

          <div className="rounded-2xl border border-ink/10 bg-white p-5">
            <p className="font-semibold text-ink">Аудитория парақтары (PDF)</p>
            <p className="mt-1 text-sm text-ink/60">
              Аудиторияны таңдаңыз — әр оқушыға бір A4 бет шығады, орын бойынша реттелген: аудитория мен
              орын ірі, фото, QR, нұсқа және сессия мәліметтері бар. Парақты оқушы отыратын партаға қоюға
              болады. Тек орны мен нұсқасы толтырылған оқушылар кіреді; төлемі жоқтарға қызыл белгі
              қойылады.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <select
                value={selectedRoom}
                onChange={(e) => setSelectedRoom(e.target.value)}
                disabled={buildingPasses}
                className="focus-ring rounded-xl border border-ink/15 px-3 py-2 text-sm"
              >
                <option value="">— аудиторияны таңдау —</option>
                {rooms.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <button
                onClick={handleDownloadRoomPasses}
                disabled={!selectedRoom || buildingPasses}
                className="focus-ring rounded-full bg-admin px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {buildingPasses ? passesProgress || "Жасалуда..." : "PDF жүктеп алу"}
              </button>
            </div>
            {rooms.length === 0 && (
              <p className="mt-2 text-sm text-ink/50">
                Бұл сессияда аудитория әлі жазылмаған. Алдымен жоғарыдағы файлмен аудитория/орынды жүктеңіз.
              </p>
            )}
            {passesMessage && <p className="mt-2 text-sm text-parent">{passesMessage}</p>}
            {passesError && <p className="mt-2 text-sm text-red-600">{passesError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
