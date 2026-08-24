"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useLang } from "@/lib/LangContext";
import { SUBJECT_LABELS, SUBJECT_MINUTES, QUANTITY_CHOICE_LABELS, type SubjectKey } from "@/lib/questions/subjects";
import MathText from "@/components/MathText";

type QuestionPublic = {
  id: string;
  question_number: number;
  text_kk: string | null;
  text_ru: string | null;
  image_url: string | null;
  answer_format: "abcd" | "numeric" | "quantity";
  choices: { text_kk: string; text_ru: string }[];
  column_a_kk: string | null;
  column_a_ru: string | null;
  column_b_kk: string | null;
  column_b_ru: string | null;
  passage_id: string | null;
};

type Phase = "loading" | "error" | "consent" | "ready" | "question" | "break" | "finished";

const LETTERS = ["A", "B", "C", "D"] as const;
const BREAK_SECONDS = 5 * 60;

export default function TestTakingPage() {
  const params = useParams();
  const registrationId = params.registrationId as string;
  const { lang } = useLang();

  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [blocks, setBlocks] = useState<SubjectKey[]>([]);
  const [subjectIndex, setSubjectIndex] = useState(0);
  const [variantNumber, setVariantNumber] = useState(1);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const [questions, setQuestions] = useState<QuestionPublic[]>([]);
  const [passageText, setPassageText] = useState<string | null>(null);
  const [passageCache, setPassageCache] = useState<Record<string, string>>({});
  const [qIndex, setQIndex] = useState(0);

  const [pendingChoice, setPendingChoice] = useState<string | null>(null);
  const [pendingNumeric, setPendingNumeric] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const [secondsLeft, setSecondsLeft] = useState(0);
  const [consentChecked, setConsentChecked] = useState(false);
  const [finalScoreNote, setFinalScoreNote] = useState(false);

  const phaseRef = useRef(phase);
  const qIndexRef = useRef(qIndex);
  const questionsRef = useRef(questions);
  const subjectRef = useRef<SubjectKey | null>(null);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { qIndexRef.current = qIndex; }, [qIndex]);
  useEffect(() => { questionsRef.current = questions; }, [questions]);

  const currentSubject = blocks[subjectIndex] as SubjectKey | undefined;
  useEffect(() => { subjectRef.current = currentSubject ?? null; }, [currentSubject]);

  useEffect(() => {
    const q = questions[qIndex];
    if (!q) return;
    if (q.passage_id) {
      setPassageText(passageCache[q.passage_id] ?? null);
    } else {
      setPassageText(null);
    }
  }, [qIndex, questions, passageCache]);

  const loadQuestionsForSubject = useCallback(
    async (subject: SubjectKey, variant: number, sid: string) => {
      const { data } = await supabase
        .from("questions_public")
        .select("id, question_number, text_kk, text_ru, image_url, answer_format, choices, column_a_kk, column_a_ru, column_b_kk, column_b_ru, passage_id")
        .eq("session_id", sid)
        .eq("subject", subject)
        .eq("variant_number", variant)
        .order("question_number");
      setQuestions((data as any) ?? []);
      setQIndex(0);
      setPendingChoice(null);
      setPendingNumeric("");
      setConfirmed(false);

      const firstPassageId = (data as any)?.[0]?.passage_id;
      if (firstPassageId) {
        const passageIds = [...new Set(((data as any) ?? []).map((q: any) => q.passage_id).filter(Boolean))];
        const { data: passages } = await supabase
          .from("passages")
          .select("id, passage_text_kk, passage_text_ru")
          .in("id", passageIds);
        const cache: Record<string, string> = {};
        (passages ?? []).forEach((p) => {
          cache[p.id] = lang === "kk" ? p.passage_text_kk : p.passage_text_ru;
        });
        setPassageCache(cache);
        setPassageText(cache[firstPassageId] ?? null);
      } else {
        setPassageCache({});
        setPassageText(null);
      }
    },
    [lang]
  );

  useEffect(() => {
    async function init() {
      const { data: reg } = await supabase
        .from("registrations")
        .select("test_session_id, test_variant")
        .eq("id", registrationId)
        .maybeSingle();

      const { data, error } = await supabase.rpc("start_test_attempt", {
        p_registration_id: registrationId,
      });

      if (error || !data) {
        setErrorMsg("Брондау табылмады немесе онлайн формат емес.");
        setPhase("error");
        return;
      }

      const result = data as any;
      setBlocks(result.blocks ?? []);
      setSubjectIndex(result.current_subject_index ?? 0);
      setVariantNumber(parseInt(String(reg?.test_variant ?? "1"), 10) || 1);
      setSessionId(reg?.test_session_id ?? null);

      if (result.status === "submitted") {
        setPhase("finished");
        return;
      }

      if (!result.consent_given_at) {
        setPhase("consent");
      } else {
        setPhase("ready");
      }
    }
    init();
  }, [registrationId]);

  async function handleConfirmConsent() {
    await supabase.rpc("confirm_test_consent", { p_registration_id: registrationId });
    setPhase("ready");
  }

  async function handleStartSubject() {
    if (!currentSubject || !sessionId) return;
    await loadQuestionsForSubject(currentSubject, variantNumber, sessionId);
    setSecondsLeft(SUBJECT_MINUTES[currentSubject] * 60);
    setPhase("question");
  }

  const submitCurrentAsBlank = useCallback(async () => {
    const subj = subjectRef.current;
    const q = questionsRef.current[qIndexRef.current];
    if (!subj || !q) return;
    await supabase.rpc("save_test_answer", {
      p_registration_id: registrationId,
      p_subject: subj,
      p_question_number: q.question_number,
      p_answer: "",
    });
  }, [registrationId]);

  const goToNextQuestion = useCallback(async () => {
    const subj = subjectRef.current;
    if (!subj) return;
    const nextIndex = qIndexRef.current + 1;
    if (nextIndex >= questionsRef.current.length) {
      // subject finished
      const { data } = await supabase.rpc("advance_test_block", { p_registration_id: registrationId });
      const result = data as any;
      if (result?.is_finished) {
        await supabase.rpc("submit_test_attempt", { p_registration_id: registrationId });
        setPhase("finished");
      } else {
        setSubjectIndex(result.current_subject_index);
        setSecondsLeft(BREAK_SECONDS);
        setPhase("break");
      }
      return;
    }
    setQIndex(nextIndex);
    setPendingChoice(null);
    setPendingNumeric("");
    setConfirmed(false);
  }, [registrationId]);

  // Anti-cheat: leaving the tab/window marks ONLY the current question
  // blank and moves on — the test itself keeps going.
  useEffect(() => {
    async function handleLeave() {
      if (phaseRef.current !== "question") return;
      await submitCurrentAsBlank();
      await goToNextQuestion();
    }
    function onVisibility() {
      if (document.hidden) handleLeave();
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", handleLeave);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", handleLeave);
    };
  }, [submitCurrentAsBlank, goToNextQuestion]);

  // Per-question / per-subject countdown
  useEffect(() => {
    if (phase !== "question" && phase !== "break") return;
    if (secondsLeft <= 0) {
      if (phase === "question") {
        (async () => {
          await submitCurrentAsBlank();
          await goToNextQuestion();
        })();
      } else if (phase === "break") {
        handleStartSubject();
      }
      return;
    }
    const timer = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, secondsLeft]);

  async function handleConfirmAnswer() {
    const q = questions[qIndex];
    if (!q) return;
    const answer = q.answer_format === "numeric" ? pendingNumeric : pendingChoice ?? "";
    if (!answer) return;
    await supabase.rpc("save_test_answer", {
      p_registration_id: registrationId,
      p_subject: currentSubject,
      p_question_number: q.question_number,
      p_answer: answer,
    });
    setConfirmed(true);
    setTimeout(() => goToNextQuestion(), 400);
  }

  function formatTime(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  if (phase === "loading") return <main className="p-10 text-center text-ink/50">Жүктелуде...</main>;
  if (phase === "error")
    return <main className="p-10 text-center text-red-600">{errorMsg}</main>;

  if (phase === "consent") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-parchment px-4">
        <div className="w-full max-w-md rounded-3xl border border-ink/10 bg-white p-8 shadow-lg">
          <h1 className="font-display text-xl font-bold text-red-600">Маңызды ескерту</h1>
          <p className="mt-4 text-sm leading-relaxed text-ink/70">
            Тест барысында терезені жабуға немесе басқа қойындыға/қосымшаға ауысуға{" "}
            <b>болмайды</b>. Егер шықсаңыз, сол сәттегі сұрақ бос жауап ретінде есептеледі және тест
            жалғаса береді.
          </p>
          <label className="mt-5 flex items-start gap-2 text-sm text-ink/70">
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={(e) => setConsentChecked(e.target.checked)}
              className="mt-0.5 h-4 w-4"
            />
            Мен осы ережелермен келісемін.
          </label>
          <button
            onClick={handleConfirmConsent}
            disabled={!consentChecked}
            className="focus-ring mt-5 w-full rounded-full bg-gold px-5 py-3 text-sm font-bold text-ink shadow-[0_6px_16px_rgba(198,154,58,0.28)] transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
          >
            Жалғастыру
          </button>
        </div>
      </div>
    );
  }

  if (phase === "ready" || phase === "break") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-parchment px-4">
        <div className="w-full max-w-md rounded-3xl border border-ink/10 bg-white p-8 text-center shadow-lg">
          {phase === "break" ? (
            <>
              <h1 className="font-display text-xl font-bold text-ink">Үзіліс</h1>
              <p className="mt-2 text-sm text-ink/60">Келесі пән:</p>
              <p className="mt-1 font-display text-lg font-bold text-parent">
                {currentSubject && SUBJECT_LABELS[currentSubject]}
              </p>
              <p className="mt-4 font-mono text-3xl font-bold text-teacher tabular-nums">
                {formatTime(secondsLeft)}
              </p>
            </>
          ) : (
            <>
              <h1 className="font-display text-xl font-bold text-ink">
                {currentSubject && SUBJECT_LABELS[currentSubject]}
              </h1>
              <p className="mt-2 text-sm text-ink/60">
                Дайын болғанда бастаңыз. Уақыт: {currentSubject && SUBJECT_MINUTES[currentSubject]} минут.
              </p>
            </>
          )}
          <button
            onClick={handleStartSubject}
            className="focus-ring mt-5 w-full rounded-full bg-gold px-5 py-3 text-sm font-bold text-ink shadow-[0_6px_16px_rgba(198,154,58,0.28)] transition-transform hover:-translate-y-0.5"
          >
            {phase === "break" ? "Келесі пәнге өту" : "Бастау"}
          </button>
        </div>
      </div>
    );
  }

  if (phase === "finished") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-parchment px-4">
        <div className="w-full max-w-md rounded-3xl border border-ink/10 bg-white p-8 text-center shadow-lg">
          <h1 className="font-display text-xl font-bold text-parent">Тест аяқталды</h1>
          <p className="mt-4 text-sm text-ink/70">
            Жауаптарыңыз қабылданды. Нәтиже шамамен 1 күн ішінде жеке кабинетте пайда болады.
          </p>
        </div>
      </div>
    );
  }

  // phase === "question"
  const q = questions[qIndex];
  if (!q) return <main className="p-10 text-center text-ink/50">Жүктелуде...</main>;

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <div className="sticky top-0 z-10 mb-6 flex items-center justify-between rounded-2xl border border-ink/10 bg-white/95 px-5 py-3 shadow-sm backdrop-blur">
        <div>
          <p className="font-display font-bold text-ink">{currentSubject && SUBJECT_LABELS[currentSubject]}</p>
          <p className="font-mono text-xs text-ink/50">
            {qIndex + 1} / {questions.length}
          </p>
        </div>
        <div className="font-mono text-2xl font-bold text-teacher tabular-nums">
          {formatTime(secondsLeft)}
        </div>
      </div>

      {passageText && (
        <div className="mb-4 rounded-2xl border border-ink/10 bg-parchment p-5 text-sm leading-relaxed text-ink/80 whitespace-pre-line">
          <MathText text={passageText} />
        </div>
      )}

      <div className="rounded-2xl border border-ink/10 bg-white p-5">
        <p className="whitespace-pre-line font-medium text-ink">
          {qIndex + 1}. <MathText text={(lang === "kk" ? q.text_kk : q.text_ru) ?? ""} />
        </p>
        {q.image_url && <img src={q.image_url} alt="" className="my-3 max-w-xs" />}

        {q.answer_format === "numeric" && (
          <input
            value={pendingNumeric}
            onChange={(e) => setPendingNumeric(e.target.value.replace(/[^\d]/g, ""))}
            inputMode="numeric"
            disabled={confirmed}
            placeholder="Жауап"
            className="focus-ring mt-3 w-40 rounded-xl border border-ink/15 px-3 py-2 text-sm disabled:opacity-50"
          />
        )}

        {q.answer_format === "abcd" && (
          <div className="mt-3 flex flex-col gap-2">
            {q.choices.map((c, i) => {
              const letter = LETTERS[i];
              const selected = pendingChoice === letter;
              return (
                <button
                  key={i}
                  disabled={confirmed}
                  onClick={() => setPendingChoice(letter)}
                  className={`focus-ring rounded-xl border px-4 py-2.5 text-left text-sm transition-colors disabled:opacity-60 ${
                    selected ? "border-gold bg-gold/10 font-semibold text-ink" : "border-ink/15 hover:bg-parchment"
                  }`}
                >
                  <span className="font-mono">{letter})</span> <MathText text={(lang === "kk" ? c.text_kk : c.text_ru) ?? ""} />
                </button>
              );
            })}
          </div>
        )}

        {q.answer_format === "quantity" && (
          <>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-ink/10 p-3 text-sm">
                <p className="mb-1 font-mono text-xs font-semibold text-ink/40">А бағаны</p>
                <MathText text={(lang === "kk" ? q.column_a_kk : q.column_a_ru) ?? ""} />
              </div>
              <div className="rounded-xl border border-ink/10 p-3 text-sm">
                <p className="mb-1 font-mono text-xs font-semibold text-ink/40">В бағаны</p>
                <MathText text={(lang === "kk" ? q.column_b_kk : q.column_b_ru) ?? ""} />
              </div>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {(Object.keys(QUANTITY_CHOICE_LABELS) as ("A" | "B" | "C" | "D")[]).map((letter) => {
                const selected = pendingChoice === letter;
                return (
                  <button
                    key={letter}
                    disabled={confirmed}
                    onClick={() => setPendingChoice(letter)}
                    className={`focus-ring rounded-xl border px-4 py-2.5 text-left text-sm transition-colors disabled:opacity-60 ${
                      selected ? "border-gold bg-gold/10 font-semibold text-ink" : "border-ink/15 hover:bg-parchment"
                    }`}
                  >
                    <span className="font-mono">{letter})</span> {lang === "kk" ? QUANTITY_CHOICE_LABELS[letter].kk : QUANTITY_CHOICE_LABELS[letter].ru}
                  </button>
                );
              })}
            </div>
          </>
        )}

        <button
          onClick={handleConfirmAnswer}
          disabled={confirmed || (q.answer_format === "numeric" ? !pendingNumeric : !pendingChoice)}
          className="focus-ring mt-4 w-full rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-ink shadow-[0_6px_16px_rgba(198,154,58,0.28)] transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
        >
          {confirmed ? "Растайды..." : "Растау"}
        </button>
      </div>
    </div>
  );
}
