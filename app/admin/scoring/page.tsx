"use client";

import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { fetchAll } from "@/lib/fetchAll";
import {
  SUBJECT_LABELS,
  SUBJECT_MAX_COUNT,
  TEST_TYPE_SUBJECTS,
  type SubjectKey,
} from "@/lib/questions/subjects";
import {
  parseZipGradeFile,
  buildZipGradeStyleSheet,
  SUBJECT_QUIZ_NAMES,
} from "@/lib/scoring/zipgrade";
import {
  scoreNis,
  scoreBil,
  scoreRfmsh,
  judge,
  type AnswerKeyItem,
  type Sheet,
  type Student,
} from "@/lib/scoring/engine";
import { NIS_SECTIONS, RFMSH_MAX, BIL_SECTIONS, BIL_MAX } from "@/lib/scoring/rules";

type Session = { id: string; title_kk: string; title_ru: string; session_date: string };
type Mismatch = {
  subject: SubjectKey;
  variant: number;
  question: number;
  ours: string;
  zip: string;
};

const IMPORT_SUBJECTS: SubjectKey[] = [
  "math",
  "sandyq",
  "zharatylystanu",
  "tilder",
  "bil",
  "rfmsh",
];

export default function ScoringPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [counts, setCounts] = useState<Record<string, { online: number; zipgrade: number }>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [mismatches, setMismatches] = useState<Mismatch[]>([]);

  useEffect(() => {
    supabase
      .from("test_sessions")
      .select("id, title_kk, title_ru, session_date")
      .order("session_date", { ascending: false })
      .then(({ data }) => {
        setSessions((data as Session[]) ?? []);
        setLoading(false);
      });
  }, []);

  const refreshCounts = async (sessionId: string) => {
    if (!sessionId) return;
    const rows = await fetchAll<any>((from, to) =>
      supabase
        .from("answer_sheets")
        .select("subject, source")
        .eq("test_session_id", sessionId)
        .order("id")
        .range(from, to)
    );
    const map: Record<string, { online: number; zipgrade: number }> = {};
    rows.forEach((r) => {
      const entry = map[r.subject] ?? { online: 0, zipgrade: 0 };
      if (r.source === "online") entry.online++;
      else entry.zipgrade++;
      map[r.subject] = entry;
    });
    setCounts(map);
  };

  useEffect(() => {
    if (selectedId) refreshCounts(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // ---------------------------------------------------------------
  // Ортақ жүктеулер
  // ---------------------------------------------------------------

  async function loadAnswerKey(sessionId: string): Promise<AnswerKeyItem[]> {
    const rows = await fetchAll<any>((from, to) =>
      supabase
        .from("questions")
        .select("subject, variant_number, question_number, answer_format, choices, correct_answer")
        .eq("session_id", sessionId)
        .order("subject")
        .order("variant_number")
        .order("question_number")
        .order("id")
        .range(from, to)
    );

    return rows.map((q) => {
      let correct = "";
      if (q.answer_format === "abcd") {
        const idx = (q.choices ?? []).findIndex((c: any) => c?.correct);
        correct = idx >= 0 ? String.fromCharCode(65 + idx) : "";
      } else {
        correct = q.correct_answer ?? "";
      }
      return {
        subject: q.subject as SubjectKey,
        variant_number: q.variant_number,
        question_number: q.question_number,
        correct,
      };
    });
  }

  async function loadSheets(sessionId: string): Promise<Sheet[]> {
    const rows = await fetchAll<any>((from, to) =>
      supabase
        .from("answer_sheets")
        .select("zipgrade_id, subject, variant_number, answers")
        .eq("test_session_id", sessionId)
        .order("id")
        .range(from, to)
    );
    return rows.map((r) => {
      const answers: Record<number, string> = {};
      Object.keys(r.answers ?? {}).forEach((k) => {
        answers[Number(k)] = String(r.answers[k] ?? "");
      });
      return {
        zipgrade_id: r.zipgrade_id,
        subject: r.subject as SubjectKey,
        variant_number: r.variant_number,
        answers,
      };
    });
  }

  async function loadStudents(ids: string[]): Promise<Map<string, Student>> {
    const map = new Map<string, Student>();
    if (ids.length === 0) return map;
    const rows = await fetchAll<any>((from, to) =>
      supabase
        .from("students")
        .select("zipgrade_id, first_name, last_name")
        .in("zipgrade_id", ids.slice(0, 1000))
        .order("zipgrade_id")
        .range(from, to)
    );
    rows.forEach((s) =>
      map.set(s.zipgrade_id, {
        zipgrade_id: s.zipgrade_id,
        first_name: s.first_name ?? "",
        last_name: s.last_name ?? "",
      })
    );
    return map;
  }

  function download(wb: XLSX.WorkBook, name: string) {
    XLSX.writeFile(wb, name);
  }

  // ---------------------------------------------------------------
  // 1. Онлайн жауаптарды answer_sheets-ке көшіру
  // ---------------------------------------------------------------
  async function handleCollectOnline() {
    setBusy("collect");
    setMessage("");
    setError("");
    try {
      const regs = await fetchAll<any>((from, to) =>
        supabase
          .from("registrations")
          .select("id, test_variant, student_id")
          .eq("test_session_id", selectedId)
          .eq("format", "online")
          .eq("payment_status", "paid")
          .order("id")
          .range(from, to)
      );
      if (regs.length === 0) {
        setError("Бұл сессияда төлемі расталған онлайн брондау жоқ.");
        return;
      }

      const attempts = await fetchAll<any>((from, to) =>
        supabase
          .from("test_attempts")
          .select("registration_id, answers, status")
          .in(
            "registration_id",
            regs.map((r) => r.id)
          )
          .order("registration_id")
          .range(from, to)
      );

      const students = await fetchAll<any>((from, to) =>
        supabase
          .from("students")
          .select("id, zipgrade_id")
          .in(
            "id",
            regs.map((r) => r.student_id)
          )
          .order("id")
          .range(from, to)
      );
      const zipById = new Map<string, string>(students.map((s) => [s.id as string, s.zipgrade_id as string]));
      const regById = new Map<string, any>(regs.map((r) => [r.id as string, r]));

      const rows: any[] = [];
      attempts.forEach((a) => {
        const reg = regById.get(a.registration_id);
        const zip = reg ? zipById.get(reg.student_id) : null;
        if (!zip) return;
        const variant = parseInt(String(reg?.test_variant ?? "1").replace(/\D/g, "") || "1", 10);
        Object.keys(a.answers ?? {}).forEach((subject) => {
          rows.push({
            test_session_id: selectedId,
            zipgrade_id: zip,
            subject,
            variant_number: variant,
            source: "online",
            answers: a.answers[subject] ?? {},
          });
        });
      });

      if (rows.length === 0) {
        setError("Онлайн жауаптар табылмады — әлі ешкім тапсырмаған сияқты.");
        return;
      }

      for (let i = 0; i < rows.length; i += 300) {
        const { error: upErr } = await supabase
          .from("answer_sheets")
          .upsert(rows.slice(i, i + 300), {
            onConflict: "test_session_id,zipgrade_id,subject",
          });
        if (upErr) throw upErr;
      }

      await refreshCounts(selectedId);
      setMessage(`Онлайн жауаптар жиналды: ${rows.length} парақ.`);
    } catch (err: any) {
      console.error(err);
      setError("Қате: " + (err?.message ?? "белгісіз"));
    } finally {
      setBusy("");
    }
  }

  // ---------------------------------------------------------------
  // 2. ZipGrade файлын жүктеу
  // ---------------------------------------------------------------
  async function handleImport(subject: SubjectKey, file: File) {
    setBusy("import-" + subject);
    setMessage("");
    setError("");
    try {
      const parsed = parseZipGradeFile(await file.arrayBuffer());
      if (parsed.rows.length === 0) {
        setError("Файлда жол табылмады. ZipGrade экспортын жүктегеніңізге көз жеткізіңіз.");
        return;
      }

      const expected = SUBJECT_MAX_COUNT[subject];
      if (parsed.questionCount !== expected) {
        setError(
          `Файлда ${parsed.questionCount} сұрақ, ал ${SUBJECT_LABELS[subject]} пәнінде ${expected} болуы керек. Пәнді дұрыс таңдадыңыз ба?`
        );
        return;
      }

      const rows = parsed.rows.map((r) => ({
        test_session_id: selectedId,
        zipgrade_id: r.zipgrade_id,
        subject,
        variant_number: r.variant_number,
        source: "zipgrade",
        answers: r.answers,
      }));

      for (let i = 0; i < rows.length; i += 300) {
        const { error: upErr } = await supabase
          .from("answer_sheets")
          .upsert(rows.slice(i, i + 300), {
            onConflict: "test_session_id,zipgrade_id,subject",
          });
        if (upErr) throw upErr;
      }

      // Кілттерді салыстыру — есептеуге әсер етпейді, тек тексеру.
      const key = await loadAnswerKey(selectedId);
      const found: Mismatch[] = [];
      const seen = new Set<string>();
      parsed.rows.forEach((r) => {
        for (let q = 1; q <= parsed.questionCount; q++) {
          const id = `${r.variant_number}|${q}`;
          if (seen.has(id)) continue;
          seen.add(id);
          const ours =
            key.find(
              (k) =>
                k.subject === subject &&
                k.variant_number === r.variant_number &&
                k.question_number === q
            )?.correct ?? "";
          const zip = r.zipKey[q] ?? "";
          if (ours.toUpperCase() !== zip.toUpperCase()) {
            found.push({ subject, variant: r.variant_number, question: q, ours, zip });
          }
        }
      });

      setMismatches((prev) => [...prev.filter((m) => m.subject !== subject), ...found]);
      await refreshCounts(selectedId);
      setMessage(
        `${SUBJECT_LABELS[subject]}: ${rows.length} оқушы жүктелді.` +
          (found.length > 0 ? ` Кілтте ${found.length} айырмашылық табылды — төменде.` : " Кілт сәйкес келеді ✓")
      );
    } catch (err: any) {
      console.error(err);
      setError("Қате: " + (err?.message ?? "белгісіз"));
    } finally {
      setBusy("");
    }
  }

  // ---------------------------------------------------------------
  // 3. Шикі жауаптарды Excel-ге шығару (ZipGrade форматында)
  // ---------------------------------------------------------------
  async function handleExportRaw() {
    setBusy("export");
    setMessage("");
    setError("");
    try {
      const [sheets, key] = await Promise.all([loadSheets(selectedId), loadAnswerKey(selectedId)]);
      if (sheets.length === 0) {
        setError("Жауаптар жоқ. Алдымен онлайн жауаптарды жинаңыз немесе ZipGrade файлын жүктеңіз.");
        return;
      }
      const students = await loadStudents([...new Set(sheets.map((s) => s.zipgrade_id))]);

      const wb = XLSX.utils.book_new();
      IMPORT_SUBJECTS.forEach((subject) => {
        const list = sheets.filter((s) => s.subject === subject);
        if (list.length === 0) return;

        const rows = list.map((s) => {
          const keyMap: Record<number, string> = {};
          key
            .filter((k) => k.subject === subject && k.variant_number === s.variant_number)
            .forEach((k) => {
              keyMap[k.question_number] = k.correct;
            });
          const st = students.get(s.zipgrade_id);
          return {
            zipgrade_id: s.zipgrade_id,
            first_name: st?.first_name ?? "",
            last_name: st?.last_name ?? "",
            variant_number: s.variant_number,
            answers: s.answers,
            key: keyMap,
          };
        });

        const aoa = buildZipGradeStyleSheet({
          quizName: SUBJECT_QUIZ_NAMES[subject],
          questionCount: SUBJECT_MAX_COUNT[subject],
          rows,
        });
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.aoa_to_sheet(aoa),
          SUBJECT_QUIZ_NAMES[subject].slice(0, 31)
        );
      });

      download(wb, `zhauaptar_${selectedId.slice(0, 8)}.xlsx`);
      setMessage("Шикі жауаптар жүктелді.");
    } catch (err: any) {
      console.error(err);
      setError("Қате: " + (err?.message ?? "белгісіз"));
    } finally {
      setBusy("");
    }
  }

  // ---------------------------------------------------------------
  // 4. Нәтижелерді есептеу — үш файл
  // ---------------------------------------------------------------
  async function handleCompute() {
    setBusy("compute");
    setMessage("");
    setError("");
    try {
      const [sheets, key] = await Promise.all([loadSheets(selectedId), loadAnswerKey(selectedId)]);
      if (sheets.length === 0) {
        setError("Есептейтін жауап жоқ.");
        return;
      }
      const students = await loadStudents([...new Set(sheets.map((s) => s.zipgrade_id))]);
      const made: string[] = [];

      // ---- НИШ ----
      const nisSubjects = TEST_TYPE_SUBJECTS.NIS;
      const nisSheets = sheets.filter((s) => nisSubjects.includes(s.subject));
      if (nisSheets.length > 0) {
        const { results, weights } = scoreNis(nisSheets, key, students);
        const wb = XLSX.utils.book_new();

        // Бағандар ресми НИШ нәтиже кестесіндегідей: Математика мен Сандық
        // сипаттамалардың пайызы бөлек, 1-күн (900) және 2-күн (600)
        // аралық қорытындылары бар.
        const DAY1 = ["math", "sandyq", "zharatylystanu"];
        const DAY2 = ["tilder_kk", "tilder_ru", "tilder_en"];
        const pct = (score: number, max: number) =>
          max > 0 ? Math.round((score / max) * 1000) / 10 : 0;

        const head = [
          "Орын",
          "ZipGrade ID",
          "Аты",
          "Тегі",
          "Математика (400)",
          "%",
          "Сандық сипаттамалар (300)",
          "%",
          "Жаратылыстану (200)",
          "1-күн барлығы (900)",
          "Қазақ тілі (200)",
          "Орыс тілі (200)",
          "Ағылшын тілі (200)",
          "2-күн барлығы (600)",
          "Жалпы қорытынды балл (1500)",
          "Шектен төмен",
        ];
        const body = results.map((r) => {
          const day1 = DAY1.reduce((a, k) => a + (r.scores[k] ?? 0), 0);
          const day2 = DAY2.reduce((a, k) => a + (r.scores[k] ?? 0), 0);
          return [
            r.rank,
            r.zipgrade_id,
            r.first_name,
            r.last_name,
            r.scores.math ?? 0,
            pct(r.scores.math ?? 0, 400),
            r.scores.sandyq ?? 0,
            pct(r.scores.sandyq ?? 0, 300),
            r.scores.zharatylystanu ?? 0,
            day1,
            r.scores.tilder_kk ?? 0,
            r.scores.tilder_ru ?? 0,
            r.scores.tilder_en ?? 0,
            day2,
            r.total,
            r.belowThreshold
              .map((k) => NIS_SECTIONS.find((s) => s.key === k)?.label ?? k)
              .join(", "),
          ];
        });
        const note = [
          [],
          ["Ескертпе:"],
          [
            "«Шектен төмен» бағанында пән көрсетілген оқушының нәтижесі ресми кестеде қызыл түспен белгіленеді.",
          ],
          [
            "«Математика» бөлімі бойынша 400 балдан 140 және одан жоғары (35%), «Сандық сипаттамалар» бойынша 300 балдан 120 және одан жоғары (40%) болуы керек.",
          ],
          ["Дәл шекті балл жинаған оқушы өтеді — шек қатаң емес."],
          ["Шектен төмен болса да оқушы тізімнен шықпайды, орны сол күйінде қалады."],
          ["Реттілік: жалпы сома → математика → сандық → жаратылыстану."],
        ];
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.aoa_to_sheet([head, ...body, ...note]),
          "Қорытынды"
        );

        const wHead = [
          "Бөлім",
          "Сұрақ",
          "Дұрыс жауап берген",
          "Барлық қатысушы",
          "Дұрыс үлесі",
          "Салмағы (1 − үлес)",
        ];
        const wBody = weights.map((w) => [
          NIS_SECTIONS.find((s) => s.key === w.section)?.label ?? w.section,
          w.question_number,
          w.answered_correct,
          w.cohort,
          Math.round(w.share_correct * 10000) / 10000,
          Math.round(w.weight * 10000) / 10000,
        ]);
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([wHead, ...wBody]), "Салмақтар");

        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.aoa_to_sheet(buildPerQuestion(nisSheets, key, students)),
          "Сұрақ бойынша"
        );

        download(wb, `nis_natije_${selectedId.slice(0, 8)}.xlsx`);
        made.push("НИШ");
      }

      // ---- БИЛ ----
      const bilSheets = sheets.filter((s) => s.subject === "bil");
      if (bilSheets.length > 0) {
        const results = scoreBil(bilSheets, key, students);
        const wb = XLSX.utils.book_new();
        // Бағандар ресми БИЛ рейтингіндегідей: әр бөлім бойынша дұрыс/қате
        // саны мен ұпайы, сосын жалпы.
        const head = [
          "Орын",
          "ZipGrade ID",
          "Аты",
          "Тегі",
          ...BIL_SECTIONS.flatMap((s) => [
            `${s.label} — дұрыс`,
            `${s.label} — қате`,
            `${s.label} — бос`,
            `${s.label} — ұпай`,
          ]),
          "Жалпы дұрыс",
          "Жалпы қате",
          "Жалпы бос",
          "Жалпы ұпай",
        ];
        const body = results.map((r) => [
          r.rank,
          r.zipgrade_id,
          r.first_name,
          r.last_name,
          ...BIL_SECTIONS.flatMap((s) => [
            r.breakdown[s.key]?.correct ?? 0,
            r.breakdown[s.key]?.wrong ?? 0,
            r.breakdown[s.key]?.blank ?? 0,
            r.scores[s.key] ?? 0,
          ]),
          r.correct,
          r.wrong,
          r.blank,
          r.total,
        ]);
        const note = [
          [],
          ["Ескертпе:"],
          ["Дұрыс жауап +4, бос 0, қате −1. Қосарлы белгі қате деп саналады."],
          [`1–50 сұрақ — математика-логика, 51–60 — оқу сауаттылығы. Максимум ${BIL_MAX}.`],
        ];
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.aoa_to_sheet([head, ...body, ...note]),
          "Қорытынды"
        );
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.aoa_to_sheet(buildPerQuestion(bilSheets, key, students)),
          "Сұрақ бойынша"
        );
        download(wb, `bil_natije_${selectedId.slice(0, 8)}.xlsx`);
        made.push("БИЛ");
      }

      // ---- РФМШ ----
      const rfmshSheets = sheets.filter((s) => s.subject === "rfmsh");
      if (rfmshSheets.length > 0) {
        const results = scoreRfmsh(rfmshSheets, key, students);
        const wb = XLSX.utils.book_new();
        const head = [
          "Орын",
          "ZipGrade ID",
          "Аты",
          "Тегі",
          `Ұпай (макс ${RFMSH_MAX})`,
          "Дұрыс",
          "Қате",
          "Бос",
        ];
        const body = results.map((r) => [
          r.rank,
          r.zipgrade_id,
          r.first_name,
          r.last_name,
          r.total,
          r.correct,
          r.wrong,
          r.blank,
        ]);
        const note = [
          [],
          ["Ескертпе:"],
          ["1–10 сұрақ 3 ұпай, 11–20 сұрақ 5 ұпай, 21–30 сұрақ 7 ұпай. Барлығы 150."],
        ];
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.aoa_to_sheet([head, ...body, ...note]),
          "Қорытынды"
        );
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.aoa_to_sheet(buildPerQuestion(rfmshSheets, key, students)),
          "Сұрақ бойынша"
        );
        download(wb, `rfmsh_natije_${selectedId.slice(0, 8)}.xlsx`);
        made.push("РФМШ");
      }

      setMessage(made.length > 0 ? `Есептелді: ${made.join(", ")}.` : "Есептейтін дерек табылмады.");
    } catch (err: any) {
      console.error(err);
      setError("Қате: " + (err?.message ?? "белгісіз"));
    } finally {
      setBusy("");
    }
  }

  /** «Сұрақ бойынша» парағы: кім не белгіледі және дұрыс па. */
  function buildPerQuestion(
    sheets: Sheet[],
    key: AnswerKeyItem[],
    students: Map<string, Student>
  ): any[][] {
    const head = [
      "ZipGrade ID",
      "Аты",
      "Тегі",
      "Пән",
      "Нұсқа",
      "Сұрақ",
      "Белгіледі",
      "Дұрыс жауап",
      "Нәтиже",
    ];
    const body: any[][] = [];
    sheets.forEach((s) => {
      const st = students.get(s.zipgrade_id);
      const qnums = [
        ...new Set(
          key
            .filter((k) => k.subject === s.subject && k.variant_number === s.variant_number)
            .map((k) => k.question_number)
        ),
      ].sort((a, b) => a - b);
      qnums.forEach((qnum) => {
        const correct =
          key.find(
            (k) =>
              k.subject === s.subject &&
              k.variant_number === s.variant_number &&
              k.question_number === qnum
          )?.correct ?? "";
        const given = s.answers[qnum] ?? "";
        const v = judge(given, correct);
        body.push([
          s.zipgrade_id,
          st?.first_name ?? "",
          st?.last_name ?? "",
          SUBJECT_LABELS[s.subject],
          s.variant_number,
          qnum,
          given,
          correct,
          v === "correct" ? "дұрыс" : v === "wrong" ? "қате" : "бос",
        ]);
      });
    });
    return [head, ...body];
  }

  // ---------------------------------------------------------------
  // Көрініс
  // ---------------------------------------------------------------
  if (loading) return <p className="mt-6 text-sm text-ink/50">Жүктелуде...</p>;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-admin">Нәтижелерді есептеу</h1>
      <p className="mt-1 text-sm text-ink/60">
        Онлайн және офлайн жауаптар бір жерге жиналып, бір ереже бойынша есептеледі.
      </p>

      <select
        value={selectedId}
        onChange={(e) => {
          setSelectedId(e.target.value);
          setMismatches([]);
          setMessage("");
          setError("");
        }}
        className="focus-ring mt-5 w-full max-w-md rounded-xl border border-ink/15 px-3 py-2 text-sm"
      >
        <option value="">— Пробный тест таңдаңыз —</option>
        {sessions.map((s) => (
          <option key={s.id} value={s.id}>
            {s.title_kk} / {s.title_ru} — {s.session_date}
          </option>
        ))}
      </select>

      {selectedId && (
        <>
          {/* 1. Онлайн */}
          <section className="mt-6 rounded-2xl border border-ink/10 bg-white p-5">
            <h2 className="font-display text-lg font-bold text-ink">1-қадам. Онлайн жауаптар</h2>
            <p className="mt-1 text-sm text-ink/60">
              Браузерде тапсырғандардың жауаптарын ортақ қоймаға көшіреді. Тест аяқталған соң
              басыңыз; қайта басуға болады — жаңасы ескісін ауыстырады.
            </p>
            <button
              onClick={handleCollectOnline}
              disabled={busy !== ""}
              className="focus-ring mt-3 rounded-full bg-admin px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy === "collect" ? "Жиналуда..." : "Онлайн жауаптарды жинау"}
            </button>
          </section>

          {/* 2. ZipGrade */}
          <section className="mt-4 rounded-2xl border border-ink/10 bg-white p-5">
            <h2 className="font-display text-lg font-bold text-ink">2-қадам. ZipGrade файлдары</h2>
            <p className="mt-1 text-sm text-ink/60">
              Әр пән бойынша экспорт файлын жүктеңіз. Нұсқа нөмірі файлдағы «Key Version»
              бағанынан алынады, оқушылар «StudentID» бойынша табылады.
            </p>

            <div className="mt-4 flex flex-col gap-2">
              {IMPORT_SUBJECTS.map((subject) => {
                const c = counts[subject];
                return (
                  <div
                    key={subject}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink/10 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-ink">{SUBJECT_LABELS[subject]}</p>
                      <p className="font-mono text-xs text-ink/50">
                        {SUBJECT_MAX_COUNT[subject]} сұрақ · онлайн {c?.online ?? 0} · ZipGrade{" "}
                        {c?.zipgrade ?? 0}
                      </p>
                    </div>
                    <label className="focus-ring cursor-pointer rounded-full border border-admin px-4 py-2 text-xs font-semibold text-admin hover:bg-admin-soft">
                      {busy === "import-" + subject ? "Жүктелуде..." : "Файл таңдау"}
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        disabled={busy !== ""}
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = "";
                          if (f) handleImport(subject, f);
                        }}
                      />
                    </label>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Кілт айырмашылықтары */}
          {mismatches.length > 0 && (
            <section className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-5">
              <h2 className="font-display text-lg font-bold text-red-700">
                Кілтте айырмашылық: {mismatches.length}
              </h2>
              <p className="mt-1 text-sm text-red-700/80">
                Есептеу біздің базадағы кілт бойынша жүреді. Мына сұрақтарды адам тексеріп, қажет
                болса сайттағы дұрыс жауапты түзетуі керек.
              </p>
              <div className="mt-3 max-h-64 overflow-auto rounded-xl bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-ink/5 font-mono text-ink/50">
                    <tr>
                      <th className="px-3 py-2">Пән</th>
                      <th className="px-3 py-2">Нұсқа</th>
                      <th className="px-3 py-2">Сұрақ</th>
                      <th className="px-3 py-2">Базада</th>
                      <th className="px-3 py-2">ZipGrade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mismatches.map((m, i) => (
                      <tr key={i} className="border-t border-ink/5">
                        <td className="px-3 py-1.5">{SUBJECT_LABELS[m.subject]}</td>
                        <td className="px-3 py-1.5 font-mono">{m.variant}</td>
                        <td className="px-3 py-1.5 font-mono">{m.question}</td>
                        <td className="px-3 py-1.5 font-mono font-bold">{m.ours || "—"}</td>
                        <td className="px-3 py-1.5 font-mono font-bold">{m.zip || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* 3. Шығару */}
          <section className="mt-4 rounded-2xl border border-ink/10 bg-white p-5">
            <h2 className="font-display text-lg font-bold text-ink">3-қадам. Шикі жауаптар</h2>
            <p className="mt-1 text-sm text-ink/60">
              Барлық жауап ZipGrade форматында, әр пән — бөлек парақ. Қолмен тексеру үшін.
            </p>
            <button
              onClick={handleExportRaw}
              disabled={busy !== ""}
              className="focus-ring mt-3 rounded-full border border-admin px-5 py-2.5 text-sm font-semibold text-admin hover:bg-admin-soft disabled:opacity-50"
            >
              {busy === "export" ? "Дайындалуда..." : "Шикі жауаптарды жүктеу"}
            </button>
          </section>

          {/* 4. Есептеу */}
          <section className="mt-4 rounded-2xl border border-ink/10 bg-white p-5">
            <h2 className="font-display text-lg font-bold text-ink">4-қадам. Есептеу</h2>
            <p className="mt-1 text-sm text-ink/60">
              Үш файл жүктеледі: НИШ, БИЛ, РФМШ. Әрқайсысында «Қорытынды» және «Сұрақ бойынша»
              парақтары, НИШ-те қосымша «Салмақтар».
            </p>
            <p className="mt-2 text-xs text-ink/40">
              НИШ салмағы барлық қатысушы бойынша есептеледі, сондықтан офлайн файлдар
              жүктелгеннен кейін ғана есептеңіз.
            </p>
            <button
              onClick={handleCompute}
              disabled={busy !== ""}
              className="focus-ring mt-3 rounded-full bg-parent px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy === "compute" ? "Есептелуде..." : "Нәтижелерді есептеу"}
            </button>
          </section>

          {message && <p className="mt-4 text-sm text-parent">{message}</p>}
          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        </>
      )}
    </div>
  );
}
