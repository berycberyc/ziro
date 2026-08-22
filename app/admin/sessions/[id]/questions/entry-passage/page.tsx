"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { SUBJECT_MAX_COUNT, SUBJECT_LABELS, type SubjectKey } from "@/lib/questions/subjects";

type Topic = { id: string; name_kk: string; name_ru: string };
type Choice = { text_kk: string; text_ru: string; correct: boolean };
type Passage = { id: string; passage_text: string; order_number: number };
type QuestionRow = {
  id: string;
  question_number: number;
  topic_id: string | null;
  text_kk: string;
  text_ru: string;
  choices: Choice[];
};

const emptyChoices = (): Choice[] =>
  Array.from({ length: 4 }, () => ({ text_kk: "", text_ru: "", correct: false }));

export default function PassageQuestionEntryPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const sessionId = params.id as string;
  const variant = parseInt(searchParams.get("variant") ?? "1", 10);
  const subject = (searchParams.get("subject") ?? "tilder_kk") as SubjectKey;
  const max = SUBJECT_MAX_COUNT[subject];

  const [topics, setTopics] = useState<Topic[]>([]);
  const [passages, setPassages] = useState<Passage[]>([]);
  const [activePassageId, setActivePassageId] = useState<string | null>(null);
  const [passageText, setPassageText] = useState("");
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [savingPassage, setSavingPassage] = useState(false);
  const [error, setError] = useState("");

  // New-question draft form state
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftTopic, setDraftTopic] = useState("");
  const [draftSame, setDraftSame] = useState(true);
  const [draftKk, setDraftKk] = useState("");
  const [draftRu, setDraftRu] = useState("");
  const [draftChoices, setDraftChoices] = useState<Choice[]>(emptyChoices());
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);

  const loadTotalCount = useCallback(async () => {
    const { count } = await supabase
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId)
      .eq("subject", subject)
      .eq("variant_number", variant);
    setTotalCount(count ?? 0);
  }, [sessionId, subject, variant]);

  const loadPassages = useCallback(async () => {
    const { data } = await supabase
      .from("passages")
      .select("id, passage_text, order_number")
      .eq("session_id", sessionId)
      .eq("subject", subject)
      .eq("variant_number", variant)
      .order("order_number");
    setPassages(data ?? []);
    return data ?? [];
  }, [sessionId, subject, variant]);

  const loadQuestionsForPassage = useCallback(
    async (passageId: string) => {
      const { data } = await supabase
        .from("questions")
        .select("id, question_number, topic_id, text_kk, text_ru, choices")
        .eq("passage_id", passageId)
        .order("question_number");
      setQuestions((data ?? []) as QuestionRow[]);
    },
    []
  );

  async function selectPassage(p: Passage) {
    setActivePassageId(p.id);
    setPassageText(p.passage_text);
    setDraftOpen(false);
    setEditingQuestionId(null);
    await loadQuestionsForPassage(p.id);
  }

  async function startNewPassage() {
    setActivePassageId(null);
    setPassageText("");
    setQuestions([]);
    setDraftOpen(false);
    setEditingQuestionId(null);
  }

  useEffect(() => {
    async function init() {
      setLoading(true);
      const { data: topicData } = await supabase
        .from("topics")
        .select("id, name_kk, name_ru")
        .eq("subject", subject)
        .order("name_kk");
      setTopics(topicData ?? []);

      await loadTotalCount();
      const loadedPassages = await loadPassages();
      if (loadedPassages.length > 0) {
        await selectPassage(loadedPassages[0]);
      }
      setLoading(false);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, subject, variant]);

  async function handleSavePassage() {
    if (!passageText.trim()) {
      setError("Мәтін бос болмауы керек.");
      return;
    }
    setSavingPassage(true);
    setError("");

    if (activePassageId) {
      await supabase.from("passages").update({ passage_text: passageText }).eq("id", activePassageId);
    } else {
      const nextOrder = passages.length > 0 ? Math.max(...passages.map((p) => p.order_number)) + 1 : 1;
      const { data, error: insertErr } = await supabase
        .from("passages")
        .insert({ session_id: sessionId, subject, variant_number: variant, passage_text: passageText, order_number: nextOrder })
        .select()
        .single();
      if (insertErr) {
        setError(insertErr.message);
        setSavingPassage(false);
        return;
      }
      setActivePassageId(data.id);
    }

    setSavingPassage(false);
    await loadPassages();
  }

  function openNewQuestionDraft() {
    setEditingQuestionId(null);
    setDraftTopic("");
    setDraftSame(true);
    setDraftKk("");
    setDraftRu("");
    setDraftChoices(emptyChoices());
    setDraftOpen(true);
  }

  function openEditQuestionDraft(q: QuestionRow) {
    setEditingQuestionId(q.id);
    setDraftTopic(q.topic_id ?? "");
    setDraftSame(q.text_kk === q.text_ru);
    setDraftKk(q.text_kk);
    setDraftRu(q.text_ru);
    setDraftChoices(q.choices);
    setDraftOpen(true);
  }

  function updateDraftChoice(index: number, field: "text_kk" | "text_ru", value: string) {
    setDraftChoices((prev) =>
      prev.map((c, i) => {
        if (i !== index) return c;
        if (draftSame) return { ...c, text_kk: value, text_ru: value };
        return { ...c, [field]: value };
      })
    );
  }

  function handleDraftKkChange(value: string) {
    setDraftKk(value);
    if (draftSame) setDraftRu(value);
  }

  function handleDraftSameToggle(checked: boolean) {
    setDraftSame(checked);
    if (checked) {
      setDraftRu(draftKk);
      setDraftChoices((prev) => prev.map((c) => ({ ...c, text_ru: c.text_kk })));
    }
  }

  async function handleSaveDraftQuestion() {
    if (!activePassageId) {
      setError("Алдымен мәтінді сақтаңыз.");
      return;
    }
    if (!draftTopic) return setError("Тема таңдалмаған.");
    if (!draftKk.trim() || (!draftSame && !draftRu.trim())) return setError("Сұрақ мәтіні толтырылмаған.");
    for (const c of draftChoices) {
      if (!c.text_kk.trim() || (!draftSame && !c.text_ru.trim())) return setError("Барлық 4 жауап толтырылуы керек.");
    }
    if (!draftChoices.some((c) => c.correct)) return setError("Дұрыс жауап белгіленбеген.");

    if (!editingQuestionId && totalCount >= max) {
      setError(`Бұл пән бойынша барлығы ${max} сұрақ қана болады.`);
      return;
    }

    setError("");
    const finalRu = draftSame ? draftKk : draftRu;
    const finalChoices = draftChoices.map((c) => (draftSame ? { ...c, text_ru: c.text_kk } : c));

    if (editingQuestionId) {
      await supabase
        .from("questions")
        .update({ topic_id: draftTopic, text_kk: draftKk, text_ru: finalRu, choices: finalChoices })
        .eq("id", editingQuestionId);
    } else {
      const { data: existing } = await supabase
        .from("questions")
        .select("question_number")
        .eq("session_id", sessionId)
        .eq("subject", subject)
        .eq("variant_number", variant)
        .order("question_number", { ascending: false })
        .limit(1);
      const nextNumber = existing && existing.length > 0 ? existing[0].question_number + 1 : 1;

      await supabase.from("questions").insert({
        session_id: sessionId,
        subject,
        variant_number: variant,
        question_number: nextNumber,
        passage_id: activePassageId,
        topic_id: draftTopic,
        text_kk: draftKk,
        text_ru: finalRu,
        answer_format: "abcd",
        choices: finalChoices,
      });
    }

    setDraftOpen(false);
    setEditingQuestionId(null);
    await loadQuestionsForPassage(activePassageId);
    await loadTotalCount();
  }

  if (loading) return <main className="p-10 text-ink/50">Жүктелуде...</main>;

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/admin/sessions/${sessionId}/questions`} className="text-sm text-ink/50 hover:underline">
        ← Артқа
      </Link>
      <h1 className="font-display text-2xl font-bold text-admin">
        {SUBJECT_LABELS[subject]} — Нұсқа {variant}
      </h1>
      <p className="mt-1 text-sm text-ink/60">
        Барлығы: {totalCount} / {max} сұрақ
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {passages.map((p, i) => (
          <button
            key={p.id}
            onClick={() => selectPassage(p)}
            className={`focus-ring rounded-full px-4 py-1.5 text-sm font-semibold ${
              activePassageId === p.id ? "bg-admin text-white" : "bg-admin-soft text-admin"
            }`}
          >
            Мәтін {i + 1}
          </button>
        ))}
        <button
          onClick={startNewPassage}
          className="focus-ring rounded-full border border-dashed border-admin px-4 py-1.5 text-sm font-semibold text-admin"
        >
          + Жаңа мәтін
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-ink/10 bg-white p-5">
        <label className="text-xs font-semibold text-ink/50">Мәтін</label>
        <textarea
          value={passageText}
          onChange={(e) => setPassageText(e.target.value)}
          rows={6}
          className="focus-ring mt-1 w-full rounded-xl border border-ink/15 px-3 py-2 text-sm"
        />
        <button
          onClick={handleSavePassage}
          disabled={savingPassage}
          className="focus-ring mt-2 rounded-full bg-admin px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {savingPassage ? "Сақталуда..." : "Мәтінді сақтау"}
        </button>
      </div>

      {activePassageId && (
        <div className="mt-4 flex flex-col gap-3">
          {questions.map((q) => (
            <div key={q.id} className="rounded-xl border border-ink/10 bg-white p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-ink">
                  {q.question_number}. {q.text_kk}
                </p>
                <button onClick={() => openEditQuestionDraft(q)} className="focus-ring text-xs text-admin hover:underline">
                  Өзгерту
                </button>
              </div>
              <div className="mt-1 flex flex-wrap gap-2 text-xs text-ink/50">
                {q.choices.map((c, i) => (
                  <span key={i} className={c.correct ? "font-semibold text-parent" : ""}>
                    {"ABCD"[i]}) {c.text_kk}
                  </span>
                ))}
              </div>
            </div>
          ))}

          {!draftOpen && totalCount < max && (
            <button
              onClick={openNewQuestionDraft}
              className="focus-ring rounded-full border border-dashed border-admin px-5 py-2 text-sm font-semibold text-admin"
            >
              + Сұрақ қосу
            </button>
          )}

          {draftOpen && (
            <div className="rounded-2xl border border-ink/10 bg-white p-5">
              <label className="text-xs font-semibold text-ink/50">Тема</label>
              <select
                value={draftTopic}
                onChange={(e) => setDraftTopic(e.target.value)}
                className="focus-ring mt-1 w-full rounded-xl border border-ink/15 px-3 py-2 text-sm"
              >
                <option value="">— таңдау —</option>
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name_kk === t.name_ru ? t.name_kk : `${t.name_kk} / ${t.name_ru}`}
                  </option>
                ))}
              </select>

              <label className="mt-3 flex items-center gap-2 text-sm text-ink/70">
                <input type="checkbox" checked={draftSame} onChange={(e) => handleDraftSameToggle(e.target.checked)} />
                Бірдей мәтін екі тілде
              </label>

              <label className="mt-3 block text-xs font-semibold text-ink/50">
                {draftSame ? "Сұрақ мәтіні" : "Сұрақ мәтіні — қазақша"}
              </label>
              <textarea
                value={draftKk}
                onChange={(e) => handleDraftKkChange(e.target.value)}
                rows={2}
                className="focus-ring mt-1 w-full rounded-xl border border-ink/15 px-3 py-2 text-sm"
              />
              {!draftSame && (
                <>
                  <label className="mt-3 block text-xs font-semibold text-ink/50">Текст вопроса — русский</label>
                  <textarea
                    value={draftRu}
                    onChange={(e) => setDraftRu(e.target.value)}
                    rows={2}
                    className="focus-ring mt-1 w-full rounded-xl border border-ink/15 px-3 py-2 text-sm"
                  />
                </>
              )}

              <div className="mt-3 flex flex-col gap-2">
                {draftChoices.map((c, i) => (
                  <div key={i} className="rounded-xl border border-ink/10 p-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="draft-correct"
                        checked={c.correct}
                        onChange={() =>
                          setDraftChoices((prev) => prev.map((cc, ii) => ({ ...cc, correct: ii === i })))
                        }
                      />
                      <span className="text-sm font-semibold text-ink">{"ABCD"[i]})</span>
                    </div>
                    <div className={`mt-1 grid gap-2 ${draftSame ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>
                      <input
                        value={c.text_kk}
                        onChange={(e) => updateDraftChoice(i, "text_kk", e.target.value)}
                        placeholder={draftSame ? "жауап" : "қазақша"}
                        className="focus-ring rounded-lg border border-ink/15 px-3 py-1.5 text-sm"
                      />
                      {!draftSame && (
                        <input
                          value={c.text_ru}
                          onChange={(e) => updateDraftChoice(i, "text_ru", e.target.value)}
                          placeholder="русский"
                          className="focus-ring rounded-lg border border-ink/15 px-3 py-1.5 text-sm"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex gap-3">
                <button
                  onClick={handleSaveDraftQuestion}
                  className="focus-ring rounded-full bg-admin px-5 py-2 text-sm font-semibold text-white hover:opacity-90"
                >
                  Сақтау
                </button>
                <button onClick={() => setDraftOpen(false)} className="focus-ring text-sm text-ink/50">
                  Бас тарту
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
