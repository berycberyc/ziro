"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  SUBJECT_MINUTES,
  QUANTITY_CHOICE_LABELS,
  MONOLINGUAL_SUBJECTS,
  type SubjectKey,
} from "@/lib/questions/subjects";
import {
  TEST_TEXT,
  TEST_SUBJECT_LABELS,
  formatStartMoment,
  type TestLang,
  type TestText,
} from "@/lib/i18n-test";
import MathText from "@/components/MathText";

type QuestionPublic = {
  id: string;
  question_number: number;
  text_kk: string | null;
  text_ru: string | null;
  image_url: string | null;
  image_url_ru: string | null;
  answer_format: "abcd" | "numeric" | "quantity";
  choices: { text_kk: string; text_ru: string }[];
  column_a_kk: string | null;
  column_a_ru: string | null;
  column_b_kk: string | null;
  column_b_ru: string | null;
  passage_id: string | null;
};

type PassageRow = { id: string; passage_text_kk: string; passage_text_ru: string };

type Phase =
  | "loading"
  | "error"
  | "waiting"       // тест әлі басталған жоқ
  | "entry_closed"  // кіру уақыты өтіп кеткен
  | "consent"
  | "ready"         // блокты бастау / үзіліс
  | "question"
  | "finished";

type SaveState = "idle" | "saving" | "saved" | "retrying";

/** Қате мәтіні тіл белгілі болғанша сақталып тұруы үшін — кілт түрінде. */
type ErrorKey =
  | "errNotFound"
  | "errNoSession"
  | "errNoBlocks"
  | "errNoQuestions"
  | "errLoadQuestions"
  | "errStart"
  | "errFinish"
  | "errDeadlinePassed"
  | "errBlockOver";

const LETTERS = ["A", "B", "C", "D"] as const;

