"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useLang } from "@/lib/LangContext";
import { blocksForTestTypeCode, type StageBlock } from "@/lib/onlineTest/blocks";
import MathText from "@/components/MathText";

type BankItem = {
  id: string;
  question_number: number;
  text_kk: string | null;
  text_ru: string | null;
  answer_format: string;
  choices: { text: string; correct: boolean }[];
  image_svg: string | null;
};

type Attempt = {
  id: string;
  status: "in_progress" | "submitted" | "flagged_ended";
  current_block_key: string | null;
  current_block_started_at: string | null;
  answers: Record<string, Record<string, string>>;
  variant_number: number;
  score: number | null;
};

export default function OnlineTestPage() {
  const params = useParams();
  const router = useRouter();
  const registrationId = params.registrationId as string;
  const { lang } = useLang();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [blocks, setBlocks] = useState<(StageBlock & { question_bank_test_id: string })[]>([]);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [currentItems, setCurrentItems] = useState<BankItem[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [ending, setEnding] = useState(false);

  const attemptRef = useRef<Attempt | null>(null);
  const answersRef = useRef<Record<string, string>>({});
  useEffect(() => {
    attemptRef.current = attempt;
  }, [attempt]);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const currentBlockIndex = attempt
    ? blocks.findIndex((b) => b.key === attempt.current_block_key)
    : -1;
  const currentBlock = currentBlockIndex >= 0 ? blocks[currentBlockIndex] : null;

  const loadItemsForBlock = useCallback(
    async (block: StageBlock & { question_bank_test_id: string }, variantNumber: number) => {
      const { data } = await supabase
        .from("question_bank_items")
        .select("id, question_number, text_kk, text_ru, answer_format, choices, image_svg")
        .eq("test_id", block.question_bank_test_id)
        .eq("variant_number", variantNumber)
        .order("question_number");
      setCurrentItems((data ?? []) as BankItem[]);
    },
    []
  );

  const finalizeAttempt = useCallback(
    async (status: "submitted" | "flagged_ended") => {
      const att = attemptRef.current;
      if (!att) return;
      setEnding(true);

      const mergedAnswers = {
        ...att.answers,
        [att.current_block_key ?? ""]: answersRef.current,
      };

      // Score by re-fetching every block's items for this variant directly —
      // no shuffle/mapping to account for, since each variant's correct
      // answer is just whatever that row says.
      let correct = 0;
      let total = 0;
      for (const block of blocks) {
        const { data } = await supabase
          .from("question_bank_items")
          .select("id, answer_format, choices")
          .eq("test_id", block.question_bank_test_id)
          .eq("variant_number", att.variant_number);
        for (const item of data ?? []) {
          total += 1;
          const given = mergedAnswers[block.key]?.[item.id];
          if (!given) continue;
          if (item.answer_format === "numeric") {
            const correctText = item.choices?.[0]?.text?.trim();
            if (given.trim() === correctText) correct += 1;
          } else {
            const idx = "ABCDEF".indexOf(given);
            if (idx >= 0 && item.choices?.[idx]?.correct) correct += 1;
          }
        }
      }
      const score = total > 0 ? Math.round((correct / total) * 1000) / 10 : 0;

      await supabase
        .from("online_attempts")
        .update({
          status,
          answers: mergedAnswers,
          score,
          submitted_at: new Date().toISOString(),
        })
        .eq("id", att.id);

      setAttempt({ ...att, status, answers: mergedAnswers, score });
      setEnding(false);
    },
    [blocks]
  );

  // Anti-cheat: leaving the tab/app ends the test immediately with whatever was answered.
  useEffect(() => {
    function handleVisibility() {
      if (document.hidden && attemptRef.current?.status === "in_progress") {
        finalizeAttempt("flagged_ended");
      }
    }
    function handleBlur() {
      if (attemptRef.current?.status === "in_progress") {
        finalizeAttempt("flagged_ended");
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
    };
  }, [finalizeAttempt]);

  const goToNextBlock = useCallback(async () => {
    const att = attemptRef.current;
    if (!att) return;
    const idx = blocks.findIndex((b) => b.key === att.current_block_key);
    const mergedAnswers = { ...att.answers, [att.current_block_key ?? ""]: answersRef.current };

    if (idx === blocks.length - 1) {
      await finalizeAttempt("submitted");
      return;
    }

    const nextBlock = blocks[idx + 1];
    const nowIso = new Date().toISOString();
    await supabase
      .from("online_attempts")
      .update({
        answers: mergedAnswers,
        current_block_key: nextBlock.key,
        current_block_started_at: nowIso,
      })
      .eq("id", att.id);

    const updated = { ...att, answers: mergedAnswers, current_block_key: nextBlock.key, current_block_started_at: nowIso };
    setAttempt(updated);
    setAnswers({});
    setSecondsLeft(nextBlock.durationMinutes * 60);
    await loadItemsForBlock(nextBlock, att.variant_number);
  }, [blocks, finalizeAttempt, loadItemsForBlock]);

  // Countdown timer
  useEffect(() => {
    if (!attempt || attempt.status !== "in_progress") return;
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timer);
          goToNextBlock();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [attempt, secondsLeft, goToNextBlock]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.push("/login");
        return;
      }

      const { data: reg } = await supabase
        .from("registrations")
        .select("id, format, payment_status, test_type_id, test_session_id, test_variant")
        .eq("id", registrationId)
        .single();

      if (!reg || reg.format !== "online" || reg.payment_status !== "paid") {
        setError("Бұл тест сізге қолжетімсіз.");
        setLoading(false);
        return;
      }

      if (!reg.test_variant) {
        setError("Сізге әлі нұсқа тағайындалмаған. Әкімшіге хабарласыңыз.");
        setLoading(false);
        return;
      }
      const variantNumber = parseInt(String(reg.test_variant), 10) || 1;

      const { data: testType } = await supabase
        .from("test_types")
        .select("code")
        .eq("id", reg.test_type_id)
        .single();

      const allBlocks = blocksForTestTypeCode(testType?.code ?? "");

      const { data: stageTests } = await supabase
        .from("session_stage_tests")
        .select("block_key, question_bank_test_id")
        .eq("session_id", reg.test_session_id);
      const stageMap = new Map((stageTests ?? []).map((s: any) => [s.block_key, s.question_bank_test_id]));

      const activeBlocks = allBlocks
        .filter((b) => stageMap.has(b.key))
        .map((b) => ({ ...b, question_bank_test_id: stageMap.get(b.key)! }));

      if (activeBlocks.length === 0) {
        setError("Бұл сессия үшін онлайн тест әлі дайындалмаған.");
        setLoading(false);
        return;
      }
      setBlocks(activeBlocks);

      const { data: existing } = await supabase
        .from("online_attempts")
        .select("*")
        .eq("registration_id", registrationId)
        .maybeSingle();

      if (existing) {
        setAttempt(existing as Attempt);
        if (existing.status === "in_progress" && existing.current_block_key) {
          const block = activeBlocks.find((b) => b.key === existing.current_block_key)!;
          await loadItemsForBlock(block, existing.variant_number);
          setAnswers(existing.answers?.[block.key] ?? {});
          const elapsed = Math.floor(
            (Date.now() - new Date(existing.current_block_started_at).getTime()) / 1000
          );
          setSecondsLeft(Math.max(0, block.durationMinutes * 60 - elapsed));
        }
        setLoading(false);
        return;
      }

      // Create a new attempt — the variant is whatever was already assigned
      // to this registration (same field used for offline printing), no
      // randomness or shuffling to compute here anymore.
      const firstBlock = activeBlocks[0];
      const nowIso = new Date().toISOString();
      const { data: created } = await supabase
        .from("online_attempts")
        .insert({
          registration_id: registrationId,
          variant_number: variantNumber,
          status: "in_progress",
          current_block_key: firstBlock.key,
          current_block_started_at: nowIso,
          answers: {},
        })
        .select()
        .single();

      setAttempt(created as Attempt);
      await loadItemsForBlock(firstBlock, variantNumber);
      setSecondsLeft(firstBlock.durationMinutes * 60);
      setLoading(false);
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registrationId]);

  function setAnswer(itemId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [itemId]: value }));
    // Persist immediately so nothing is lost if the tab is closed abruptly.
    if (attempt) {
      const merged = { ...attempt.answers, [attempt.current_block_key ?? ""]: { ...answersRef.current, [itemId]: value } };
      supabase.from("online_attempts").update({ answers: merged }).eq("id", attempt.id);
    }
  }

  if (loading) return <main className="p-10 text-ink/50">Жүктелуде...</main>;
  if (error) return <main className="p-10 text-ink/70">{error}</main>;

  if (attempt?.status === "flagged_ended") {
    return (
      <main className="mx-auto max-w-lg p-10 text-center">
        <h1 className="font-display text-xl font-bold text-red-600">Тест тоқтатылды</h1>
        <p className="mt-3 text-sm text-ink/70">
          Сіз тест кезінде басқа қойындыға немесе қосымшаға ауыстыңыз, сондықтан тест автоматты
          түрде аяқталды. Сол сәтке дейінгі жауаптарыңыз сақталды.
        </p>
        {attempt.score !== null && (
          <p className="mt-4 font-display text-lg font-bold text-ink">Нәтиже: {attempt.score}%</p>
        )}
      </main>
    );
  }

  if (attempt?.status === "submitted") {
    return (
      <main className="mx-auto max-w-lg p-10 text-center">
        <h1 className="font-display text-xl font-bold text-parent">Тест аяқталды</h1>
        <p className="mt-3 text-sm text-ink/70">Жауаптарыңыз қабылданды.</p>
        {attempt.score !== null && (
          <p className="mt-4 font-display text-lg font-bold text-ink">Нәтиже: {attempt.score}%</p>
        )}
      </main>
    );
  }

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <div className="sticky top-0 z-10 mb-6 flex items-center justify-between rounded-2xl border border-ink/10 bg-white/95 px-5 py-3 shadow-sm backdrop-blur">
        <div>
          <p className="font-display font-bold text-ink">{currentBlock?.labelKk}</p>
          <p className="text-xs text-ink/50">
            Блок {currentBlockIndex + 1} / {blocks.length}
          </p>
        </div>
        <div className="font-display text-2xl font-bold text-teacher tabular-nums">
          {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {currentItems.map((item, index) => (
          <div key={item.id} className="rounded-2xl border border-ink/10 bg-white p-5">
            <p className="font-medium text-ink">
              {index + 1}. <MathText text={(lang === "kk" ? item.text_kk : item.text_ru ?? item.text_kk) ?? ""} />
            </p>
            {item.image_svg && (
              <div
                className="my-3 max-w-xs"
                dangerouslySetInnerHTML={{ __html: item.image_svg }}
              />
            )}
            {item.answer_format === "numeric" ? (
              <input
                value={answers[item.id] ?? ""}
                onChange={(e) => setAnswer(item.id, e.target.value)}
                placeholder="Жауап"
                className="focus-ring mt-3 w-40 rounded-xl border border-ink/15 px-3 py-2 text-sm"
              />
            ) : (
              <div className="mt-3 flex flex-col gap-2">
                {item.choices.map((choice, ci) => {
                  const letter = "ABCDEF"[ci];
                  const selected = answers[item.id] === letter;
                  return (
                    <button
                      key={ci}
                      onClick={() => setAnswer(item.id, letter)}
                      className={`focus-ring rounded-xl border px-4 py-2.5 text-left text-sm transition-colors ${
                        selected
                          ? "border-teacher bg-teacher-soft font-semibold text-teacher"
                          : "border-ink/15 hover:bg-parchment"
                      }`}
                    >
                      {letter}) <MathText text={choice.text} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={goToNextBlock}
        disabled={ending}
        className="focus-ring mt-6 w-full rounded-full bg-teacher px-6 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
      >
        {currentBlockIndex === blocks.length - 1 ? "Тестті аяқтау" : "Келесі пәнге өту"}
      </button>
    </main>
  );
}
