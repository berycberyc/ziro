"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { downloadKeyTemplate, parseKeyFile, scoreAnswers, type KeyRow } from "@/lib/olympiad/key";
import {
  downloadResultsWorkbook,
  parseResultsFile,
  RESULT_WORD,
  type ExportRow,
  type ResultsParse,
} from "@/lib/olympiad/excel";
import { formatAstana } from "@/lib/olympiad/time";
import { Card, Msg, ProblemList, darkBtn, ghostBtn, primaryBtn, useL } from "@/components/olympiad/ui";
import type { QuestionRow } from "@/components/olympiad/teacher/TeacherQuestions";

type Overview = { registered: number; started: number; finished: number; questions: number; key: number };

export default function TeacherResults({
  questions,
  ended,
  publishedAt,
  onPublished,
}: {
  questions: QuestionRow[];
  ended: boolean;
  publishedAt: string | null;
  onPublished: () => void;
}) {
  const { L, lang } = useL();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [key, setKey] = useState<KeyRow[]>([]);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [keyErrors, setKeyErrors] = useState<string[]>([]);
  const [pendingKey, setPendingKey] = useState<KeyRow[] | null>(null);

  const [results, setResults] = useState<ResultsParse | null>(null);

  const kinds = questions.map((q) => ({ number: q.number, kind: q.kind }));

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("olympiad_teacher_overview");
    if (data) setOverview(data as Overview);
    const { data: k } = await supabase.from("olympiad_key").select("*").order("number");
    setKey(((k ?? []) as any[]).map((r) => ({ number: r.number, answers: r.answers ?? [], points: Number(r.points), voided: r.voided })));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function fetchRows(): Promise<ExportRow[]> {
    const { data, error } = await supabase.rpc("olympiad_teacher_export");
    if (error) throw error;
    return (data ?? []) as ExportRow[];
  }

  async function download() {
    setBusy("download");
    setMsg(null);
    try {
      const rows = await fetchRows();
      const kindMap = new Map(kinds.map((k) => [k.number, k.kind]));
      const scores = key.length
        ? new Map(rows.map((r) => [r.code, scoreAnswers(r.answers ?? {}, key, kindMap)]))
        : null;
      await downloadResultsWorkbook({
        rows,
        questionNumbers: questions.map((q) => q.number),
        scores,
        ended,
        keepPassed: Boolean(publishedAt),
      });
    } catch (e: any) {
      setMsg({ kind: "err", text: L("Жүктеу мүмкін болмады: ", "Не удалось скачать: ") + (e?.message ?? e) });
    } finally {
      setBusy("");
    }
  }

  async function handleKeyFile(file: File) {
    setMsg(null);
    setPendingKey(null);
    setKeyErrors([]);
    const res = await parseKeyFile(file, kinds);
    setKeyErrors(res.errors);
    if (!res.errors.length) setPendingKey(res.rows);
  }

  async function saveKey() {
    if (!pendingKey) return;
    setBusy("key");
    setMsg(null);
    try {
      const rows = pendingKey.map((r) => ({ number: r.number, answers: r.answers, points: r.points, voided: r.voided }));
      const { error: upErr } = await supabase.from("olympiad_key").upsert(rows, { onConflict: "number" });
      if (upErr) throw upErr;
      const nums = rows.map((r) => r.number);
      const { error: delErr } = await supabase.from("olympiad_key").delete().not("number", "in", `(${nums.join(",")})`);
      if (delErr) throw delErr;
      setPendingKey(null);
      setMsg({ kind: "ok", text: L("Кілт сақталды. Енді кестеде балл бағаны бар.", "Ключ сохранён. Теперь в таблице есть столбец с баллом.") });
      await load();
    } catch (e: any) {
      setMsg({ kind: "err", text: L("Кілт сақталмады: ", "Ключ не сохранился: ") + (e?.message ?? e) });
    } finally {
      setBusy("");
    }
  }

  async function handleResultsFile(file: File) {
    setMsg(null);
    setResults(null);
    setBusy("check");
    try {
      const rows = await fetchRows();
      setResults(await parseResultsFile(file, rows.map((r) => r.code)));
    } catch (e: any) {
      setMsg({ kind: "err", text: L("Файлды оқу мүмкін болмады: ", "Не удалось прочитать файл: ") + (e?.message ?? e) });
    } finally {
      setBusy("");
    }
  }

  async function publish() {
    if (!results || results.errors.length) return;
    setBusy("publish");
    setMsg(null);
    const { data, error } = await supabase.rpc("olympiad_publish", { p_passed_codes: results.passedCodes });
    setBusy("");
    if (error) {
      setMsg({ kind: "err", text: L("Жарияланбады: ", "Не опубликовано: ") + error.message });
      return;
    }
    setResults(null);
    setMsg({
      kind: "ok",
      text: L(
        `Жарияланды. «${RESULT_WORD}»: ${data} оқушы. Ата-аналар енді нәтижені көреді.`,
        `Опубликовано. «${RESULT_WORD}»: ${data} учеников. Родители теперь видят результат.`
      ),
    });
    onPublished();
  }

  return (
    <Card id="results" title={L("Қатысушылар және нәтижелер", "Участники и результаты")}>
      <div className="flex flex-wrap items-center gap-3">
        {overview && (
          <div className="grid flex-1 grid-cols-3 gap-2 text-center">
            <Stat label={L("Тіркелді", "Зарегистрировано")} value={overview.registered} />
            <Stat label={L("Кірді", "Вошли")} value={overview.started} />
            <Stat label={L("Аяқтады", "Завершили")} value={overview.finished} />
          </div>
        )}
        <button onClick={load} className={ghostBtn}>{L("Жаңарту", "Обновить")}</button>
      </div>

      <div className="mt-5 flex flex-col gap-2">
        <p className="text-sm font-semibold text-ink">{L("1. Кесте (Excel)", "1. Таблица (Excel)")}</p>
        <p className="text-xs text-ink/60">
          {L(
            "Тізім, әр оқушының жауаптары, беттен шығу саны. Кілт жүктелсе — балл да. «Нәтиже» бағанына тек «Өтті» жазуға болады.",
            "Список, ответы каждого ученика, число уходов со страницы. Если загружен ключ — и балл. В столбец «Нәтиже» можно написать только «Өтті»."
          )}
        </p>
        <div>
          <button onClick={download} disabled={busy === "download"} className={primaryBtn}>
            {busy === "download" ? L("Дайындалуда...", "Готовим...") : L("Кестені жүктеп алу", "Скачать таблицу")}
          </button>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-2">
        <p className="text-sm font-semibold text-ink">{L("2. Кілт", "2. Ключ")}</p>
        {!ended ? (
          <Msg kind="warn">
            {L(
              "Кілт олимпиада аяқталғаннан кейін ғана жүктеледі — олимпиада кезінде ол серверде болмайды.",
              "Ключ загружается только после окончания олимпиады — во время олимпиады его на сервере нет."
            )}
          </Msg>
        ) : (
          <>
            <p className="text-xs text-ink/60">
              {key.length
                ? L(`Кілт жүктелген: ${key.length} сұрақ.`, `Ключ загружен: ${key.length} вопросов.`)
                : L("Кілт әлі жүктелмеген.", "Ключ ещё не загружен.")}{" "}
              {L(
                "Формат: №, Жауап (A–D немесе ашық жауап; бірнешеуі «;» арқылы; X — тапсырма алынды, бәріне балл), Балл (бос — 1).",
                "Формат: №, Ответ (A–D или открытый ответ; несколько через «;»; X — задача снята, балл всем), Балл (пусто — 1)."
              )}
            </p>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => downloadKeyTemplate(kinds)} className={ghostBtn}>
                {L("Кілт үлгісі", "Шаблон ключа")}
              </button>
              <label className={`${primaryBtn} cursor-pointer`}>
                {L("Кілтті жүктеу", "Загрузить ключ")}
                <input type="file" accept=".xlsx,.xls" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleKeyFile(f); e.target.value = ""; }} />
              </label>
            </div>
            <ProblemList title={L("Кілттегі қателер", "Ошибки в ключе")} items={keyErrors} kind="err" />
            {pendingKey && (
              <Msg kind="ok">
                {L(`Кілт дұрыс: ${pendingKey.length} сұрақ.`, `Ключ в порядке: ${pendingKey.length} вопросов.`)}{" "}
                <button onClick={saveKey} disabled={busy === "key"} className={`${darkBtn} ml-2 mt-2`}>
                  {busy === "key" ? L("Сақталуда...", "Сохраняем...") : L("Сақтау", "Сохранить")}
                </button>
              </Msg>
            )}
          </>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-2">
        <p className="text-sm font-semibold text-ink">{L("3. Нәтижені жариялау", "3. Публикация результатов")}</p>
        {publishedAt && (
          <Msg kind="ok">
            {L("Жарияланған: ", "Опубликовано: ")}
            {formatAstana(publishedAt, lang)}.{" "}
            {L("Қайта жүктеп, қайта жариялауға болады.", "Можно загрузить и опубликовать заново.")}
          </Msg>
        )}
        {!ended ? (
          <Msg kind="warn">{L("Олимпиада аяқталғаннан кейін ашылады.", "Откроется после окончания олимпиады.")}</Msg>
        ) : (
          <>
            <p className="text-xs text-ink/60">
              {L(
                `Кестенің «Нәтиже» бағанына өткендерге «${RESULT_WORD}» деп жазып, файлды осында жүктеңіз. Бос — өтпеді. Басқа кез келген жазу — қате.`,
                `Напишите «${RESULT_WORD}» в столбце «Нәтиже» у прошедших и загрузите файл сюда. Пусто — не прошёл. Любое другое — ошибка.`
              )}
            </p>
            <div>
              <label className={`${primaryBtn} inline-block cursor-pointer`}>
                {busy === "check" ? L("Тексерілуде...", "Проверяем...") : L("Толтырылған кестені жүктеу", "Загрузить заполненную таблицу")}
                <input type="file" accept=".xlsx,.xls" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleResultsFile(f); e.target.value = ""; }} />
              </label>
            </div>
            {results && (
              <>
                <ProblemList
                  title={L("Қателер — жариялау жабық", "Ошибки — публикация закрыта")}
                  items={results.errors}
                  kind="err"
                />
                {!results.errors.length && (
                  <Msg kind="ok">
                    <p>
                      «{RESULT_WORD}»: <b>{results.passedCodes.length}</b> · {L("Өтпеді", "Не прошли")}:{" "}
                      <b>{results.notPassed + results.missing}</b>
                      {results.missing > 0 &&
                        L(` (оның ішінде ${results.missing} оқушы файлда жоқ)`, ` (из них ${results.missing} учеников нет в файле)`)}
                    </p>
                    <button onClick={publish} disabled={busy === "publish"} className={`${darkBtn} mt-3`}>
                      {busy === "publish" ? L("Жариялануда...", "Публикуем...") : L("Жариялау", "Опубликовать")}
                    </button>
                  </Msg>
                )}
              </>
            )}
          </>
        )}
      </div>

      {msg && <div className="mt-4"><Msg kind={msg.kind}>{msg.text}</Msg></div>}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-parchment px-2 py-2">
      <p className="font-mono text-xl font-bold text-ink">{value}</p>
      <p className="text-[11px] text-ink/60">{label}</p>
    </div>
  );
}