export default function TestTakingPage() {
  const params = useParams();
  const registrationId = params.registrationId as string;

  // Экранның тілі — оқушының карточкасындағы тіл. Сайттың тіл ауыстырғышы
  // мұнда қатысы жоқ: оқушы жүйеге кірмей, өз телефонынан кіреді.
  const [lang, setLang] = useState<TestLang>("kk");
  const t: TestText = TEST_TEXT[lang];

  const [phase, setPhase] = useState<Phase>("loading");
  const [errorKey, setErrorKey] = useState<ErrorKey | "">("");

  const [blocks, setBlocks] = useState<SubjectKey[]>([]);
  const [subjectIndex, setSubjectIndex] = useState(0);
  const [variantNumber, setVariantNumber] = useState(1);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const [questions, setQuestions] = useState<QuestionPublic[]>([]);
  const [passages, setPassages] = useState<Record<string, PassageRow>>({});
  const [qIndex, setQIndex] = useState(0);

  // Барлық жауаптар: { сұрақ нөмірі -> жауап }. Ағымдағы пән бойынша.
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  // Кесте: тест басталатын сәт, кіру жабылатын сәт, жеке шекті уақыт.
  const [startsAt, setStartsAt] = useState<number | null>(null);
  const [entryClosesAt, setEntryClosesAt] = useState<number | null>(null);
  const [deadlineAt, setDeadlineAt] = useState<number | null>(null);
  const [breakEndsAt, setBreakEndsAt] = useState<number | null>(null);
  const [untilStart, setUntilStart] = useState<number | null>(null);
  const [breakLeft, setBreakLeft] = useState<number | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  // Оқушы жоқта блоктың уақыты бітіп кеткен бе. Ондайда «Бастау» емес,
  // басқа экран көрсетеміз — әйтпесе бала бастап, бірден лақтырылады.
  const [blockExpired, setBlockExpired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);

  const currentSubject = blocks[subjectIndex] as SubjectKey | undefined;
  const monolingual = currentSubject ? MONOLINGUAL_SUBJECTS.includes(currentSubject) : false;

  // Сервер мен құрылғы сағатының айырмасы. Оқушы телефонының уақытын
  // өзгертсе де, қалған уақыт серверге қарап есептеледі.
  const clockOffsetRef = useRef(0);
  const deadlineRef = useRef<number | null>(null);

  function noteServerTime(serverNow: string | null | undefined) {
    if (!serverNow) return;
    clockOffsetRef.current = Date.now() - new Date(serverNow).getTime();
  }

  function computeDeadline(startedAt: string | null, subject: SubjectKey | undefined) {
    if (!startedAt || !subject) return null;
    const startMs = new Date(startedAt).getTime() + clockOffsetRef.current;
    return startMs + SUBJECT_MINUTES[subject] * 60 * 1000;
  }

  // ------------------------------------------------------------------
  // Жауапты сақтау кезегі. Интернет үзілсе жауап жоғалмауы керек —
  // сондықтан кезекке қойып, сәтсіз болса қайталаймыз.
  // ------------------------------------------------------------------
  const queueRef = useRef<{ subject: string; qnum: number; answer: string }[]>([]);
  const workingRef = useRef(false);

  const processQueue = useCallback(async () => {
    if (workingRef.current) return;
    workingRef.current = true;

    while (queueRef.current.length > 0) {
      const item = queueRef.current[0];
      setSaveState("saving");
      let ok = false;

      for (let attempt = 0; attempt < 4 && !ok; attempt++) {
        const { error } = await supabase.rpc("save_test_answer", {
          p_registration_id: registrationId,
          p_subject: item.subject,
          p_question_number: item.qnum,
          p_answer: item.answer,
        });
        if (!error) {
          ok = true;
          break;
        }
        // Сервер уақыт бітті деп қайтарса — қайталаудың мағынасы жоқ.
        const msg = String(error.message ?? "");
        if (
          msg.includes("deadline_passed") ||
          msg.includes("block_time_over") ||
          msg.includes("attempt_closed") ||
          msg.includes("wrong_block")
        ) {
          queueRef.current = [];
          workingRef.current = false;
          setSaveState("idle");
          setErrorKey(
            msg.includes("deadline_passed") ? "errDeadlinePassed" : "errBlockOver"
          );
          setPhase("finished");
          return;
        }
        setSaveState("retrying");
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      }

      if (!ok) {
        // Жауапты кезекте қалдырамыз — келесі әрекетте тағы тырысады.
        setSaveState("retrying");
        workingRef.current = false;
        setTimeout(() => processQueue(), 4000);
        return;
      }

      queueRef.current.shift();
    }

    setSaveState("saved");
    workingRef.current = false;
  }, [registrationId]);

  const queueAnswer = useCallback(
    (qnum: number, answer: string) => {
      const subj = currentSubject;
      if (!subj) return;
      setAnswers((prev) => ({ ...prev, [qnum]: answer }));
      // Сол сұрақтың ескі жазбасын кезектен алып тастаймыз — соңғысы ғана керек.
      queueRef.current = queueRef.current.filter((i) => !(i.subject === subj && i.qnum === qnum));
      queueRef.current.push({ subject: subj, qnum, answer });
      processQueue();
    },
    [currentSubject, processQueue]
  );

  /** Блокты аяқтамас бұрын кезектегінің бәрі жетуі керек. */
  const flushQueue = useCallback(async () => {
    for (let i = 0; i < 25 && queueRef.current.length > 0; i++) {
      await processQueue();
      if (queueRef.current.length > 0) await new Promise((r) => setTimeout(r, 500));
    }
    return queueRef.current.length === 0;
  }, [processQueue]);

  // ------------------------------------------------------------------
  // Сұрақтарды және мәтіндерді жүктеу
  // ------------------------------------------------------------------
  const loadQuestions = useCallback(
    async (subject: SubjectKey, variant: number, sid: string) => {
      const { data, error } = await supabase
        .from("questions_public")
        .select(
          "id, question_number, text_kk, text_ru, image_url, image_url_ru, answer_format, choices, column_a_kk, column_a_ru, column_b_kk, column_b_ru, passage_id"
        )
        .eq("session_id", sid)
        .eq("subject", subject)
        .eq("variant_number", variant)
        .order("question_number");
      if (error) throw error;

      const list = (data as QuestionPublic[]) ?? [];
      setQuestions(list);

      // МАҢЫЗДЫ: мәтіндерді БҮКІЛ блок бойынша жинаймыз. Бұрын тек бірінші
      // сұрақта мәтін болса ғана жүктелетін — тілдерде алғашқы сұрақтар
      // мәтінсіз болғандықтан, мәтін ешқайда көрінбей қалатын.
      const passageIds = [...new Set(list.map((q) => q.passage_id).filter(Boolean))] as string[];
      if (passageIds.length > 0) {
        const { data: rows } = await supabase
          .from("passages")
          .select("id, passage_text_kk, passage_text_ru")
          .in("id", passageIds);
        const map: Record<string, PassageRow> = {};
        (rows ?? []).forEach((p: any) => {
          map[p.id] = p;
        });
        setPassages(map);
      } else {
        setPassages({});
      }

      return list.length;
    },
    []
  );

  // ------------------------------------------------------------------
  // Бетті ашқанда: күйді толық қалпына келтіру
  // ------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const { data, error } = await supabase.rpc("start_test_attempt", {
        p_registration_id: registrationId,
      });

      if (cancelled) return;

      if (error || !data) {
        setErrorKey("errNotFound");
        setPhase("error");
        return;
      }

      const result = data as any;

      // Ең бірінші — тіл. Қалған бәрі осы тілде көрсетіледі.
      setLang(result.student_language === "ru" ? "ru" : "kk");

      noteServerTime(result.server_now);

      const toMs = (v: string | null | undefined) =>
        v ? new Date(v).getTime() + clockOffsetRef.current : null;

      setStartsAt(toMs(result.starts_at));
      setEntryClosesAt(toMs(result.entry_closes_at));

      // Тест әлі басталған жоқ — бір ғана хабарлама, 10 минут қалғанда
      // сол беттің өзі кері санаққа айналады.
      if (result.phase === "waiting") {
        setPhase("waiting");
        return;
      }

      // Кіру терезесі жабылған (басталғаннан кейін 30 минут).
      if (result.phase === "entry_closed") {
        setPhase("entry_closed");
        return;
      }

      if (!result.session_id) {
        setErrorKey("errNoSession");
        setPhase("error");
        return;
      }
      const blockList: SubjectKey[] = result.blocks ?? [];
      if (blockList.length === 0) {
        setErrorKey("errNoBlocks");
        setPhase("error");
        return;
      }

      setBlocks(blockList);
      setSessionId(result.session_id);
      setVariantNumber(Number(result.variant_number) || 1);
      setDeadlineAt(toMs(result.deadline_at));
      setBreakEndsAt(toMs(result.break_ends_at));

      if (result.phase === "finished" || result.status === "submitted") {
        setPhase("finished");
        return;
      }

      const idx = result.current_subject_index ?? 0;
      setSubjectIndex(idx);

      if (!result.consent_given_at) {
        setPhase("consent");
        return;
      }

      const subject = blockList[idx];
      if (!subject) {
        setPhase("finished");
        return;
      }

      // Бұрын берілген жауаптарды қалпына келтіреміз.
      const saved = (result.answers ?? {})[subject] ?? {};
      const restored: Record<number, string> = {};
      Object.keys(saved).forEach((k) => {
        restored[Number(k)] = String(saved[k] ?? "");
      });
      setAnswers(restored);

      // Уақыт басталмаған болса — бастау экраны.
      if (!result.subject_started_at) {
        setPhase("ready");
        return;
      }

      const deadline = computeDeadline(result.subject_started_at, subject);
      const left = deadline ? Math.round((deadline - Date.now()) / 1000) : 0;

      if (left <= 0) {
        // Уақыт біткен: бастау экраны емес, «уақыт бітті» экраны.
        setBlockExpired(true);
        setPhase("ready");
        setSecondsLeft(0);
        return;
      }

      try {
        await loadQuestions(subject, Number(result.variant_number) || 1, result.session_id);
      } catch (err) {
        console.error("Failed to load questions:", err);
        setErrorKey("errLoadQuestions");
        setPhase("error");
        return;
      }

      if (cancelled) return;
      deadlineRef.current = deadline;
      setSecondsLeft(left);
      // Жауап берілмеген алғашқы сұрақтан жалғастырамыз.
      setPhase("question");
    }

    init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registrationId]);

  // Тест басталуын күту: кері санақ және басталған сәтте автоматты кіру.
  useEffect(() => {
    if (phase !== "waiting" || startsAt === null) return;
    const tick = () => {
      const left = Math.round((startsAt - Date.now()) / 1000);
      setUntilStart(left);
      if (left <= 0) {
        // Уақыт келді — бетті қайта сұратамыз, экран өзі ашылады.
        window.location.reload();
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [phase, startsAt]);

  // Үзіліс: 5 минут кері санақ, нөлге жеткенде келесі блок өзі басталады.
  // Уақыты бітіп кеткен блокта бұл жүрмеуі керек: онда бастайтын ештеңе жоқ,
  // әйтпесе жаңа экран көрінбей, бала бірден лақтырылады.
  useEffect(() => {
    if (phase !== "ready" || breakEndsAt === null || blockExpired) return;
    const tick = () => {
      const left = Math.round((breakEndsAt - Date.now()) / 1000);
      setBreakLeft(left);
      if (left <= 0) startSubjectRef.current();
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [phase, breakEndsAt, blockExpired]);

  // Қалпына келтіргеннен кейін бірінші бос сұраққа тұрамыз.
  const positionedRef = useRef(false);
  useEffect(() => {
    if (phase !== "question" || positionedRef.current || questions.length === 0) return;
    positionedRef.current = true;
    const firstEmpty = questions.findIndex((q) => !answers[q.question_number]);
    setQIndex(firstEmpty >= 0 ? firstEmpty : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, questions]);

  // ------------------------------------------------------------------
  // Таймер
  // ------------------------------------------------------------------
  const finishBlockRef = useRef<() => void>(() => {});
  const startSubjectRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (phase !== "question" || deadlineRef.current === null) return;
    const tick = () => {
      const left = Math.round(((deadlineRef.current ?? 0) - Date.now()) / 1000);
      setSecondsLeft(left);
      if (left <= 0) finishBlockRef.current();
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  // ------------------------------------------------------------------
  // Блокты бастау / аяқтау
  // ------------------------------------------------------------------
  async function handleConfirmConsent() {
    await supabase.rpc("confirm_test_consent", { p_registration_id: registrationId });
    setPhase("ready");
  }

  async function handleStartSubject() {
    if (busy) return;
    if (!currentSubject || !sessionId) {
      setErrorKey("errStart");
      setPhase("error");
      return;
    }
    setBusy(true);
    try {
      const loaded = await loadQuestions(currentSubject, variantNumber, sessionId);
      if (loaded === 0) {
        setErrorKey("errNoQuestions");
        setPhase("error");
        return;
      }

      const { data, error } = await supabase.rpc("start_subject_timer", {
        p_registration_id: registrationId,
      });
      if (error || !data) throw error ?? new Error("no timer");

      const res = data as any;
      noteServerTime(res.server_now);
      setBreakEndsAt(null);
      setBreakLeft(null);
      if (res.deadline_at) {
        setDeadlineAt(new Date(res.deadline_at).getTime() + clockOffsetRef.current);
      }
      deadlineRef.current = computeDeadline(res.subject_started_at, currentSubject);
      setSecondsLeft(
        deadlineRef.current ? Math.round((deadlineRef.current - Date.now()) / 1000) : 0
      );
      positionedRef.current = false;
      setQIndex(0);
      setBlockExpired(false);
      setPhase("question");
    } catch (err) {
      console.error("Failed to start subject:", err);
      setErrorKey("errStart");
      setPhase("error");
    } finally {
      setBusy(false);
    }
  }

  const finishBlock = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setConfirmFinish(false);
    try {
      await flushQueue();

      const { data } = await supabase.rpc("advance_test_block", {
        p_registration_id: registrationId,
        p_reason: (secondsLeft ?? 1) <= 0 ? "timeout" : "finished",
      });
      const res = data as any;
      noteServerTime(res?.server_now);

      if (res?.is_finished) {
        await supabase.rpc("submit_test_attempt", { p_registration_id: registrationId });
        setPhase("finished");
        return;
      }

      setSubjectIndex(res?.current_subject_index ?? subjectIndex + 1);
      setBreakEndsAt(
        res?.break_ends_at ? new Date(res.break_ends_at).getTime() + clockOffsetRef.current : null
      );
      setAnswers({});
      setQuestions([]);
      setPassages({});
      setQIndex(0);
      deadlineRef.current = null;
      setSecondsLeft(null);
      positionedRef.current = false;
      setBlockExpired(false);
      setPhase("ready");
    } catch (err) {
      console.error("Failed to finish block:", err);
      setErrorKey("errFinish");
      setPhase("error");
    } finally {
      setBusy(false);
    }
  }, [busy, flushQueue, registrationId, subjectIndex, secondsLeft]);

  useEffect(() => {
    finishBlockRef.current = finishBlock;
  });

  useEffect(() => {
    startSubjectRef.current = handleStartSubject;
  });

  // ------------------------------------------------------------------
  // Жауап беру
  // ------------------------------------------------------------------
  const numericTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChoice(qnum: number, letter: string) {
    // Қайта басса — таңдауды алып тастайды.
    queueAnswer(qnum, answers[qnum] === letter ? "" : letter);
  }

  function handleNumeric(qnum: number, value: string) {
    const clean = value.replace(/[^\d]/g, "");
    setAnswers((prev) => ({ ...prev, [qnum]: clean }));
    if (numericTimer.current) clearTimeout(numericTimer.current);
    numericTimer.current = setTimeout(() => queueAnswer(qnum, clean), 600);
  }

  function formatTime(s: number) {
    const safe = Math.max(0, s);
    const h = Math.floor(safe / 3600);
    const m = Math.floor((safe % 3600) / 60);
    const sec = safe % 60;
    const mm = String(m).padStart(2, "0");
    const ss = String(sec).padStart(2, "0");
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }

  function passageFor(q: QuestionPublic | undefined) {
    if (!q?.passage_id) return null;
    const p = passages[q.passage_id];
    if (!p) return null;
    // Тілдер бір тілде — қай тіл таңдалса да, сол мәтін көрсетіледі.
    if (monolingual) return p.passage_text_kk || p.passage_text_ru;
    return (lang === "kk" ? p.passage_text_kk : p.passage_text_ru) || p.passage_text_kk;
  }

  function qText(q: QuestionPublic) {
    if (monolingual) return q.text_kk || q.text_ru || "";
    return ((lang === "kk" ? q.text_kk : q.text_ru) ?? "") || q.text_kk || "";
  }

  function choiceText(c: { text_kk: string; text_ru: string }) {
    if (monolingual) return c.text_kk || c.text_ru || "";
    return ((lang === "kk" ? c.text_kk : c.text_ru) ?? "") || c.text_kk || "";
  }

  // ------------------------------------------------------------------
  // Экрандар
  // ------------------------------------------------------------------
  if (phase === "loading") return <main className="p-10 text-center text-ink/50">{t.loading}</main>;

  if (phase === "error")
    return (
      <main className="p-10 text-center text-red-600">{errorKey ? t[errorKey] : ""}</main>
    );

  if (phase === "waiting") {
    const startText = startsAt
      ? formatStartMoment(startsAt - clockOffsetRef.current, lang)
      : "";
    // 10 минут қалғанда осы беттің өзі кері санаққа айналады.
    const showCountdown = untilStart !== null && untilStart <= 10 * 60;

    return (
      <div className="flex min-h-screen items-center justify-center bg-parchment px-4">
        <div className="w-full max-w-md rounded-3xl border border-ink/10 bg-white p-8 text-center shadow-lg">
          <h1 className="font-display text-xl font-bold text-ink">{t.waitingTitle}</h1>
          <p className="mt-3 text-sm text-ink/70">{t.waitingWhen(startText)}</p>

          {showCountdown ? (
            <>
              <p className="mt-6 font-mono text-5xl font-bold tabular-nums text-teacher">
                {formatTime(untilStart ?? 0)}
              </p>
              <p className="mt-2 text-xs text-ink/50">{t.waitingSelfOpens}</p>
            </>
          ) : (
            <p className="mt-4 text-sm text-ink/60">{t.waitingHint}</p>
          )}

          <p className="mt-6 text-xs leading-relaxed text-ink/50">{t.waitingEntryRule}</p>
        </div>
      </div>
    );
  }

  if (phase === "entry_closed") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-parchment px-4">
        <div className="w-full max-w-md rounded-3xl border border-ink/10 bg-white p-8 text-center shadow-lg">
          <h1 className="font-display text-xl font-bold text-clay">{t.entryClosedTitle}</h1>
          <p className="mt-3 text-sm text-ink/70">{t.entryClosedBody}</p>
          <p className="mt-3 text-xs text-ink/50">{t.entryClosedNote}</p>
        </div>
      </div>
    );
  }

  if (phase === "consent") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-parchment px-4">
        <div className="w-full max-w-md rounded-3xl border border-ink/10 bg-white p-8 shadow-lg">
          <h1 className="font-display text-xl font-bold text-ink">{t.consentTitle}</h1>
          <ul className="mt-4 space-y-2 text-sm leading-relaxed text-ink/70">
            {t.consentRules.map((rule) => (
              <li key={rule}>• {rule}</li>
            ))}
          </ul>
          <label className="mt-5 flex items-start gap-2 text-sm text-ink/70">
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={(e) => setConsentChecked(e.target.checked)}
              className="mt-0.5 h-4 w-4"
            />
            {t.consentCheck}
          </label>
          <button
            onClick={handleConfirmConsent}
            disabled={!consentChecked}
            className="focus-ring mt-5 w-full rounded-full bg-gold px-5 py-3 text-sm font-bold text-ink shadow-[0_6px_16px_rgba(198,154,58,0.28)] transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {t.consentContinue}
          </button>
        </div>
      </div>
    );
  }

  // Уақыты бітіп кеткен блок: бастайтын ештеңе жоқ, тек әрі қарай өту.
  if (phase === "ready" && blockExpired) {
    const isLast = subjectIndex + 1 >= blocks.length;
    return (
      <div className="flex min-h-screen items-center justify-center bg-parchment px-4">
        <div className="w-full max-w-md rounded-3xl border border-ink/10 bg-white p-8 text-center shadow-lg">
          <h1 className="font-display text-xl font-bold text-clay">{t.expiredTitle}</h1>
          <p className="mt-2 text-sm font-semibold text-ink/70">
            {currentSubject && TEST_SUBJECT_LABELS[currentSubject][lang]}
          </p>
          <p className="mt-3 text-sm text-ink/70">{t.expiredBody}</p>
          <p className="mt-3 text-xs text-ink/40">
            {t.blockCounter(subjectIndex + 1, blocks.length)}
          </p>
          <button
            onClick={finishBlock}
            disabled={busy}
            className="focus-ring mt-5 w-full rounded-full bg-ink px-5 py-3 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 disabled:opacity-60"
          >
            {busy ? t.sending : isLast ? t.expiredFinish : t.expiredNext}
          </button>
        </div>
      </div>
    );
  }

  if (phase === "ready") {
    const isBreak = subjectIndex > 0 && breakEndsAt !== null;
    return (
      <div className="flex min-h-screen items-center justify-center bg-parchment px-4">
        <div className="w-full max-w-md rounded-3xl border border-ink/10 bg-white p-8 text-center shadow-lg">
          {isBreak && <p className="font-display text-sm font-bold text-teacher">{t.breakLabel}</p>}
          <h1 className="mt-1 font-display text-xl font-bold text-ink">
            {currentSubject && TEST_SUBJECT_LABELS[currentSubject][lang]}
          </h1>
          <p className="mt-2 text-sm text-ink/60">
            {currentSubject && t.blockMinutes(SUBJECT_MINUTES[currentSubject])}
          </p>

          {isBreak && (
            <>
              <p className="mt-5 text-xs text-ink/50">
                {currentSubject && t.untilSubject(TEST_SUBJECT_LABELS[currentSubject][lang])}
              </p>
              <p className="mt-1 font-mono text-4xl font-bold tabular-nums text-teacher">
                {formatTime(breakLeft ?? 0)}
              </p>
              <p className="mt-2 text-xs text-ink/50">{t.breakHint}</p>
            </>
          )}

          <p className="mt-3 text-xs text-ink/40">
            {t.blockCounter(subjectIndex + 1, blocks.length)}
          </p>
          <button
            onClick={handleStartSubject}
            disabled={busy}
            className="focus-ring mt-5 w-full rounded-full bg-gold px-5 py-3 text-sm font-bold text-ink shadow-[0_6px_16px_rgba(198,154,58,0.28)] transition-transform hover:-translate-y-0.5 disabled:opacity-60"
          >
            {busy ? t.loading : isBreak ? t.startNow : t.start}
          </button>
        </div>
      </div>
    );
  }

  if (phase === "finished") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-parchment px-4">
        <div className="w-full max-w-md rounded-3xl border border-ink/10 bg-white p-8 text-center shadow-lg">
          <h1 className="font-display text-xl font-bold text-parent">{t.finishedTitle}</h1>
          <p className="mt-4 text-sm text-ink/70">{t.finishedBody}</p>
        </div>
      </div>
    );
  }

  // ---------------- phase === "question" ----------------
  const q = questions[qIndex];
  if (!q) return <main className="p-10 text-center text-ink/50">{t.loading}</main>;

  const answered = questions.filter((x) => answers[x.question_number]).length;
  const unanswered = questions.length - answered;
  const passageText = passageFor(q);
  const current = answers[q.question_number] ?? "";

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <div className="sticky top-0 z-10 mb-4 rounded-2xl border border-ink/10 bg-white/95 px-5 py-3 shadow-sm backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-display font-bold text-ink">
              {currentSubject && TEST_SUBJECT_LABELS[currentSubject][lang]}
            </p>
            <p className="font-mono text-xs text-ink/50">
              {t.answeredOf(answered, questions.length)}
            </p>
          </div>
          <div
            className={`font-mono text-2xl font-bold tabular-nums ${
              (secondsLeft ?? 0) <= 300 ? "text-red-600" : "text-teacher"
            }`}
          >
            {formatTime(secondsLeft ?? 0)}
          </div>
        </div>

        {/* Сұрақтар торы: жауап берілгені толтырылған, бос сұрақ сұр */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {questions.map((item, i) => {
            const isAnswered = Boolean(answers[item.question_number]);
            const isCurrent = i === qIndex;
            return (
              <button
                key={item.id}
                onClick={() => setQIndex(i)}
                className={`focus-ring h-7 w-7 rounded-md font-mono text-xs font-semibold transition-colors ${
                  isCurrent
                    ? "bg-ink text-white ring-2 ring-gold ring-offset-1"
                    : isAnswered
                    ? "bg-parent text-white"
                    : "bg-ink/10 text-ink/50 hover:bg-ink/20"
                }`}
              >
                {item.question_number}
              </button>
            );
          })}
        </div>

        <p className="mt-2 font-mono text-[11px] text-ink/40">
          {saveState === "saving" && t.saving}
          {saveState === "saved" && t.saved}
          {saveState === "retrying" && <span className="text-red-600">{t.retrying}</span>}
        </p>
      </div>

      {passageText && (
        <div className="mb-4 whitespace-pre-line rounded-2xl border border-ink/10 bg-parchment p-5 text-sm leading-relaxed text-ink/80">
          <MathText text={passageText} />
        </div>
      )}

      <div className="rounded-2xl border border-ink/10 bg-white p-5">
        <p className="whitespace-pre-line font-medium text-ink">
          {q.question_number}. <MathText text={qText(q)} />
        </p>
        {(() => {
          // Суреттегі жазулар аударылмайды, сондықтан әр тілдің өз суреті бар.
          // Орысшасы қойылмаса — қазақшасын көрсетеміз (таза сызба жағдайы).
          const src = lang === "ru" ? q.image_url_ru || q.image_url : q.image_url;
          return src ? <img src={src} alt="" className="my-3 max-w-xs" /> : null;
        })()}

        {q.answer_format === "numeric" && (
          <input
            value={current}
            onChange={(e) => handleNumeric(q.question_number, e.target.value)}
            inputMode="numeric"
            placeholder={t.answerPlaceholder}
            className="focus-ring mt-3 w-40 rounded-xl border border-ink/15 px-3 py-2 text-sm"
          />
        )}

        {q.answer_format === "abcd" && (
          <div className="mt-3 flex flex-col gap-2">
            {(q.choices ?? []).map((c, i) => {
              const letter = LETTERS[i];
              const selected = current === letter;
              return (
                <button
                  key={i}
                  onClick={() => handleChoice(q.question_number, letter)}
                  className={`focus-ring rounded-xl border px-4 py-2.5 text-left text-sm transition-colors ${
                    selected
                      ? "border-gold bg-gold/10 font-semibold text-ink"
                      : "border-ink/15 hover:bg-parchment"
                  }`}
                >
                  <span className="font-mono">{letter})</span> <MathText text={choiceText(c)} />
                </button>
              );
            })}
          </div>
        )}

        {q.answer_format === "quantity" && (
          <>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-ink/10 p-3 text-sm">
                <p className="mb-1 font-mono text-xs font-semibold text-ink/40">{t.columnA}</p>
                <MathText text={(lang === "kk" ? q.column_a_kk : q.column_a_ru) ?? ""} />
              </div>
              <div className="rounded-xl border border-ink/10 p-3 text-sm">
                <p className="mb-1 font-mono text-xs font-semibold text-ink/40">{t.columnB}</p>
                <MathText text={(lang === "kk" ? q.column_b_kk : q.column_b_ru) ?? ""} />
              </div>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {(Object.keys(QUANTITY_CHOICE_LABELS) as ("A" | "B" | "C" | "D")[]).map((letter) => {
                const selected = current === letter;
                return (
                  <button
                    key={letter}
                    onClick={() => handleChoice(q.question_number, letter)}
                    className={`focus-ring rounded-xl border px-4 py-2.5 text-left text-sm transition-colors ${
                      selected
                        ? "border-gold bg-gold/10 font-semibold text-ink"
                        : "border-ink/15 hover:bg-parchment"
                    }`}
                  >
                    <span className="font-mono">{letter})</span>{" "}
                    {lang === "kk"
                      ? QUANTITY_CHOICE_LABELS[letter].kk
                      : QUANTITY_CHOICE_LABELS[letter].ru}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          onClick={() => setQIndex((i) => Math.max(0, i - 1))}
          disabled={qIndex === 0}
          className="focus-ring rounded-full border border-ink/15 px-5 py-2.5 text-sm font-semibold text-ink/70 disabled:opacity-40"
        >
          {t.prev}
        </button>
        <button
          onClick={() => setQIndex((i) => Math.min(questions.length - 1, i + 1))}
          disabled={qIndex >= questions.length - 1}
          className="focus-ring rounded-full border border-ink/15 px-5 py-2.5 text-sm font-semibold text-ink/70 disabled:opacity-40"
        >
          {t.next}
        </button>
      </div>

      <button
        onClick={() => (unanswered > 0 ? setConfirmFinish(true) : finishBlock())}
        disabled={busy}
        className="focus-ring mt-6 w-full rounded-full bg-ink px-5 py-3 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 disabled:opacity-60"
      >
        {busy ? t.sending : t.finishBlock}
      </button>

      {confirmFinish && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-ink/60 px-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-xl">
            <p className="font-display text-lg font-bold text-ink">{t.finishBlock}</p>
            <p className="mt-3 text-sm text-ink/70">{t.confirmBody(unanswered)}</p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setConfirmFinish(false)}
                className="focus-ring flex-1 rounded-full border border-ink/15 px-4 py-2.5 text-sm font-semibold text-ink/70"
              >
                {t.confirmBack}
              </button>
              <button
                onClick={finishBlock}
                disabled={busy}
                className="focus-ring flex-1 rounded-full bg-ink px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              >
                {t.confirmFinish}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
