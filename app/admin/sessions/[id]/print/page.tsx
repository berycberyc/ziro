"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { fetchAll, fetchAllByIds } from "@/lib/fetchAll";
import {
  SUBJECT_LABELS,
  TEST_TYPE_SUBJECTS,
  MONOLINGUAL_SUBJECTS,
  type SubjectKey,
} from "@/lib/questions/subjects";
import { buildRoomPdf, printFileKey, type RoomStudent } from "@/lib/print/buildRoomPdf";

/**
 * Аудитория бойынша басып шығару жинағы.
 *
 * Тексеру алдымен, файл кейін: егер бір оқушыда нұсқа не орын қойылмаса,
 * немесе қажет PDF-тердің біреуі жүктелмесе — ештеңе берілмейді, себебі
 * басып шығару бір рет жасалады және жарты жинақ ең жаман нәтиже.
 *
 * Тек қажет файлдар талап етіледі: егер осы сессияда РФМШ таңдаған оқушы
 * болмаса, РФМШ PDF-і сұралмайды.
 */

type Booking = {
  id: string;
  short_code: string;
  classroom: string | null;
  seat: string | null;
  test_variant: string | null;
  student_id: string;
  test_type_id: string;
};

type Need = {
  subject: SubjectKey;
  variant: number;
  lang: "kk" | "ru";
  students: number;
  ready: boolean;
  url?: string;
};

