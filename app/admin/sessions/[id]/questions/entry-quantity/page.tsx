"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { removeStoredFile } from "@/lib/storageCleanup";
import { SUBJECT_MAX_COUNT, SUBJECT_LABELS, QUANTITY_CHOICE_LABELS, type SubjectKey } from "@/lib/questions/subjects";

type Topic = { id: string; name_kk: string; name_ru: string };
type AnswerLetter = "A" | "B" | "C" | "D";

export default function QuantityQuestionEntryPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = params.id as string;
  const variant = parseInt(searchParams.get("variant") ?? "1", 10);
  const subject = (searchParams.get("subject") ?? "sandyq") as SubjectKey;
  const max = SUBJECT_MAX_COUNT[subject];

  const [topics, setTopics] = useState<Topic[]>([]);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [highestSaved, setHighestSaved] = useState(0);
  const [topicId, setTopicId] = useState("");
  const [sameLang, setSameLang] = useState(true);

  const [conditionKk, setConditionKk] = useState("");
  const [conditionRu, setConditionRu] = useState("");
  const [conditionImageUrl, setConditionImageUrl] = useState<string | null>(null);
  const [colAKk, setColAKk] = useState("");
  const [colARu, setColARu] = useState("");
  const [colBKk, setColBKk] = useState("");
  const [colBRu, setColBRu] = useState("");
  const [correctLetter, setCorrectLetter] = useState<AnswerLetter | null>(null);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const resetForm = () => {
    setTopicId("");
    setSameLang(true);
    setConditionKk("");
    setConditionRu("");
    setConditionImageUrl(null);
    setColAKk("");
    setColARu("");
    setColBKk("");
    setColBRu("");
    setCorrectLetter(null);
  };

  const loadQuestion = useCallback(
    async (num: number) => {
      const { data } = await supabase
        .from("questions")
        .select("topic_id, text_kk, text_ru, image_url, column_a_kk, column_a_ru, column_b_kk, column_b_ru, correct_answer")
        .eq("session_id", sessionId)
        .eq("subject", subject)
        .eq("variant_number", variant)
        .eq("question_number", num)
        .maybeSingle();

      if (data) {
        setTopicId(data.topic_id ?? "");
        setConditionKk(data.text_kk ?? "");
        setConditionRu(data.text_ru ?? "");
        setSameLang((data.text_kk ?? "") === (data.text_ru ?? "") && (data.column_a_kk ?? "") === (data.column_a_ru ?? ""));
        setConditionImageUrl(data.image_url ?? null);
        setColAKk(data.column_a_kk ?? "");
        setColARu(data.column_a_ru ?? "");
        setColBKk(data.column_b_kk ?? "");
        setColBRu(data.column_b_ru ?? "");
        setCorrectLetter((data.correct_answer as AnswerLetter) ?? null);
      } else {
        resetForm();
      }
    },
    [sessionId, subject, variant]
  );

  useEffect(() => {
    async function init() {
      setLoading(true);
      const { data: topicData } = await supabase
        .from("topics")
        .select("id, name_kk, name_ru")
        .eq("subject", subject)
        .order("name_kk");
      setTopics(topicData ?? []);

      const { data: existing } = await supabase
        .from("questions")
        .select("question_number")
        .eq("session_id", sessionId)
        .eq("subject", subject)
        .eq("variant_number", variant)
        .order("question_number", { ascending: false })
        .limit(1);
      const highest = existing && existing.length > 0 ? existing[0].question_number : 0;
      setHighestSaved(highest);
      const nextNum = Math.min(highest + 1, max);
      setQuestionNumber(nextNum);
      await loadQuestion(nextNum);
      setLoading(false);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, subject, variant]);

  async function goToQuestion(num: number) {
    if (num < 1 || num > max) return;
    setQuestionNumber(num);
    setError("");
    await loadQuestion(num);
  }

  async function handleImageUpload(file: File) {
    setUploading(true);
    setError("");
    const ext = file.name.split(".").pop();
    const path = `${sessionId}/${subject}/${variant}/${questionNumber}-${Date.now()}.${ext}`;
    // Ауыстырудан бұрынғы сурет — жаңасы сәтті жүктелген соң өшіріледі.
    const previousUrl = conditionImageUrl;

    const { error: uploadErr } = await supabase.storage.from("question-images").upload(path, file);
    if (uploadErr) {
      setError("Сурет жүктелмеді: " + uploadErr.message);
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from("question-images").getPublicUrl(path);
    setConditionImageUrl(data.publicUrl);
    if (previousUrl && previousUrl !== data.publicUrl) {
      await removeStoredFile("question-images", previousUrl);
    }
    setUploading(false);
  }

  function handleSameLangToggle(checked: boolean) {
    setSameLang(checked);
    if (checked) {
      setConditionRu(conditionKk);
      setColARu(colAKk);
      setColBRu(colBKk);
    }
  }

  function handleConditionKkChange(value: string) {
    setConditionKk(value);
    if (sameLang) setConditionRu(value);
  }
  function handleColAKkChange(value: string) {
    setColAKk(value);
    if (sameLang) setColARu(value);
  }
  function handleColBKkChange(value: string) {
    setColBKk(value);
    if (sameLang) setColBRu(value);
  }

  function validate(): string | null {
    if (!topicId) return "Тема таңдалмаған.";
    if (!colAKk.trim() || (!sameLang && !colARu.trim())) return "А бағаны толтырылмаған.";
    if (!colBKk.trim() || (!sameLang && !colBRu.trim())) return "В бағаны толтырылмаған.";
    if (!correctLetter) return "Дұрыс жауап белгіленбеген.";
    return null;
  }

  async function handleSave(andAdvance: boolean) {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError("");

    const { error: saveErr } = await supabase.from("questions").upsert(
      {
        session_id: sessionId,
        subject,
        variant_number: variant,
        question_number: questionNumber,
        topic_id: topicId,
        text_kk: conditionKk || null,
        text_ru: (sameLang ? conditionKk : conditionRu) || null,
        image_url: conditionImageUrl,
        answer_format: "quantity",
        choices: [],
        column_a_kk: colAKk,
        column_a_ru: sameLang ? colAKk : colARu,
        column_b_kk: colBKk,
        column_b_ru: sameLang ? colBKk : colBRu,
        correct_answer: correctLetter,
      },
      { onConflict: "session_id,subject,variant_number,question_number" }
    );

    if (saveErr) {
      setError(saveErr.message);
      setSaving(false);
      return;
    }

    setHighestSaved((h) => Math.max(h, questionNumber));
    setSaving(false);

    if (andAdvance && questionNumber < max) {
      const next = questionNumber + 1;
      setQuestionNumber(next);
      await loadQuestion(next);
    } else if (!andAdvance || questionNumber >= max) {
      router.push(`/admin/sessions/${sessionId}/questions`);
    }
  }

  if (loading) return <main className="p-10 text-ink/50">Жүктелуде...</main>;

  const isLast = questionNumber >= max;

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/admin/sessions/${sessionId}/questions`} className="text-sm text-ink/50 hover:underline">
        ← Артқа
      </Link>
      <h1 className="font-display text-2xl font-bold text-admin">
        {SUBJECT_LABELS[subject]} — Нұсқа {variant}
      </h1>

      <div className="mt-2 flex items-center gap-3">
        <button
          onClick={() => goToQuestion(questionNumber - 1)}
          disabled={questionNumber <= 1}
          className="focus-ring rounded-full border border-ink/15 px-3 py-1 text-sm disabled:opacity-30"
        >
          ← Алдыңғы
        </button>
        <p className="font-mono text-sm text-ink/60">
          Сұрақ {questionNumber} / {max}
        </p>
        <button
          onClick={() => goToQuestion(questionNumber + 1)}
          disabled={questionNumber >= highestSaved + 1 || questionNumber >= max}
          className="focus-ring rounded-full border border-ink/15 px-3 py-1 text-sm disabled:opacity-30"
        >
          Келесі →
        </button>
      </div>

      <div className="mt-6 flex flex-col gap-5 rounded-2xl border border-ink/10 bg-white p-6">
        <div>
          <label className="text-xs font-semibold text-ink/50">Тема</label>
          <select
            value={topicId}
            onChange={(e) => setTopicId(e.target.value)}
            className="focus-ring mt-1 w-full rounded-xl border border-ink/15 px-3 py-2 text-sm"
          >
            <option value="">— таңдау —</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name_kk === t.name_ru ? t.name_kk : `${t.name_kk} / ${t.name_ru}`}
              </option>
            ))}
          </select>
          {topics.length === 0 && (
            <p className="mt-1 text-xs text-red-500">
              Бұл пән бойынша тема жоқ. Алдымен{" "}
              <Link href="/admin/topics" className="underline">
                Тақырыптар
              </Link>{" "}
              бетінде қосыңыз.
            </p>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm text-ink/70">
          <input type="checkbox" checked={sameLang} onChange={(e) => handleSameLangToggle(e.target.checked)} />
          Бірдей мәтін екі тілде
        </label>

        <div>
          <label className="text-xs font-semibold text-ink/50">
            Жалпы шарт (міндетті емес){sameLang ? "" : " — қазақша"}
          </label>
          <textarea
            value={conditionKk}
            onChange={(e) => handleConditionKkChange(e.target.value)}
            rows={2}
            placeholder="мысалы: x > 0"
            className="focus-ring mt-1 w-full rounded-xl border border-ink/15 px-3 py-2 text-sm"
          />
          {!sameLang && (
            <textarea
              value={conditionRu}
              onChange={(e) => setConditionRu(e.target.value)}
              rows={2}
              placeholder="русский"
              className="focus-ring mt-2 w-full rounded-xl border border-ink/15 px-3 py-2 text-sm"
            />
          )}
          <div className="mt-2 flex items-center gap-3">
            <input
              key={questionNumber}
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
              disabled={uploading}
              className="text-sm"
            />
            {uploading && <span className="text-xs text-ink/50">Жүктелуде...</span>}
          </div>
          {conditionImageUrl && (
            <div className="mt-2 flex items-center gap-3">
              <img src={conditionImageUrl} alt="" className="max-h-32 rounded-lg border border-ink/10" />
              <button onClick={() => setConditionImageUrl(null)} className="focus-ring text-xs text-red-500 hover:underline">
                Өшіру
              </button>
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-ink/50">А бағаны{sameLang ? "" : " — қазақша"}</label>
            <textarea
              value={colAKk}
              onChange={(e) => handleColAKkChange(e.target.value)}
              rows={3}
              className="focus-ring mt-1 w-full rounded-xl border border-ink/15 px-3 py-2 text-sm"
            />
            {!sameLang && (
              <textarea
                value={colARu}
                onChange={(e) => setColARu(e.target.value)}
                rows={3}
                placeholder="русский"
                className="focus-ring mt-2 w-full rounded-xl border border-ink/15 px-3 py-2 text-sm"
              />
            )}
          </div>
          <div>
            <label className="text-xs font-semibold text-ink/50">В бағаны{sameLang ? "" : " — қазақша"}</label>
            <textarea
              value={colBKk}
              onChange={(e) => handleColBKkChange(e.target.value)}
              rows={3}
              className="focus-ring mt-1 w-full rounded-xl border border-ink/15 px-3 py-2 text-sm"
            />
            {!sameLang && (
              <textarea
                value={colBRu}
                onChange={(e) => setColBRu(e.target.value)}
                rows={3}
                placeholder="русский"
                className="focus-ring mt-2 w-full rounded-xl border border-ink/15 px-3 py-2 text-sm"
              />
            )}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-ink/50">Дұрыс жауап</label>
          <div className="mt-2 flex flex-col gap-2">
            {(Object.keys(QUANTITY_CHOICE_LABELS) as AnswerLetter[]).map((letter) => (
              <label key={letter} className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="radio"
                  name="quantity-correct"
                  checked={correctLetter === letter}
                  onChange={() => setCorrectLetter(letter)}
                />
                {letter}) {QUANTITY_CHOICE_LABELS[letter].kk} / {QUANTITY_CHOICE_LABELS[letter].ru}
              </label>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={() => handleSave(!isLast)}
          disabled={saving || uploading}
          className="focus-ring rounded-full bg-admin px-6 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Сақталуда..." : isLast ? "Сақтау" : "Келесі"}
        </button>
      </div>
    </div>
  );
}
