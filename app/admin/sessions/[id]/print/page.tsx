"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { removeStoredFile, removeStoredFiles } from "@/lib/storageCleanup";
import { fetchAll, fetchAllByIds } from "@/lib/fetchAll";
import {
  SUBJECT_LABELS,
  SUBJECT_MAX_COUNT,
  TEST_TYPE_SUBJECTS,
  MONOLINGUAL_SUBJECTS,
  type SubjectKey,
} from "@/lib/questions/subjects";
import { buildRoomPdf, printFileKey, type RoomStudent, type SheetPack } from "@/lib/print/buildRoomPdf";
import {
  parseAnswerSheetPack,
  parseKeyTemplate,
  missingFromPack,
  LETTERS,
  type SheetPageIndex,
  type KeyTemplateIndex,
  type Letter,
} from "@/lib/print/answerSheetPack";
import { buildAnswerKeyPdf, type VariantAnswers } from "@/lib/print/buildAnswerKey";

/**
 * Аудитория бойынша басып шығару жинағы.
 *
 * Тексеру алдымен, файл кейін: егер бір оқушыда нұсқа не орын қойылмаса,
 * немесе қажет PDF-тердің біреуі жүктелмесе — ештеңе берілмейді, себебі
 * басып шығару бір рет жасалады және жарты жинақ ең жаман нәтиже.
 *
 * ЖАУАП ПАРАҚТАРЫ. ZipGrade пачкасы — бір пәнге бір файл, ішінде әр
 * оқушының өз беті. Пачка — тізімнің ЖҮКТЕЛГЕН СӘТТЕГІ көшірмесі, ал тізім
 * өзгереді. Кейін тіркелген бала пачкада жоқ болса, ол парақсыз қалады да,
 * мұны аудиторияда ғана білер едік. Сондықтан тексерілетіні «файл бар ма»
 * емес, «файл тізіммен сәйкес пе».
 *
 * КІЛТ. Бөлек бос бланк жүктеледі, ал жүйе оған дұрыс жауаптарды өзі
 * бояйды — нұсқа сайын бір бет. Қолмен енгізгенде бір қате бүкіл ағынды
 * бүлдіреді, ал ол қате нәтижелерден көрінбейді.
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

type Pack = {
  subject: SubjectKey;
  fileUrl: string;
  pageCount: number;
  questionCount: number;
  pages: SheetPageIndex[];
  uploadedAt: string;
};

/** Бір пәннің жауап парағы бойынша жағдайы. */
type SheetNeed = {
  subject: SubjectKey;
  students: number;
  variants: number[];
  pack: Pack | null;
  /** Пачкада жоқ оқушылар — аты-жөнімен. */
  missing: string[];
  /** Пачкада артық қалған беттер. Кедергі емес, ескерту ғана. */
  extra: number;
  /** Парақтағы сұрақ саны пәнмен сәйкес пе. */
  countOk: boolean;
  /** Кілт үлгісі. */
  template: { fileUrl: string; questionCount: number; index: KeyTemplateIndex } | null;
};