export default function PrintRoomsPage() {
  const params = useParams();
  const sessionId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");

  const [sessionTitle, setSessionTitle] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [rooms, setRooms] = useState<string[]>([]);
  const [selectedRoom, setSelectedRoom] = useState("");
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [needs, setNeeds] = useState<Need[]>([]);
  const [students, setStudents] = useState<RoomStudent[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data: session } = await supabase
      .from("test_sessions")
      .select("title_kk, session_date")
      .eq("id", sessionId)
      .single();
    setSessionTitle((session as any)?.title_kk ?? "");
    setSessionDate((session as any)?.session_date ?? "");

    // Тек офлайн және төлемі расталған брондаулар басып шығарылады.
    const bookings = await fetchAll<Booking>((from, to) =>
      supabase
        .from("registrations")
        .select("id, short_code, classroom, seat, test_variant, student_id, test_type_id")
        .eq("test_session_id", sessionId)
        .eq("format", "offline")
        .eq("payment_status", "paid")
        .order("id")
        .range(from, to)
    );

    if (bookings.length === 0) {
      setStudents([]);
      setNeeds([]);
      setMissingFields([]);
      setLoading(false);
      return;
    }

    const [studentRows, typeRows] = await Promise.all([
      fetchAllByIds<any>(
        bookings.map((b) => b.student_id),
        (chunk) =>
          supabase.from("students").select("id, full_name, zipgrade_id, language").in("id", chunk)
      ),
      fetchAllByIds<any>(
        bookings.map((b) => b.test_type_id),
        (chunk) => supabase.from("test_types").select("id, code").in("id", chunk)
      ),
    ]);
    const studentById = new Map<string, any>(studentRows.map((s) => [s.id as string, s]));
    const typeById = new Map<string, any>(typeRows.map((t) => [t.id as string, t]));

    // ---- толтырылмаған өрістерді жинау ----
    const problems: string[] = [];
    const list: RoomStudent[] = [];

    bookings.forEach((b) => {
      const s = studentById.get(b.student_id);
      const t = typeById.get(b.test_type_id);
      const name = s?.full_name ?? "(аты жоқ)";
      const gaps: string[] = [];

      const variant = parseInt(String(b.test_variant ?? "").replace(/\D/g, ""), 10);
      if (!variant) gaps.push("нұсқа");
      if (!b.classroom) gaps.push("аудитория");
      if (!b.seat) gaps.push("орын");
      if (!s?.language) gaps.push("тіл");
      if (!s?.zipgrade_id) gaps.push("ZipGrade ID");

      const subjects = (TEST_TYPE_SUBJECTS[t?.code] ?? []) as SubjectKey[];
      if (subjects.length === 0) gaps.push("тест түрі");

      if (gaps.length > 0) {
        problems.push(`${name} — ${gaps.join(", ")} жоқ`);
        return;
      }

      list.push({
        fullName: name,
        zipgradeId: s.zipgrade_id,
        shortCode: b.short_code,
        classroom: b.classroom!,
        seat: b.seat!,
        variant,
        lang: s.language === "ru" ? "ru" : "kk",
        testTypeCode: t.code,
        subjects,
      });
    });

    setMissingFields(problems);

    // ---- қандай PDF-тер керек ----
    const needMap = new Map<string, Need>();
    list.forEach((st) => {
      st.subjects.forEach((subject) => {
        // Тілдер бір тілде — барлығына бір файл, ол 'kk' болып сақталады.
        const lang = MONOLINGUAL_SUBJECTS.includes(subject) ? "kk" : st.lang;
        const key = printFileKey(subject, st.variant, lang);
        const cur = needMap.get(key);
        if (cur) cur.students++;
        else needMap.set(key, { subject, variant: st.variant, lang, students: 1, ready: false });
      });
    });

    const printRows = await fetchAll<any>((from, to) =>
      supabase
        .from("print_files")
        .select("subject, variant_number, lang, file_url")
        .eq("test_session_id", sessionId)
        .order("id")
        .range(from, to)
    );
    printRows.forEach((f) => {
      const need = needMap.get(printFileKey(f.subject, f.variant_number, f.lang));
      if (need) {
        need.ready = true;
        need.url = f.file_url;
      }
    });

    const needList = [...needMap.values()].sort(
      (a, b) =>
        a.subject.localeCompare(b.subject) || a.variant - b.variant || a.lang.localeCompare(b.lang)
    );
    setNeeds(needList);
    setStudents(list);

    const roomList = [...new Set(list.map((s) => s.classroom))].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true })
    );
    setRooms(roomList);
    setSelectedRoom((prev) => (roomList.includes(prev) ? prev : roomList[0] ?? ""));
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  const missingFiles = needs.filter((n) => !n.ready);
  const blocked = missingFields.length > 0 || missingFiles.length > 0 || students.length === 0;

  async function handleBuild() {
    if (!selectedRoom) return;
    setBusy("build");
    setError("");
    setProgress("");
    try {
      const roomStudents = students
        .filter((s) => s.classroom === selectedRoom)
        .sort((a, b) => a.seat.localeCompare(b.seat, undefined, { numeric: true }));

      // Керекті PDF-терді бір рет жүктеп аламыз.
      const filesMap = new Map<string, ArrayBuffer>();
      for (const need of needs) {
        if (!need.url) continue;
        const key = printFileKey(need.subject, need.variant, need.lang);
        if (filesMap.has(key)) continue;
        const res = await fetch(need.url);
        filesMap.set(key, await res.arrayBuffer());
      }

      const blob = await buildRoomPdf({
        sessionTitle,
        sessionDate,
        classroom: selectedRoom,
        students: roomStudents,
        files: filesMap,
        onProgress: (done, total) => setProgress(`${done} / ${total} оқушы`),
      });

      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `auditoriya-${selectedRoom}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
      setProgress("");
    } catch (err: any) {
      console.error(err);
      setError("Құрастыру кезінде қате: " + (err?.message ?? "белгісіз"));
    } finally {
      setBusy("");
    }
  }

  async function handleClearPdfs() {
    setBusy("clear");
    try {
      await supabase.from("print_files").delete().eq("test_session_id", sessionId);
      await load();
    } finally {
      setBusy("");
    }
  }

  if (loading) return <p className="mt-6 text-sm text-ink/50">Жүктелуде...</p>;

  return (
    <div>
      <Link href={`/admin/sessions/${sessionId}`} className="text-sm text-ink/50 hover:underline">
        ← Сессияға оралу
      </Link>
      <h1 className="font-display text-2xl font-bold text-admin">Аудитория бойынша басып шығару</h1>
      <p className="mt-1 text-sm text-ink/60">
        Әр оқушының әр пәні алдында титул беті: аты, нұсқасы, аудиториясы, орны. Кесіп алып,
        орындарға таратуға дайын.
      </p>

      {students.length === 0 && missingFields.length === 0 && (
        <p className="mt-6 rounded-xl bg-ink/5 px-4 py-3 text-sm text-ink/50">
          Бұл сессияда төлемі расталған офлайн брондау жоқ.
        </p>
      )}

      {missingFields.length > 0 && (
        <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5">
          <h2 className="font-display text-lg font-bold text-red-700">
            Толтырылмаған деректер: {missingFields.length}
          </h2>
          <p className="mt-1 text-sm text-red-700/80">
            Бәрі толтырылмайынша файл берілмейді — жарты жинақ басып шығарудан жаман.
          </p>
          <ul className="mt-3 max-h-64 list-disc overflow-auto pl-5 text-sm text-red-700">
            {missingFields.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </section>
      )}

      {needs.length > 0 && (
        <section className="mt-4 rounded-2xl border border-ink/10 bg-white p-5">
          <h2 className="font-display text-lg font-bold text-ink">
            Қажет PDF файлдар: {needs.filter((n) => n.ready).length} / {needs.length}
          </h2>
          <p className="mt-1 text-sm text-ink/60">
            Тек осы сессияда керегі. PDF-ті «Сұрақтарды енгізу» экранынан, әр пәннің өз бетінен
            жүктейсіз.
          </p>
          <div className="mt-3 flex flex-col gap-1.5">
            {needs.map((n) => (
              <div
                key={printFileKey(n.subject, n.variant, n.lang)}
                className={`flex items-center justify-between rounded-xl border px-4 py-2 text-sm ${
                  n.ready ? "border-ink/10 bg-white" : "border-red-200 bg-red-50"
                }`}
              >
                <span className="text-ink">
                  {SUBJECT_LABELS[n.subject]} · {n.variant}-нұсқа ·{" "}
                  {MONOLINGUAL_SUBJECTS.includes(n.subject)
                    ? "бір тілде"
                    : n.lang === "kk"
                    ? "қазақша"
                    : "орысша"}
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-mono text-xs text-ink/50">{n.students} оқушы</span>
                  <span
                    className={`font-mono text-xs ${n.ready ? "text-parent" : "text-red-600"}`}
                  >
                    {n.ready ? "дайын ✓" : "PDF жоқ"}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {rooms.length > 0 && (
        <section className="mt-4 rounded-2xl border border-ink/10 bg-white p-5">
          <h2 className="font-display text-lg font-bold text-ink">Жинақты жүктеу</h2>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <select
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
              className="focus-ring rounded-xl border border-ink/15 px-3 py-2 text-sm"
            >
              {rooms.map((r) => (
                <option key={r} value={r}>
                  {r} аудитория ({students.filter((s) => s.classroom === r).length} оқушы)
                </option>
              ))}
            </select>

            <button
              onClick={handleBuild}
              disabled={blocked || busy !== ""}
              className="focus-ring rounded-full bg-admin px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              {busy === "build" ? `Құрастырылуда... ${progress}` : "PDF құрастыру"}
            </button>

            {blocked && (
              <span className="text-xs text-red-600">
                Жоғарыдағы кемшіліктер түзетілмейінше құрастыру мүмкін емес.
              </span>
            )}
          </div>
          <p className="mt-3 text-xs text-ink/40">
            Құрастырылған файл сақталмайды — жүктеп алып, басып шығарасыз.
          </p>
        </section>
      )}

      {needs.some((n) => n.ready) && (
        <section className="mt-4 rounded-2xl border border-ink/10 bg-white p-5">
          <h2 className="font-display text-sm font-bold text-ink">Орынды босату</h2>
          <p className="mt-1 text-xs text-ink/50">
            Байқау өткеннен кейін PDF-тер керек емес. Сұрақтар базада қалады.
          </p>
          <button
            onClick={handleClearPdfs}
            disabled={busy !== ""}
            className="focus-ring mt-3 rounded-full border border-ink/15 px-4 py-2 text-xs font-semibold text-ink/60 hover:bg-ink/5 disabled:opacity-50"
          >
            {busy === "clear" ? "Өшірілуде..." : "Барлық PDF-ті өшіру"}
          </button>
        </section>
      )}

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </div>
  );
}
