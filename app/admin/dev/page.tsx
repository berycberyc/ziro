"use client";

import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import DummyDataButton from "@/components/DummyDataButton";
import { SUBJECT_LABELS, PASSAGE_SUBJECTS, type SubjectKey } from "@/lib/questions/subjects";

type TrialTest = { id: string; title_kk: string; title_ru: string; session_date: string };

export default function DevToolsPage() {
  const [trialTests, setTrialTests] = useState<TrialTest[]>([]);
  const [selectedId, setSelectedId] = useState("");

  const [copySubject, setCopySubject] = useState<SubjectKey>("math");
  const [sourceVariant, setSourceVariant] = useState(1);
  const [targetVariant, setTargetVariant] = useState(2);
  const [copying, setCopying] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const [copyError, setCopyError] = useState("");

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  useEffect(() => {
    supabase
      .from("test_sessions")
      .select("id, title_kk, title_ru, session_date")
      .order("session_date", { ascending: false })
      .then(({ data }) => setTrialTests(data ?? []));
  }, []);

  async function handleCopyVariant() {
    if (!selectedId) return;
    if (sourceVariant === targetVariant) {
      setCopyError("Бастапқы және мақсатты нұсқа бірдей болмауы керек.");
      return;
    }

    setCopying(true);
    setCopyMessage("");
    setCopyError("");

    try {
      const isPassageSubject = PASSAGE_SUBJECTS.includes(copySubject);
      let passageIdMap: Record<string, string> = {};

      if (isPassageSubject) {
        const { data: passages, error: passagesError } = await supabase
          .from("passages")
          .select("id, passage_text, order_number")
          .eq("session_id", selectedId)
          .eq("subject", copySubject)
          .eq("variant_number", sourceVariant);
        if (passagesError) throw passagesError;

        for (const p of passages ?? []) {
          const { data: newPassage, error: insertError } = await supabase
            .from("passages")
            .insert({
              session_id: selectedId,
              subject: copySubject,
              variant_number: targetVariant,
              passage_text: p.passage_text,
              order_number: p.order_number,
            })
            .select("id")
            .single();
          if (insertError) throw insertError;
          passageIdMap[p.id] = newPassage.id;
        }
      }

      const { data: questions, error: questionsError } = await supabase
        .from("questions")
        .select(
          "question_number, topic_id, passage_id, text_kk, text_ru, image_url, answer_format, choices, correct_answer, column_a_kk, column_a_ru, column_b_kk, column_b_ru"
        )
        .eq("session_id", selectedId)
        .eq("subject", copySubject)
        .eq("variant_number", sourceVariant);
      if (questionsError) throw questionsError;

      if (!questions || questions.length === 0) {
        setCopyError("Бастапқы нұсқада сұрақтар табылмады.");
        setCopying(false);
        return;
      }

      const newRows = questions.map((q) => ({
        session_id: selectedId,
        subject: copySubject,
        variant_number: targetVariant,
        question_number: q.question_number,
        topic_id: q.topic_id,
        passage_id: q.passage_id ? passageIdMap[q.passage_id] ?? null : null,
        text_kk: q.text_kk,
        text_ru: q.text_ru,
        image_url: q.image_url,
        answer_format: q.answer_format,
        choices: q.choices,
        correct_answer: q.correct_answer,
        column_a_kk: q.column_a_kk,
        column_a_ru: q.column_a_ru,
        column_b_kk: q.column_b_kk,
        column_b_ru: q.column_b_ru,
      }));

      const { error: insertQuestionsError } = await supabase.from("questions").insert(newRows);
      if (insertQuestionsError) throw insertQuestionsError;

      setCopyMessage(
        `Дайын: ${questions.length} сұрақ ${sourceVariant}-нұсқадан ${targetVariant}-нұсқаға көшірілді.`
      );
    } catch (err: any) {
      console.error("Variant copy failed:", err);
      setCopyError("Қате шықты: " + (err?.message ?? "белгісіз қате"));
    } finally {
      setCopying(false);
    }
  }

  async function handleExportAnswers() {
    if (!selectedId) return;
    setExporting(true);
    setExportError("");

    try {
      const { data: questions, error } = await supabase
        .from("questions")
        .select("subject, variant_number, question_number, answer_format, choices, correct_answer")
        .eq("session_id", selectedId)
        .order("subject")
        .order("variant_number")
        .order("question_number");
      if (error) throw error;

      const rows = (questions ?? []).map((q) => {
        let correct = "";
        if (q.answer_format === "numeric") {
          correct = q.correct_answer ?? "";
        } else {
          const choices = q.choices as { text_kk: string; correct: boolean }[] | null;
          const idx = choices?.findIndex((c) => c.correct) ?? -1;
          correct = idx >= 0 ? "ABCD"[idx] : "";
        }
        return {
          Пән: SUBJECT_LABELS[q.subject as SubjectKey] ?? q.subject,
          Нұсқа: q.variant_number,
          "Сұрақ №": q.question_number,
          "Дұрыс жауап": correct,
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Жауаптар");
      const test = trialTests.find((t) => t.id === selectedId);
      XLSX.writeFile(workbook, `${test?.title_kk ?? "test"}-answers.xlsx`);
    } catch (err: any) {
      console.error("Answers export failed:", err);
      setExportError("Қате шықты: " + (err?.message ?? "белгісіз қате"));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <div className="mb-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
        Бұл бет — тек әзірлеу/тестілеу үшін. Мұндағы әрекеттер деректер базасын тікелей өзгертеді,
        сақ болыңыз.
      </div>

      <h1 className="font-display text-2xl font-bold text-red-600">Әзірлеуші құралдары</h1>

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

      <section className="mt-8">
        <h2 className="font-display text-lg font-bold text-ink">Тест деректері (әзірлеу үшін)</h2>
        <p className="mt-1 text-sm text-ink/60">
          Толық тіркеу→тест→нәтиже ағынын тексеру үшін бір тест ата-анасы мен 100 тест оқушысын
          құрады.
        </p>
        <div className="mt-3">
          <DummyDataButton />
        </div>
      </section>

      <section className="mt-10 rounded-2xl border border-ink/10 bg-white p-5">
        <h2 className="font-display text-lg font-bold text-ink">Нұсқаны көшіру</h2>
        <p className="mt-1 text-sm text-ink/60">
          Бір нұсқаға енгізілген сұрақтарды өзгеріссіз екінші нұсқаға көшіреді — өзгертулерді өзіңіз
          кейін қолмен енгізесіз.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <select
            value={copySubject}
            onChange={(e) => setCopySubject(e.target.value as SubjectKey)}
            className="focus-ring rounded-xl border border-ink/15 px-3 py-2 text-sm"
          >
            {Object.entries(SUBJECT_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={sourceVariant}
            onChange={(e) => setSourceVariant(Number(e.target.value))}
            className="focus-ring rounded-xl border border-ink/15 px-3 py-2 text-sm"
          >
            {[1, 2, 3, 4].map((v) => (
              <option key={v} value={v}>
                {v}-нұсқадан
              </option>
            ))}
          </select>
          <select
            value={targetVariant}
            onChange={(e) => setTargetVariant(Number(e.target.value))}
            className="focus-ring rounded-xl border border-ink/15 px-3 py-2 text-sm"
          >
            {[1, 2, 3, 4].map((v) => (
              <option key={v} value={v}>
                {v}-нұсқаға
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleCopyVariant}
          disabled={!selectedId || copying}
          className="focus-ring mt-4 rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {copying ? "Көшірілуде..." : "Көшіру"}
        </button>
        {copyMessage && <p className="mt-2 text-sm text-parent">{copyMessage}</p>}
        {copyError && <p className="mt-2 text-sm text-red-600">{copyError}</p>}
      </section>

      <section className="mt-6 rounded-2xl border border-ink/10 bg-white p-5">
        <h2 className="font-display text-lg font-bold text-ink">Дұрыс жауаптарды жүктеп алу</h2>
        <p className="mt-1 text-sm text-ink/60">
          Таңдалған тесттің барлық пәндері мен нұсқалары бойынша дұрыс жауаптар кестесі.
        </p>
        <button
          onClick={handleExportAnswers}
          disabled={!selectedId || exporting}
          className="focus-ring mt-3 rounded-full border border-red-600 px-5 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          {exporting ? "Жүктелуде..." : "Excel-ге жүктеп алу"}
        </button>
        {exportError && <p className="mt-2 text-sm text-red-600">{exportError}</p>}
      </section>
    </div>
  );
}
