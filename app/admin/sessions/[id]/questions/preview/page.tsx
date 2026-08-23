"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { SUBJECT_LABELS, QUANTITY_CHOICE_LABELS, type SubjectKey } from "@/lib/questions/subjects";

type Choice = { text_kk: string; text_ru: string; correct: boolean };
type Question = {
  id: string;
  question_number: number;
  text_kk: string | null;
  text_ru: string | null;
  image_url: string | null;
  answer_format: "abcd" | "numeric" | "quantity";
  choices: Choice[];
  correct_answer: string | null;
  column_a_kk: string | null;
  column_a_ru: string | null;
  column_b_kk: string | null;
  column_b_ru: string | null;
  passage_id: string | null;
  topics: { name_kk: string; name_ru: string } | null;
};
type Passage = { id: string; passage_text: string; order_number: number };

const LETTERS = ["A", "B", "C", "D"];

export default function QuestionPreviewPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const sessionId = params.id as string;
  const variant = parseInt(searchParams.get("variant") ?? "1", 10);
  const subject = (searchParams.get("subject") ?? "math") as SubjectKey;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [passages, setPassages] = useState<Record<string, Passage>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("questions")
        .select(
          "id, question_number, text_kk, text_ru, image_url, answer_format, choices, correct_answer, column_a_kk, column_a_ru, column_b_kk, column_b_ru, passage_id, topics ( name_kk, name_ru )"
        )
        .eq("session_id", sessionId)
        .eq("subject", subject)
        .eq("variant_number", variant)
        .order("question_number");
      setQuestions((data as any) ?? []);

      const passageIds = [...new Set(((data as any) ?? []).map((q: any) => q.passage_id).filter(Boolean))];
      if (passageIds.length > 0) {
        const { data: passageData } = await supabase
          .from("passages")
          .select("id, passage_text, order_number")
          .in("id", passageIds);
        const map: Record<string, Passage> = {};
        (passageData ?? []).forEach((p) => { map[p.id] = p; });
        setPassages(map);
      }
      setLoading(false);
    }
    load();
  }, [sessionId, subject, variant]);

  if (loading) return <main className="p-10 text-ink/50">Жүктелуде...</main>;

  let lastPassageId: string | null = null;

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/admin/sessions/${sessionId}/questions`} className="text-sm text-ink/50 hover:underline">
        ← Артқа
      </Link>
      <h1 className="font-display text-2xl font-bold text-admin">
        {SUBJECT_LABELS[subject]} — Нұсқа {variant} (алдын ала қарау)
      </h1>
      <p className="mt-1 text-sm text-ink/50">Барлығы: {questions.length} сұрақ</p>

      <div className="mt-6 flex flex-col gap-4">
        {questions.map((q) => {
          const showPassage = q.passage_id && q.passage_id !== lastPassageId;
          if (q.passage_id) lastPassageId = q.passage_id;

          return (
            <div key={q.id}>
              {showPassage && q.passage_id && passages[q.passage_id] && (
                <div className="mb-3 rounded-2xl border border-ink/10 bg-parchment p-4 text-sm leading-relaxed text-ink/80 whitespace-pre-line">
                  {passages[q.passage_id].passage_text}
                </div>
              )}

              <div className="rounded-2xl border border-ink/10 bg-white p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-ink">
                    {q.question_number}. {q.text_kk}
                    {q.text_ru && q.text_ru !== q.text_kk && (
                      <span className="block text-sm text-ink/50">{q.text_ru}</span>
                    )}
                  </p>
                  {q.topics && (
                    <span className="shrink-0 rounded-full bg-admin-soft px-2 py-0.5 text-xs text-admin">
                      {q.topics.name_kk}
                    </span>
                  )}
                </div>

                {q.image_url && <img src={q.image_url} alt="" className="my-3 max-w-xs" />}

                {q.answer_format === "abcd" && (
                  <div className="mt-2 flex flex-col gap-1">
                    {q.choices?.map((c, i) => (
                      <p
                        key={i}
                        className={`text-sm ${c.correct ? "font-semibold text-parent" : "text-ink/70"}`}
                      >
                        {LETTERS[i]}) {c.text_kk} {c.correct && "✓"}
                      </p>
                    ))}
                  </div>
                )}

                {q.answer_format === "numeric" && (
                  <p className="mt-2 text-sm font-semibold text-parent">
                    Дұрыс жауап: {q.correct_answer}
                  </p>
                )}

                {q.answer_format === "quantity" && (
                  <div className="mt-2">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-lg border border-ink/10 p-2">
                        <p className="text-xs text-ink/40">А бағаны</p>
                        {q.column_a_kk}
                      </div>
                      <div className="rounded-lg border border-ink/10 p-2">
                        <p className="text-xs text-ink/40">В бағаны</p>
                        {q.column_b_kk}
                      </div>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-parent">
                      Дұрыс жауап: {q.correct_answer && QUANTITY_CHOICE_LABELS[q.correct_answer as "A" | "B" | "C" | "D"]?.kk}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {questions.length === 0 && <p className="text-sm text-ink/40">Бұл нұсқада әлі сұрақ жоқ.</p>}
      </div>
    </div>
  );
}
