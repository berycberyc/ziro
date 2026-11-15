"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import MathText from "@/components/MathText";
import { formatAstana, formatDuration } from "@/lib/olympiad/time";
import { darkBtn, ghostBtn, primaryBtn } from "@/components/olympiad/ui";

/**
 * Олимпиада тесті (/olimpiad/test/[token]).
 *
 * Уақыт: сервер өз сағатын және аяқталу сәтін береді. Браузер телефон
 * сағатының қаншаға қате екенін есептеп, таймерді СЕРВЕР уақытымен жүргізеді.
 * Аяқталу сәтінде экран өзі жабылады — серверге ешқандай сұрау жіберілмейді.
 * Сервер өз жағынан аяқталудан кейінгі жауапты қабылдамайды.
 *
 * Әр жауап басқан сәтте серверге сақталады. Беттен шығу мен интернет
 * үзілуі жазылады және ұйымдастырушыға көрінеді.
 */

type Lang = "kk" | "ru";

type Question = { n: number; kind: "abcd" | "open"; text: string; image: string | null; choices: string[] };

type Phase = "loading" | "notfound" | "waiting" | "question" | "finished" | "timeup" | "missed";

type StateResp = {
  server_now: string;
  starts_at: string | null;
  ends_at: string | null;
  lang: Lang;
  student_name: string;
  question_count: number;
  started: boolean;
  finished: boolean;
  finish_reason: string | null;
  leave_count: number;
  max_leaves: number | null;
};

const LETTERS = ["A", "B", "C", "D"];

const TXT = {
  kk: {
    loading: "Жүктелуде...",
    notfound: "Кіру деректері табылмады. Қайта кіріп көріңіз.",
    back: "Кіру бетіне",
    waitTitle: "Олимпиада әлі басталған жоқ",
    startsAt: "Басталуы",
    endsAt: "Аяқталуы",
    untilStart: "Басталуына дейін",
    questions: (n: number) => `Сұрақ саны: ${n}`,
    rules: [
      "Аяқталу уақыты бәріне бірдей. Кеш кірсеңіз, уақытыңыз аз болады.",
      "Әр жауап басқан сәтте сақталады. Интернет үзілсе, қайта кіріп жалғастыра аласыз.",
      "Беттен шыққан сайын (басқа қосымша, басқа бет) жазылады және ұйымдастырушыға көрінеді.",
    ],
    maxLeaves: (n: number) => `Беттен ${n} рет шықсаңыз, тест өзі аяқталады.`,
    lateWarn: (left: string) => `Аяқталуына ${left} қалды.`,
    start: "Бастау",
    timeLeft: "Қалған уақыт",
    answered: (a: number, n: number) => `Жауап берілді: ${a} / ${n}`,
    saving: "Сақталуда...",
    saved: "Сақталды",
    retrying: "Интернет жоқ — жауап жіберілуде...",
    open: "Жауабыңызды жазыңыз",
    prev: "← Алдыңғы",
    next: "Келесі →",
    finish: "Аяқтау",
    confirmTitle: "Олимпиаданы аяқтайсыз ба?",
    confirmBody: (n: number) =>
      n > 0 ? `${n} сұраққа жауап берілмеген. Аяқтағаннан кейін қайта кіруге болмайды.` : "Аяқтағаннан кейін қайта кіруге болмайды.",
    confirmBack: "Оралу",
    confirmOk: "Аяқтау",
    leftWarn: (n: number) => `Сіз беттен ${n} рет шықтыңыз. Бұл ұйымдастырушыға көрінеді.`,
    finishedTitle: "Олимпиада аяқталды",
    finishedBody: "Жауаптарыңыз сақталды. Нәтиже жарияланғанда ата-анаңыз zirotest.com/olimpiad бетінде көреді.",
    leavesBody: "Беттен шығу шегіне жеткендіктен тест аяқталды. Берілген жауаптар сақталды.",
    timeupTitle: "Уақыт бітті",
    missedTitle: "Олимпиада аяқталды",
    missedBody: "Олимпиада уақыты өтіп кетті.",
  },
  ru: {
    loading: "Загрузка...",
    notfound: "Данные для входа не найдены. Попробуйте войти заново.",
    back: "На страницу входа",
    waitTitle: "Олимпиада ещё не началась",
    startsAt: "Начало",
    endsAt: "Окончание",
    untilStart: "До начала",
    questions: (n: number) => `Вопросов: ${n}`,
    rules: [
      "Время окончания у всех одинаковое. Если зайдёте позже, времени будет меньше.",
      "Каждый ответ сохраняется сразу при нажатии. Если пропал интернет, можно зайти снова и продолжить.",
      "Каждый уход со страницы (другое приложение, другая вкладка) записывается и виден организатору.",
    ],
    maxLeaves: (n: number) => `Если выйдете со страницы ${n} раз, тест завершится сам.`,
    lateWarn: (left: string) => `До окончания осталось ${left}.`,
    start: "Начать",
    timeLeft: "Осталось",
    answered: (a: number, n: number) => `Отвечено: ${a} / ${n}`,
    saving: "Сохраняем...",
    saved: "Сохранено",
    retrying: "Нет интернета — отправляем ответ...",
    open: "Напишите ответ",
    prev: "← Назад",
    next: "Далее →",
    finish: "Завершить",
    confirmTitle: "Завершить олимпиаду?",
    confirmBody: (n: number) =>
      n > 0 ? `Без ответа: ${n}. После завершения войти снова нельзя.` : "После завершения войти снова нельзя.",
    confirmBack: "Вернуться",
    confirmOk: "Завершить",
    leftWarn: (n: number) => `Вы выходили со страницы ${n} раз. Это видит организатор.`,
    finishedTitle: "Олимпиада завершена",
    finishedBody: "Ваши ответы сохранены. Когда результаты опубликуют, родитель увидит их на zirotest.com/olimpiad.",
    leavesBody: "Тест завершён: достигнут лимит уходов со страницы. Данные ответы сохранены.",
    timeupTitle: "Время вышло",
    missedTitle: "Олимпиада завершена",
    missedBody: "Время олимпиады прошло.",
  },
};

