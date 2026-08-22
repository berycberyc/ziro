"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { SUBJECT_MAX_COUNT, SUBJECT_LABELS, type SubjectKey } from "@/lib/questions/subjects";

type Topic = { id: string; name_kk: string; name_ru: string };
type Choice = { text_kk: string; text_ru: string; correct: boolean };

const emptyChoices = (): Choice[] =>
  Array.from({ length: 4 }, () => ({ text_kk: "", text_ru: "", correct: false }));

export default function QuestionEntryFormPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = params.id as string;
  const variant = parseInt(searchParams.get("variant") ?? "1", 10);
  const subject = (searchParams.get("subject") ?? "math") as SubjectKey;
  const max = SUBJECT_MAX_COUNT[subject];

  const [topics, setTopics] = useState<Topic[]>([]);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [highestSaved, setHighestSaved] = useState(0);
  const [topicId, setTopicId] = useState("");
  const [sameLang, setSameLang] = useState(true);
  const [textKk, setTextKk] = useState("");
  const [textRu, setTextRu] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [choices, setChoices] = useState<Choice[]>(emptyChoices());
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadQuestion = useCallback(
    async (num: number) => {
      const { data } = await supabase
        .from("questions")
        .select("topic_id, text_kk, text_ru, image_url, choices")
        .eq("session_id", sessionId)
        .eq("subject", subject)
        .eq("variant_number", variant)
        .eq("question_number", num)
        .maybeSingle();

      if (data) {
        setTopicId(data.topic_id ?? "");
        setTextKk(data.text_kk ?? "");
        setTextRu(data.text_ru ?? "");
        setSameLang((data.text_kk ?? "") === (data.text_ru ?? ""));
        setImageUrl(data.image_url ?? null);
        setChoices(data.choices?.length === 4 ? data.choices : emptyChoices());
      } else {
        setTopicId("");
        setTextKk("");
        setTextRu("");
        setSameLang(true);
        setImageUrl(null);
        setChoices(emptyChoices());
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
    const { error: uploadErr } = await supabase.storage.from("question-images").upload(path, file);
    if (uploadErr) {
      setError("Сурет жүктелмеді: " + uploadErr.message);
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from("question-images").getPublicUrl(path);
    setImageUrl(data.publicUrl);
    setUploading(false);
  }

  function updateChoice(index: number, field: "text_kk" | "text_ru", value: string) {
    setChoices((prev) =>
      prev.map((c, i) => {
        if (i !== index) return c;
        if (sameLang) return { ...c, text_kk: value, text_ru: value };
        return { ...c, [field]: value };
      })
    );
  }

  function setCorrect(index: number) {
    setChoices((prev) => prev.map((c, i) => ({ ...c, correct: i === index })));
  }

  function handleTextKkChange(value: string) {
    setTextKk(value);
    if (sameLang) setTextRu(value);
  }

  function handleSameLangToggle(checked: boolean) {
    setSameLang(checked);
    if (checked) {
      setTextRu(textKk);
      setChoices((prev) => prev.map((c) => ({ ...c, text_ru: c.text_kk })));
    }
  }

  function validate(): string | null {
    if (!topicId) return "Тема таңдалмаған.";
    if (!textKk.trim() || (!sameLang && !textRu.trim())) return "Сұрақ мәтіні толтырылмаған.";
    for (const c of choices) {
      if (!c.text_kk.trim() || (!sameLang && !c.text_ru.trim())) return "Барлық 4 жауап нұсқасы толтырылуы керек.";
    }
    if (!choices.some((c) => c.correct)) return "Дұрыс жауап белгіленбеген.";
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

    const finalTextRu = sameLang ? textKk : textRu;
    const finalChoices = choices.map((c) => (sameLang ? { ...c, text_ru: c.text_kk } : c));

    const { error: saveErr } = await supabase.from("questions").upsert(
      {
        session_id: sessionId,
        subject,
        variant_number: variant,
        question_number: questionNumber,
        topic_id: topicId,
        text_kk: textKk,
        text_ru: finalTextRu,
        image_url: imageUrl,
        answer_format: "abcd",
        choices: finalChoices,
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
        <p className="text-sm text-ink/60">
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
            {sameLang ? "Сұрақ мәтіні" : "Сұрақ мәтіні — қазақша"}
          </label>
          <textarea
            value={textKk}
            onChange={(e) => handleTextKkChange(e.target.value)}
            rows={3}
            className="focus-ring mt-1 w-full rounded-xl border border-ink/15 px-3 py-2 text-sm"
          />
        </div>
        {!sameLang && (
          <div>
            <label className="text-xs font-semibold text-ink/50">Текст вопроса — русский</label>
            <textarea
              value={textRu}
              onChange={(e) => setTextRu(e.target.value)}
              rows={3}
              className="focus-ring mt-1 w-full rounded-xl border border-ink/15 px-3 py-2 text-sm"
            />
          </div>
        )}

        <div>
          <label className="text-xs font-semibold text-ink/50">Сурет (міндетті емес)</label>
          <div className="mt-1 flex items-center gap-3">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
              disabled={uploading}
              className="text-sm"
            />
            {uploading && <span className="text-xs text-ink/50">Жүктелуде...</span>}
          </div>
          {imageUrl && (
            <div className="mt-2 flex items-center gap-3">
              <img src={imageUrl} alt="" className="max-h-32 rounded-lg border border-ink/10" />
              <button
                onClick={() => setImageUrl(null)}
                className="focus-ring text-xs text-red-500 hover:underline"
              >
                Өшіру
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <label className="text-xs font-semibold text-ink/50">Жауап нұсқалары (дұрысын белгілеңіз)</label>
          {choices.map((c, i) => (
            <div key={i} className="rounded-xl border border-ink/10 p-3">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correct"
                  checked={c.correct}
                  onChange={() => setCorrect(i)}
                  className="h-4 w-4"
                />
                <span className="text-sm font-semibold text-ink">{"ABCD"[i]})</span>
              </div>
              <div className={`mt-2 grid gap-2 ${sameLang ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>
                <input
                  value={c.text_kk}
                  onChange={(e) => updateChoice(i, "text_kk", e.target.value)}
                  placeholder={sameLang ? "жауап" : "қазақша"}
                  className="focus-ring rounded-lg border border-ink/15 px-3 py-1.5 text-sm"
                />
                {!sameLang && (
                  <input
                    value={c.text_ru}
                    onChange={(e) => updateChoice(i, "text_ru", e.target.value)}
                    placeholder="русский"
                    className="focus-ring rounded-lg border border-ink/15 px-3 py-1.5 text-sm"
                  />
                )}
              </div>
            </div>
          ))}
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