export default function PrintRoomsPage() {
  const params = useParams();
  const sessionId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState("");

  const [sessionTitle, setSessionTitle] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [rooms, setRooms] = useState<string[]>([]);
  const [selectedRoom, setSelectedRoom] = useState("");
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [needs, setNeeds] = useState<Need[]>([]);
  const [sheetNeeds, setSheetNeeds] = useState<SheetNeed[]>([]);
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
      setSheetNeeds([]);
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

    // ---- жауап парақтары және кілт үлгілері ----
    // РФМШ парағын ZipGrade оқи алмайды, оны жүйе өзі салады, кілті қолмен.
    const sheetSubjects = new Map<SubjectKey, RoomStudent[]>();
    list.forEach((st) => {
      st.subjects.forEach((subject) => {
        if (subject === "rfmsh") return;
        const cur = sheetSubjects.get(subject);
        if (cur) cur.push(st);
        else sheetSubjects.set(subject, [st]);
      });
    });

    const [packRows, templateRows] = await Promise.all([
      fetchAll<any>((from, to) =>
        supabase
          .from("answer_sheet_packs")
          .select("subject, file_url, page_count, question_count, pages, uploaded_at")
          .eq("test_session_id", sessionId)
          .order("subject")
          .range(from, to)
      ),
      fetchAll<any>((from, to) =>
        supabase
          .from("answer_key_templates")
          .select("subject, file_url, question_count, index")
          .eq("test_session_id", sessionId)
          .order("subject")
          .range(from, to)
      ),
    ]);

    const packBySubject = new Map<SubjectKey, Pack>(
      packRows.map((p: any) => [
        p.subject as SubjectKey,
        {
          subject: p.subject,
          fileUrl: p.file_url,
          pageCount: p.page_count,
          questionCount: p.question_count,
          pages: (p.pages ?? []) as SheetPageIndex[],
          uploadedAt: p.uploaded_at,
        },
      ])
    );
    const templateBySubject = new Map<SubjectKey, SheetNeed["template"]>(
      templateRows.map((t: any) => [
        t.subject as SubjectKey,
        { fileUrl: t.file_url, questionCount: t.question_count, index: t.index as KeyTemplateIndex },
      ])
    );

    const sheetList: SheetNeed[] = [...sheetSubjects.entries()]
      .map(([subject, subjectStudents]) => {
        const pack = packBySubject.get(subject) ?? null;
        const neededIds = subjectStudents.map((s) => s.zipgradeId);
        const missingIds = pack ? missingFromPack(pack.pages, neededIds) : [];
        const byId = new Map(subjectStudents.map((s) => [s.zipgradeId, s.fullName]));
        return {
          subject,
          students: subjectStudents.length,
          variants: [...new Set(subjectStudents.map((s) => s.variant))].sort((a, b) => a - b),
          pack,
          missing: missingIds.map((id) => `${byId.get(id) ?? "?"} (${id})`),
          extra: pack ? Math.max(0, pack.pages.length - (neededIds.length - missingIds.length)) : 0,
          countOk: pack ? pack.questionCount === SUBJECT_MAX_COUNT[subject] : false,
          template: templateBySubject.get(subject) ?? null,
        };
      })
      .sort((a, b) => a.subject.localeCompare(b.subject));
    setSheetNeeds(sheetList);

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
  const badSheets = sheetNeeds.filter((s) => !s.pack || !s.countOk || s.missing.length > 0);
  const blocked =
    missingFields.length > 0 ||
    missingFiles.length > 0 ||
    badSheets.length > 0 ||
    students.length === 0;

  /** ZipGrade пачкасын жүктеу: алдымен талданады, содан кейін ғана сақталады. */
  async function handleUploadPack(subject: SubjectKey, file: File) {
    setBusy("pack-" + subject);
    setError("");
    setMessage("");
    setProgress("");
    try {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        setError("Тек PDF файл жүктеуге болады.");
        return;
      }

      // 1. Талдау. Файл бүлінген не басқа пәннен болса, қоймаға тимейміз.
      const index = await parseAnswerSheetPack(file, (done, total) =>
        setProgress(`${done} / ${total} бет оқылды`)
      );
      if (index.questionCount !== SUBJECT_MAX_COUNT[subject]) {
        setError(
          `Бұл пачкада ${index.questionCount} сұрақ, ал ${SUBJECT_LABELS[subject]} үшін ${SUBJECT_MAX_COUNT[subject]} керек. Басқа пәннің файлы болуы мүмкін.`
        );
        return;
      }

      // 2. Қоймаға.
      const path = `${sessionId}/${subject}-${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage
        .from("answer-sheets")
        .upload(path, file, { contentType: "application/pdf" });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("answer-sheets").getPublicUrl(path);

      const previousUrl = sheetNeeds.find((s) => s.subject === subject)?.pack?.fileUrl ?? null;

      // 3. Дерекқорға.
      const { error: dbErr } = await supabase.from("answer_sheet_packs").upsert(
        {
          test_session_id: sessionId,
          subject,
          file_url: pub.publicUrl,
          page_count: index.pageCount,
          question_count: index.questionCount,
          pages: index.pages,
          uploaded_at: new Date().toISOString(),
        },
        { onConflict: "test_session_id,subject" }
      );
      if (dbErr) throw dbErr;

      // 4. Жаңасы жазылды — ескісін өшіреміз.
      if (previousUrl && previousUrl !== pub.publicUrl) {
        await removeStoredFile("answer-sheets", previousUrl);
      }

      await load();
      setMessage(`${SUBJECT_LABELS[subject]}: ${index.pageCount} парақ жүктелді.`);
    } catch (err: any) {
      console.error(err);
      setError("Пачка жүктелмеді: " + (err?.message ?? "белгісіз"));
    } finally {
      setBusy("");
      setProgress("");
    }
  }

  /** Кілт үлгісін — бос бланкті — жүктеу. */
  async function handleUploadTemplate(subject: SubjectKey, file: File) {
    setBusy("tpl-" + subject);
    setError("");
    setMessage("");
    try {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        setError("Тек PDF файл жүктеуге болады.");
        return;
      }

      const index = await parseKeyTemplate(file);
      if (index.questionCount !== SUBJECT_MAX_COUNT[subject]) {
        setError(
          `Бұл бланкте ${index.questionCount} сұрақ, ал ${SUBJECT_LABELS[subject]} үшін ${SUBJECT_MAX_COUNT[subject]} керек.`
        );
        return;
      }

      const path = `${sessionId}/key-${subject}-${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage
        .from("answer-sheets")
        .upload(path, file, { contentType: "application/pdf" });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("answer-sheets").getPublicUrl(path);

      const previousUrl = sheetNeeds.find((s) => s.subject === subject)?.template?.fileUrl ?? null;

      const { error: dbErr } = await supabase.from("answer_key_templates").upsert(
        {
          test_session_id: sessionId,
          subject,
          file_url: pub.publicUrl,
          question_count: index.questionCount,
          index,
          uploaded_at: new Date().toISOString(),
        },
        { onConflict: "test_session_id,subject" }
      );
      if (dbErr) throw dbErr;

      if (previousUrl && previousUrl !== pub.publicUrl) {
        await removeStoredFile("answer-sheets", previousUrl);
      }

      await load();
      setMessage(`${SUBJECT_LABELS[subject]}: кілт үлгісі жүктелді.`);
    } catch (err: any) {
      console.error(err);
      setError("Үлгі жүктелмеді: " + (err?.message ?? "белгісіз"));
    } finally {
      setBusy("");
    }
  }

  /** Дұрыс жауаптары боялған парақтарды құрастыру — нұсқа сайын бір бет. */
  async function handleBuildKey(sn: SheetNeed) {
    if (!sn.template) return;
    setBusy("key-" + sn.subject);
    setError("");
    setMessage("");
    try {
      const rows = await fetchAll<any>((from, to) =>
        supabase
          .from("questions")
          .select("variant_number, question_number, answer_format, choices, correct_answer")
          .eq("session_id", sessionId)
          .eq("subject", sn.subject)
          .in("variant_number", sn.variants)
          .order("variant_number")
          .order("question_number")
          .range(from, to)
      );

      const answers = new Map<number, VariantAnswers>();
      sn.variants.forEach((v) => answers.set(v, new Map()));

      rows.forEach((q: any) => {
        const letter = letterOf(q);
        if (!letter) return;
        answers.get(q.variant_number)?.set(q.question_number, letter);
      });

      // Толық емес нұсқа — кілт те толық емес. Бұл үнсіз өтпеуі керек.
      const gaps: string[] = [];
      for (const v of sn.variants) {
        const got = answers.get(v)!;
        const missing: number[] = [];
        for (let n = 1; n <= sn.template.questionCount; n++) if (!got.has(n)) missing.push(n);
        if (missing.length > 0) {
          gaps.push(
            `${v}-нұсқа: ${missing.length} сұрақтың дұрыс жауабы жоқ (${missing
              .slice(0, 8)
              .join(", ")}${missing.length > 8 ? "…" : ""})`
          );
        }
      }
      if (gaps.length > 0) {
        setError(`${SUBJECT_LABELS[sn.subject]} — ${gaps.join("; ")}`);
        return;
      }

      const templateBytes = await fetch(sn.template.fileUrl).then((r) => r.arrayBuffer());
      const blob = await buildAnswerKeyPdf({
        sessionTitle,
        sessionDate,
        subject: sn.subject,
        templateBytes,
        index: sn.template.index,
        answers,
      });

      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `kilt-${sn.subject}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err: any) {
      console.error(err);
      setError("Кілт құрастырылмады: " + (err?.message ?? "белгісіз"));
    } finally {
      setBusy("");
    }
  }

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

      // Жауап парақтары да бір рет.
      const sheetsMap = new Map<SubjectKey, SheetPack>();
      for (const sn of sheetNeeds) {
        if (!sn.pack) continue;
        const res = await fetch(sn.pack.fileUrl);
        sheetsMap.set(sn.subject, { bytes: await res.arrayBuffer(), pages: sn.pack.pages });
      }

      const blob = await buildRoomPdf({
        sessionTitle,
        sessionDate,
        classroom: selectedRoom,
        students: roomStudents,
        files: filesMap,
        sheets: sheetsMap,
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
      // Алдымен сілтемелерді жинап аламыз — жазбалар өшкен соң оларды
      // табу мүмкін болмайды, ал файлдар қоймада қалып қояр еді.
      const { data: files } = await supabase
        .from("print_files")
        .select("file_url")
        .eq("test_session_id", sessionId);
      const { data: packs } = await supabase
        .from("answer_sheet_packs")
        .select("file_url")
        .eq("test_session_id", sessionId);
      const { data: templates } = await supabase
        .from("answer_key_templates")
        .select("file_url")
        .eq("test_session_id", sessionId);

      await supabase.from("print_files").delete().eq("test_session_id", sessionId);
      await supabase.from("answer_sheet_packs").delete().eq("test_session_id", sessionId);
      await supabase.from("answer_key_templates").delete().eq("test_session_id", sessionId);
      await removeStoredFiles("print-files", (files ?? []).map((f: any) => f.file_url));
      await removeStoredFiles(
        "answer-sheets",
        [...(packs ?? []), ...(templates ?? [])].map((p: any) => p.file_url)
      );
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
        Әр оқушының әр пәні алдында оның өз жауап парағы: аты, нұсқасы, аудиториясы, орны, ал
        «Нұсқа» шеңбері боялған. Екі жақты басып шығаруға дайын.
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

      {sheetNeeds.length > 0 && (
        <section className="mt-4 rounded-2xl border border-ink/10 bg-white p-5">
          <h2 className="font-display text-lg font-bold text-ink">
            Жауап парақтары:{" "}
            {sheetNeeds.filter((s) => s.pack && s.countOk && s.missing.length === 0).length} /{" "}
            {sheetNeeds.length}
          </h2>
          <p className="mt-1 text-sm text-ink/60">
            ZipGrade-те пән бойынша пачка жасайсыз да, PDF-ін осында жүктейсіз. Тізім өзгерсе
            (жаңа бала қосылса) пачканы қайта жасап, қайта жүктеу керек.
          </p>

          <div className="mt-3 flex flex-col gap-1.5">
            {sheetNeeds.map((s) => {
              const ok = s.pack && s.countOk && s.missing.length === 0;
              return (
                <div
                  key={s.subject}
                  className={`rounded-xl border px-4 py-2.5 text-sm ${
                    ok ? "border-ink/10 bg-white" : "border-red-200 bg-red-50"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-ink">{SUBJECT_LABELS[s.subject]}</span>
                    <span className="flex items-center gap-3">
                      <span className="font-mono text-xs text-ink/50">{s.students} оқушы</span>
                      <span className={`font-mono text-xs ${ok ? "text-parent" : "text-red-600"}`}>
                        {!s.pack
                          ? "пачка жоқ"
                          : !s.countOk
                          ? `парақта ${s.pack.questionCount} сұрақ`
                          : s.missing.length > 0
                          ? `${s.missing.length} оқушының парағы жоқ`
                          : "дайын ✓"}
                      </span>
                      <label className="focus-ring cursor-pointer rounded-full border border-ink/15 px-3 py-1 text-xs font-semibold text-ink/70 hover:bg-ink/5">
                        {busy === "pack-" + s.subject ? progress || "Оқылуда..." : "PDF жүктеу"}
                        <input
                          type="file"
                          accept="application/pdf"
                          className="hidden"
                          disabled={busy !== ""}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            e.target.value = "";
                            if (f) handleUploadPack(s.subject, f);
                          }}
                        />
                      </label>
                    </span>
                  </div>

                  {s.missing.length > 0 && (
                    <ul className="mt-2 max-h-32 list-disc overflow-auto pl-5 text-xs text-red-700">
                      {s.missing.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                  )}
                  {s.pack && s.countOk && s.missing.length === 0 && s.extra > 0 && (
                    <p className="mt-1 text-xs text-ink/45">
                      Пачкада {s.extra} артық парақ бар — брондауын алып тастағандар. Кедергі емес,
                      олар жинаққа кірмейді.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {sheetNeeds.length > 0 && (
        <section className="mt-4 rounded-2xl border border-ink/10 bg-white p-5">
          <h2 className="font-display text-lg font-bold text-ink">
            Жауап кілті: {sheetNeeds.filter((s) => s.template).length} / {sheetNeeds.length}
          </h2>
          <p className="mt-1 text-sm text-ink/60">
            ZipGrade-те пән бойынша БОС бланк жасаңыз — тізімсіз, бір бет — және осында жүктеңіз.
            Содан кейін «Кілт жүктеу» дұрыс жауаптары боялған парақтарды береді, нұсқа сайын бір
            бет. Оларды басып шығарып, ZipGrade-ке кілт ретінде сканерлейсіз.
          </p>
          <p className="mt-1 text-xs text-ink/45">
            РФМШ мұнда жоқ: онда жауап — сан, шеңбер жоқ. Оның кілті қолмен қалады.
          </p>

          <div className="mt-3 flex flex-col gap-1.5">
            {sheetNeeds.map((s) => (
              <div
                key={s.subject}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-2.5 text-sm ${
                  s.template ? "border-ink/10 bg-white" : "border-ink/10 bg-ink/[0.02]"
                }`}
              >
                <span className="text-ink">{SUBJECT_LABELS[s.subject]}</span>
                <span className="flex items-center gap-3">
                  <span className="font-mono text-xs text-ink/50">
                    {s.variants.length} нұсқа
                  </span>
                  <span
                    className={`font-mono text-xs ${s.template ? "text-parent" : "text-ink/40"}`}
                  >
                    {s.template ? "үлгі дайын ✓" : "үлгі жоқ"}
                  </span>
                  <label className="focus-ring cursor-pointer rounded-full border border-ink/15 px-3 py-1 text-xs font-semibold text-ink/70 hover:bg-ink/5">
                    {busy === "tpl-" + s.subject ? "Оқылуда..." : "Бос бланк жүктеу"}
                    <input
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      disabled={busy !== ""}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) handleUploadTemplate(s.subject, f);
                      }}
                    />
                  </label>
                  <button
                    onClick={() => handleBuildKey(s)}
                    disabled={!s.template || busy !== ""}
                    className="focus-ring rounded-full bg-admin px-4 py-1 text-xs font-semibold text-white disabled:opacity-30"
                  >
                    {busy === "key-" + s.subject ? "Құрастырылуда..." : "Кілт жүктеу"}
                  </button>
                </span>
              </div>
            ))}
          </div>
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
            Құрастырылған файл сақталмайды — жүктеп алып, басып шығарасыз. Принтерде «100%»
            («Actual size») қойыңыз, «бетке шақтау» емес.
          </p>
        </section>
      )}

      {(needs.some((n) => n.ready) || sheetNeeds.some((s) => s.pack || s.template)) && (
        <section className="mt-4 rounded-2xl border border-ink/10 bg-white p-5">
          <h2 className="font-display text-sm font-bold text-ink">Орынды босату</h2>
          <p className="mt-1 text-xs text-ink/50">
            Байқау өткеннен кейін PDF-тер де, жауап парақтары мен кілт үлгілері де керек емес.
            Сұрақтар базада қалады.
          </p>
          <button
            onClick={handleClearPdfs}
            disabled={busy !== ""}
            className="focus-ring mt-3 rounded-full border border-ink/15 px-4 py-2 text-xs font-semibold text-ink/60 hover:bg-ink/5 disabled:opacity-50"
          >
            {busy === "clear" ? "Өшірілуде..." : "Барлық файлды өшіру"}
          </button>
        </section>
      )}

      {message && <p className="mt-4 text-sm text-parent">{message}</p>}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </div>
  );
}

/**
 * Сұрақтың дұрыс жауабын әріпке айналдыру.
 *   abcd     — choices ішіндегі correct белгісі бойынша
 *   quantity — correct_answer-де 'A'…'D' болып тұр
 *   numeric  — әріп жоқ (РФМШ), кілт парағына түспейді
 */
function letterOf(q: any): Letter | null {
  if (q.answer_format === "abcd") {
    const i = (q.choices ?? []).findIndex((c: any) => c?.correct);
    return i >= 0 && i < LETTERS.length ? LETTERS[i] : null;
  }
  if (q.answer_format === "quantity") {
    const v = String(q.correct_answer ?? "").trim().toUpperCase();
    return (LETTERS as readonly string[]).includes(v) ? (v as Letter) : null;
  }
  return null;
}