type QueueItem =
  | { type: "answer"; n: number; value: string }
  | { type: "event"; kind: "leave" | "return" | "offline"; n: number | null; seconds: number };

export default function OlympiadTestPage() {
  const params = useParams();
  const token = params.token as string;

  const [lang, setLang] = useState<Lang>("kk");
  const t = TXT[lang];
  const [phase, setPhase] = useState<Phase>("loading");
  const [info, setInfo] = useState<StateResp | null>(null);
  const [finishReason, setFinishReason] = useState<string | null>(null);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [qIndex, setQIndex] = useState(0);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "retrying">("idle");
  const [leaveCount, setLeaveCount] = useState(0);
  const [maxLeaves, setMaxLeaves] = useState<number | null>(null);
  const [showLeaveWarn, setShowLeaveWarn] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [busy, setBusy] = useState(false);

  // Сервер уақыты: serverNow ≈ Date.now() - offset.
  const offsetRef = useRef(0);
  const endsAtRef = useRef<number | null>(null);
  const startsAtRef = useRef<number | null>(null);
  const [tick, setTick] = useState(0);

  const phaseRef = useRef<Phase>("loading");
  phaseRef.current = phase;
  const currentQRef = useRef<number | null>(null);
  currentQRef.current = questions[qIndex]?.n ?? null;

  const serverNow = () => Date.now() - offsetRef.current;

  function noteServerTime(iso: string | undefined) {
    if (iso) offsetRef.current = Date.now() - new Date(iso).getTime();
  }

  // ------------------------------------------------------------------
  // Кезек: жауаптар мен оқиғалар ретімен, қайталап жіберіледі.
  // ------------------------------------------------------------------
  const queueRef = useRef<QueueItem[]>([]);
  const workingRef = useRef(false);

  const processQueue = useCallback(async () => {
    if (workingRef.current) return;
    workingRef.current = true;
    while (queueRef.current.length > 0) {
      const item = queueRef.current[0];
      if (item.type === "answer") setSaveState("saving");
      const res =
        item.type === "answer"
          ? await supabase.rpc("olympiad_save_answer", { p_token: token, p_number: item.n, p_value: item.value })
          : await supabase.rpc("olympiad_log_event", {
              p_token: token,
              p_kind: item.kind,
              p_number: item.n,
              p_seconds: item.seconds,
            });

      if (res.error) {
        const m = String(res.error.message ?? "");
        if (m.includes("deadline_passed") || m.includes("attempt_closed")) {
          queueRef.current = [];
          workingRef.current = false;
          setSaveState("idle");
          setPhase(m.includes("deadline_passed") ? "timeup" : "finished");
          return;
        }
        if (m.includes("bad_") || m.includes("not_found") || m.includes("not_started")) {
          queueRef.current.shift();
          continue;
        }
        // Желі қатесі — сәл күтіп, қайталаймыз.
        if (item.type === "answer") setSaveState("retrying");
        workingRef.current = false;
        setTimeout(() => processQueue(), 3000);
        return;
      }

      if (item.type === "event" && res.data) {
        const d = res.data as { finished: boolean; leave_count: number };
        setLeaveCount(d.leave_count);
        if (d.finished) {
          queueRef.current = [];
          workingRef.current = false;
          setFinishReason("leaves");
          setPhase("finished");
          return;
        }
      }
      queueRef.current.shift();
      if (item.type === "answer" && !queueRef.current.some((i) => i.type === "answer")) setSaveState("saved");
    }
    workingRef.current = false;
  }, [token]);

  const enqueue = useCallback(
    (item: QueueItem) => {
      if (item.type === "answer") {
        // Сол сұрақтың ескі жазбасы керек емес — соңғысы ғана.
        queueRef.current = queueRef.current.filter((i) => !(i.type === "answer" && i.n === item.n));
      }
      queueRef.current.push(item);
      processQueue();
    },
    [processQueue]
  );

  // ------------------------------------------------------------------
  // Жүктеу
  // ------------------------------------------------------------------
  const begin = useCallback(async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("olympiad_start", { p_token: token });
    setBusy(false);
    if (error) {
      if (String(error.message).includes("not_started")) setPhase("waiting");
      else setPhase("notfound");
      return;
    }
    const d = data as any;
    if (d.finished) {
      setFinishReason(d.finish_reason ?? null);
      setPhase(d.finish_reason === "time" ? "missed" : "finished");
      return;
    }
    noteServerTime(d.server_now);
    endsAtRef.current = new Date(d.ends_at).getTime();
    setQuestions(d.questions ?? []);
    setAnswers(d.answers ?? {});
    setLeaveCount(d.leave_count ?? 0);
    setMaxLeaves(d.max_leaves ?? null);
    setQIndex(0);
    setPhase("question");
  }, [token]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("olympiad_state", { p_token: token });
      if (error || !data) {
        setPhase("notfound");
        return;
      }
      const s = data as StateResp;
      setInfo(s);
      setLang(s.lang === "ru" ? "ru" : "kk");
      setMaxLeaves(s.max_leaves);
      noteServerTime(s.server_now);
      startsAtRef.current = s.starts_at ? new Date(s.starts_at).getTime() : null;
      endsAtRef.current = s.ends_at ? new Date(s.ends_at).getTime() : null;

      if (s.finished) {
        setFinishReason(s.finish_reason);
        setPhase("finished");
        return;
      }
      const now = Date.now() - offsetRef.current;
      if (endsAtRef.current !== null && now >= endsAtRef.current) {
        setPhase(s.started ? "timeup" : "missed");
        return;
      }
      // Бұрын бастаған болса (интернет үзілген, бет жабылған) — бірден жалғастырамыз.
      if (s.started && startsAtRef.current !== null && now >= startsAtRef.current) {
        begin();
        return;
      }
      setPhase("waiting");
    })();
  }, [token, begin]);

  // Секундтық таймер. Аяқталу сәтінде экран өзі жабылады.
  useEffect(() => {
    const id = setInterval(() => {
      setTick((x) => x + 1);
      if (phaseRef.current === "question" && endsAtRef.current !== null && serverNow() >= endsAtRef.current) {
        setPhase("timeup");
      }
      if (phaseRef.current === "waiting" && endsAtRef.current !== null && serverNow() >= endsAtRef.current) {
        setPhase("missed");
      }
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------------
  // Беттен шығу және интернет үзілуі
  // ------------------------------------------------------------------
  useEffect(() => {
    if (phase !== "question") return;
    let awaySince: number | null = null;
    let offlineSince: number | null = null;

    const isAway = () => document.hidden || !document.hasFocus();

    const update = () => {
      if (phaseRef.current !== "question") return;
      if (isAway()) {
        if (awaySince === null) {
          awaySince = Date.now();
          enqueue({ type: "event", kind: "leave", n: currentQRef.current, seconds: 0 });
        }
      } else if (awaySince !== null) {
        const secs = Math.round((Date.now() - awaySince) / 1000);
        awaySince = null;
        enqueue({ type: "event", kind: "return", n: currentQRef.current, seconds: secs });
        setShowLeaveWarn(true);
      }
    };
    const goOffline = () => {
      if (offlineSince === null) offlineSince = Date.now();
    };
    const goOnline = () => {
      if (offlineSince !== null) {
        const secs = Math.round((Date.now() - offlineSince) / 1000);
        offlineSince = null;
        enqueue({ type: "event", kind: "offline", n: currentQRef.current, seconds: secs });
      }
      processQueue();
    };

    document.addEventListener("visibilitychange", update);
    window.addEventListener("blur", update);
    window.addEventListener("focus", update);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("blur", update);
      window.removeEventListener("focus", update);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, [phase, enqueue, processQueue]);

  // ------------------------------------------------------------------
  // Жауап
  // ------------------------------------------------------------------
  const openTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  function choose(n: number, letter: string) {
    if (phase !== "question") return;
    setAnswers((a) => ({ ...a, [String(n)]: letter }));
    enqueue({ type: "answer", n, value: letter });
  }

  function typeOpen(n: number, value: string) {
    if (phase !== "question") return;
    setAnswers((a) => ({ ...a, [String(n)]: value }));
    clearTimeout(openTimers.current[n]);
    openTimers.current[n] = setTimeout(() => enqueue({ type: "answer", n, value }), 700);
  }

  function flushOpen(n: number) {
    if (openTimers.current[n]) {
      clearTimeout(openTimers.current[n]);
      delete openTimers.current[n];
      enqueue({ type: "answer", n, value: answers[String(n)] ?? "" });
    }
  }

  async function finish() {
    setBusy(true);
    Object.keys(openTimers.current).forEach((k) => flushOpen(Number(k)));
    // Кезектегі жауаптар жетсін.
    for (let i = 0; i < 20 && (queueRef.current.length > 0 || workingRef.current); i++) {
      await new Promise((r) => setTimeout(r, 300));
    }
    const { error } = await supabase.rpc("olympiad_finish", { p_token: token });
    setBusy(false);
    setConfirmFinish(false);
    if (!error) {
      setFinishReason("student");
      setPhase("finished");
    }
  }

  // ------------------------------------------------------------------
  // Экрандар
  // ------------------------------------------------------------------
  void tick;

  const shell = (children: React.ReactNode) => (
    <div className="flex min-h-screen items-center justify-center bg-parchment px-4 py-8">
      <div className="w-full max-w-md rounded-3xl border border-ink/10 bg-white p-8 text-center shadow-lg">{children}</div>
    </div>
  );

  if (phase === "loading") return shell(<p className="text-ink/50">{t.loading}</p>);

  if (phase === "notfound") {
    return shell(
      <>
        <p className="text-sm text-ink/70">{t.notfound}</p>
        <a href="/olimpiad/enter" className={`${ghostBtn} mt-5 inline-block`}>{t.back}</a>
      </>
    );
  }

  if (phase === "finished" || phase === "timeup" || phase === "missed") {
    const title = phase === "timeup" ? t.timeupTitle : phase === "missed" ? t.missedTitle : t.finishedTitle;
    const body = phase === "missed" ? t.missedBody : finishReason === "leaves" ? t.leavesBody : t.finishedBody;
    return shell(
      <>
        <h1 className="font-display text-xl font-bold text-mint">{title}</h1>
        <p className="mt-4 text-sm text-ink/70">{body}</p>
      </>
    );
  }

  if (phase === "waiting") {
    const now = serverNow();
    const startsAt = startsAtRef.current;
    const endsAt = endsAtRef.current;
    const canStart = startsAt !== null && now >= startsAt && endsAt !== null && now < endsAt;
    const leftToEnd = endsAt !== null ? Math.max(0, (endsAt - now) / 1000) : 0;
    return shell(
      <>
        <p className="text-sm text-ink/60">{info?.student_name}</p>
        <h1 className="mt-1 font-display text-xl font-bold text-ink">{canStart ? t.start : t.waitTitle}</h1>
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl bg-parchment p-3">
            <p className="text-xs text-ink/50">{t.startsAt}</p>
            <p className="font-semibold text-ink">{formatAstana(info?.starts_at, lang)}</p>
          </div>
          <div className="rounded-xl bg-parchment p-3">
            <p className="text-xs text-ink/50">{t.endsAt}</p>
            <p className="font-semibold text-ink">{formatAstana(info?.ends_at, lang)}</p>
          </div>
        </div>
        {!canStart && startsAt !== null && (
          <>
            <p className="mt-5 text-xs text-ink/50">{t.untilStart}</p>
            <p className="font-mono text-4xl font-bold tabular-nums text-teacher">{formatDuration((startsAt - now) / 1000)}</p>
          </>
        )}
        {info && <p className="mt-4 text-sm text-ink/60">{t.questions(info.question_count)}</p>}
        <ul className="mt-4 list-disc space-y-1 pl-5 text-left text-xs text-ink/60">
          {t.rules.map((r) => (
            <li key={r}>{r}</li>
          ))}
          {maxLeaves && <li className="font-semibold text-clay">{t.maxLeaves(maxLeaves)}</li>}
        </ul>
        {canStart && (
          <>
            <p className="mt-4 text-sm font-semibold text-teacher">{t.lateWarn(formatDuration(leftToEnd))}</p>
            <button onClick={begin} disabled={busy} className={`${primaryBtn} mt-4 w-full py-3`}>
              {busy ? t.loading : t.start}
            </button>
          </>
        )}
      </>
    );
  }

  // ---------------- phase === "question" ----------------
  const q = questions[qIndex];
  if (!q) return shell(<p className="text-ink/50">{t.loading}</p>);

  const secondsLeft = endsAtRef.current !== null ? (endsAtRef.current - serverNow()) / 1000 : 0;
  const answeredCount = questions.filter((x) => (answers[String(x.n)] ?? "").trim()).length;
  const current = answers[String(q.n)] ?? "";

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <div className="sticky top-0 z-10 mb-4 rounded-2xl border border-ink/10 bg-white/95 px-5 py-3 shadow-sm backdrop-blur">
        <div className="flex items-center justify-between">
          <p className="font-mono text-xs text-ink/50">{t.answered(answeredCount, questions.length)}</p>
          <div className={`font-mono text-2xl font-bold tabular-nums ${secondsLeft <= 300 ? "text-red-600" : "text-teacher"}`}>
            {formatDuration(secondsLeft)}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {questions.map((item, i) => {
            const isAnswered = Boolean((answers[String(item.n)] ?? "").trim());
            return (
              <button
                key={item.n}
                onClick={() => {
                  flushOpen(q.n);
                  setQIndex(i);
                }}
                className={`focus-ring h-7 w-7 rounded-md font-mono text-xs font-semibold ${
                  i === qIndex
                    ? "bg-ink text-white ring-2 ring-gold ring-offset-1"
                    : isAnswered
                    ? "bg-parent text-white"
                    : "bg-ink/10 text-ink/50 hover:bg-ink/20"
                }`}
              >
                {i + 1}
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

      {showLeaveWarn && leaveCount > 0 && (
        <div className="mb-4 rounded-2xl border border-clay/30 bg-clay/10 px-4 py-3 text-sm text-clay">
          <p>{t.leftWarn(leaveCount)}</p>
          {maxLeaves && <p className="mt-1 font-semibold">{t.maxLeaves(maxLeaves)}</p>}
          <button onClick={() => setShowLeaveWarn(false)} className="mt-2 text-xs underline">OK</button>
        </div>
      )}

      <div className="rounded-2xl border border-ink/10 bg-white p-5">
        <p className="whitespace-pre-line font-medium text-ink">
          {qIndex + 1}. <MathText text={q.text} />
        </p>
        {q.image && <img src={q.image} alt="" className="my-3 max-w-full sm:max-w-xs" />}

        {q.kind === "abcd" ? (
          <div className="mt-3 flex flex-col gap-2">
            {q.choices.map((c, i) => {
              const letter = LETTERS[i];
              const selected = current === letter;
              return (
                <button
                  key={i}
                  onClick={() => choose(q.n, letter)}
                  className={`focus-ring rounded-xl border px-4 py-2.5 text-left text-sm transition-colors ${
                    selected ? "border-gold bg-gold/10 font-semibold text-ink" : "border-ink/15 hover:bg-parchment"
                  }`}
                >
                  <span className="font-mono">{letter})</span> <MathText text={c} />
                </button>
              );
            })}
          </div>
        ) : (
          <input
            value={current}
            onChange={(e) => typeOpen(q.n, e.target.value)}
            onBlur={() => flushOpen(q.n)}
            maxLength={200}
            placeholder={t.open}
            className="focus-ring mt-3 w-full rounded-xl border border-ink/15 px-3 py-2 text-sm"
          />
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          onClick={() => {
            flushOpen(q.n);
            setQIndex((i) => Math.max(0, i - 1));
          }}
          disabled={qIndex === 0}
          className={ghostBtn}
        >
          {t.prev}
        </button>
        <button
          onClick={() => {
            flushOpen(q.n);
            setQIndex((i) => Math.min(questions.length - 1, i + 1));
          }}
          disabled={qIndex >= questions.length - 1}
          className={ghostBtn}
        >
          {t.next}
        </button>
      </div>

      <button onClick={() => setConfirmFinish(true)} disabled={busy} className={`${darkBtn} mt-6 w-full py-3`}>
        {t.finish}
      </button>

      {confirmFinish && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-ink/60 px-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-xl">
            <p className="font-display text-lg font-bold text-ink">{t.confirmTitle}</p>
            <p className="mt-3 text-sm text-ink/70">{t.confirmBody(questions.length - answeredCount)}</p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setConfirmFinish(false)} className={`${ghostBtn} flex-1`}>{t.confirmBack}</button>
              <button onClick={finish} disabled={busy} className={`${darkBtn} flex-1`}>
                {busy ? t.saving : t.confirmOk}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
