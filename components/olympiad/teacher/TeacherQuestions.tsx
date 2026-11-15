"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { docxToContent, type DocxImage } from "@/lib/questions/docxReader";
import { parseOlympiadDocument, type OlympiadParseResult } from "@/lib/olympiad/parseDoc";
import MathText from "@/components/MathText";
import { Card, Msg, ProblemList, darkBtn, ghostBtn, primaryBtn, useL } from "@/components/olympiad/ui";

export type QuestionRow = {
  number: number;
  kind: "abcd" | "open";
  text_kk: string;
  text_ru: string;
  image_url: string | null;
  image_url_ru: string | null;
  choices: { kk: string; ru: string }[];
};

const BUCKET = "olympiad-images";
const LETTERS = ["A", "B", "C", "D"];
const BROWSER_IMAGES = ["png", "jpg", "jpeg", "gif", "webp", "bmp"];

export default function TeacherQuestions({
  questions,
  started,
  onSaved,
}: {
  questions: QuestionRow[];
  started: boolean;
  onSaved: () => void;
}) {
  const { L } = useL();
  const [parsed, setParsed] = useState<OlympiadParseResult | null>(null);
  const [images, setImages] = useState<Map<number, DocxImage>>(new Map());
  const [previewUrls, setPreviewUrls] = useState<Map<number, string>>(new Map());
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [viewLang, setViewLang] = useState<"kk" | "ru">("kk");
  const [showCurrent, setShowCurrent] = useState(false);

  async function handleFile(file: File) {
    setMsg(null);
    setParsed(null);
    setReading(true);
    try {
      const content = await docxToContent(file);
      const result = parseOlympiadDocument(content.lines);
      const urls = new Map<number, string>();
      content.images.forEach((img, idx) => urls.set(idx, URL.createObjectURL(img.blob)));
      // Браузер көрсете алмайтын суреттер (EMF/WMF) — оқушыда да көрінбейді.
      const used = new Set<number>();
      result.questions.forEach((q) => {
        if (q.image_index !== null) used.add(q.image_index);
        if (q.image_index_ru !== null) used.add(q.image_index_ru);
      });
      used.forEach((idx) => {
        const img = content.images.get(idx);
        if (img && !BROWSER_IMAGES.includes(img.ext)) {
          result.errors.push(
            L(
              `Сурет №${idx} .${img.ext} форматында — браузер оны көрсетпейді. Word-та суретті PNG/JPG етіп қайта қойыңыз.`,
              `Картинка №${idx} в формате .${img.ext} — браузер её не покажет. Вставьте её в Word заново как PNG/JPG.`
            )
          );
        }
      });
      setImages(content.images);
      setPreviewUrls(urls);
      setParsed(result);
    } catch (e: any) {
      setMsg({ kind: "err", text: L("Файлды оқу мүмкін болмады: ", "Не удалось прочитать файл: ") + (e?.message ?? e) });
    } finally {
      setReading(false);
    }
  }

  async function save() {
    if (!parsed || parsed.errors.length) return;
    setSaving(true);
    setMsg(null);
    try {
      const uploaded = new Map<number, string>();
      const upload = async (idx: number | null) => {
        if (idx === null || uploaded.has(idx)) return;
        const img = images.get(idx);
        if (!img) return;
        const path = `${crypto.randomUUID()}.${img.ext}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, img.blob, { contentType: img.blob.type });
        if (error) throw error;
        uploaded.set(idx, supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
      };
      for (const q of parsed.questions) {
        await upload(q.image_index);
        await upload(q.image_index_ru);
      }

      const oldPaths = questions
        .flatMap((q) => [q.image_url, q.image_url_ru])
        .filter((u): u is string => Boolean(u))
        .map((u) => u.split(`/${BUCKET}/`)[1])
        .filter(Boolean);

      const rows = parsed.questions.map((q) => ({
        number: q.number,
        kind: q.kind,
        text_kk: q.text_kk,
        text_ru: q.text_ru,
        image_url: q.image_index !== null ? uploaded.get(q.image_index) ?? null : null,
        image_url_ru: q.image_index_ru !== null ? uploaded.get(q.image_index_ru) ?? null : null,
        choices: q.kind === "abcd" ? q.choices : [],
      }));
      // Алдымен жаңасын жазамыз, сосын артық нөмірлерді өшіреміз —
      // жазу сәтсіз болса, ескі тапсырмалар жоғалмайды.
      const { error: upErr } = await supabase.from("olympiad_questions").upsert(rows, { onConflict: "number" });
      if (upErr) throw upErr;
      const maxNumber = Math.max(...rows.map((r) => r.number));
      const { error: delErr } = await supabase.from("olympiad_questions").delete().gt("number", maxNumber);
      if (delErr) throw delErr;

      if (oldPaths.length) await supabase.storage.from(BUCKET).remove(oldPaths);

      setParsed(null);
      setMsg({ kind: "ok", text: L(`Сақталды: ${rows.length} сұрақ.`, `Сохранено: ${rows.length} вопросов.`) });
      onSaved();
    } catch (e: any) {
      const text = String(e?.message ?? e);
      setMsg({
        kind: "err",
        text: text.includes("row-level security")
          ? L("Олимпиада басталды — тапсырмаларды ауыстыруға болмайды.", "Олимпиада началась — задания менять нельзя.")
          : L("Сақталмады: ", "Не сохранилось: ") + text,
      });
    } finally {
      setSaving(false);
    }
  }

  // Алдын ала қарау үшін жүктелген файлдағы сұрақтарды QuestionRow түріне келтіреміз.
  const previewRows: QuestionRow[] | null = parsed
    ? parsed.questions.map((q) => ({
        number: q.number,
        kind: q.kind,
        text_kk: q.text_kk,
        text_ru: q.text_ru,
        image_url: q.image_index !== null ? previewUrls.get(q.image_index) ?? null : null,
        image_url_ru: q.image_index_ru !== null ? previewUrls.get(q.image_index_ru) ?? null : null,
        choices: q.choices,
      }))
    : null;

  const abcd = questions.filter((q) => q.kind === "abcd").length;

  return (
    <Card id="questions" title={L("Тапсырмалар (Word, кілтсіз)", "Задания (Word, без ключа)")}>
      <p className="text-sm text-ink/70">
        {questions.length
          ? L(
              `Қазір жүктелген: ${questions.length} сұрақ (${abcd} — A/B/C/D, ${questions.length - abcd} — ашық жауап).`,
              `Сейчас загружено: ${questions.length} вопросов (${abcd} — A/B/C/D, ${questions.length - abcd} — открытый ответ).`
            )
          : L("Тапсырмалар әлі жүктелмеген.", "Задания ещё не загружены.")}
      </p>

      <details className="mt-3 rounded-xl bg-parchment p-4 text-xs text-ink/70">
        <summary className="cursor-pointer font-semibold text-ink">{L("Файл форматы", "Формат файла")}</summary>
        <pre className="mt-2 whitespace-pre-wrap font-mono leading-relaxed">{`[question1]
[kk] Сұрақ мәтіні ($формула$ болуы мүмкін)
[A] ...
[B] ...
[C] ...
[D] ...
[ru] Текст вопроса
[A] ...
[B] ...
[C] ...
[D] ...

[question2]
[kk] Ашық сұрақ — [A]–[D] жоқ
[ru] Открытый вопрос — без [A]–[D]`}</pre>
        <p className="mt-2">
          {L(
            "Кілт ([right_answer]) жазылмайды — ол олимпиададан кейін бөлек жүктеледі. Сурет [kk] ішінде — қазақшаға, [ru] ішінде — орысшаға.",
            "Ключ ([right_answer]) не пишется — он загружается отдельно после олимпиады. Картинка в [kk] — для казахского, в [ru] — для русского."
          )}
        </p>
      </details>

      {started ? (
        <div className="mt-4">
          <Msg kind="warn">
            {L("Олимпиада басталды — тапсырмаларды ауыстыруға болмайды.", "Олимпиада началась — задания менять нельзя.")}
          </Msg>
        </div>
      ) : (
        <label className={`${primaryBtn} mt-4 inline-block cursor-pointer`}>
          {reading ? L("Оқылуда...", "Читаем...") : L("Word файлын таңдау", "Выбрать файл Word")}
          <input
            type="file"
            accept=".docx"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
        </label>
      )}

      {msg && <div className="mt-4"><Msg kind={msg.kind}>{msg.text}</Msg></div>}

      {parsed && (
        <div className="mt-5 flex flex-col gap-3">
          <Msg kind={parsed.errors.length ? "err" : "ok"}>
            {L(`Файлда ${parsed.questions.length} сұрақ табылды.`, `В файле найдено ${parsed.questions.length} вопросов.`)}{" "}
            {parsed.errors.length
              ? L("Қателерді түзетіп, файлды қайта жүктеңіз.", "Исправьте ошибки и загрузите файл заново.")
              : L("Төменде оқушы көретіндей тексеріп, «Сақтау» басыңыз.", "Проверьте ниже, как увидит ученик, и нажмите «Сохранить».")}
          </Msg>
          <ProblemList title={L("Қателер", "Ошибки")} items={parsed.errors} kind="err" />
          <ProblemList title={L("Ескертулер", "Предупреждения")} items={parsed.warnings} kind="warn" />
          <div className="flex flex-wrap gap-3">
            <button onClick={save} disabled={saving || parsed.errors.length > 0} className={darkBtn}>
              {saving ? L("Сақталуда...", "Сохраняем...") : L("Сақтау (ескісін ауыстырады)", "Сохранить (заменит старые)")}
            </button>
            <button onClick={() => setParsed(null)} className={ghostBtn}>{L("Болдырмау", "Отмена")}</button>
          </div>
        </div>
      )}

      {(previewRows || (questions.length > 0 && showCurrent)) && (
        <div className="mt-5">
          <div className="mb-3 flex items-center gap-2 text-sm">
            <span className="text-ink/60">{L("Оқушы көретіні:", "Как увидит ученик:")}</span>
            {(["kk", "ru"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setViewLang(l)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${viewLang === l ? "bg-ink text-white" : "bg-ink/5 text-ink/60"}`}
              >
                {l === "kk" ? "ҚАЗ" : "РУС"}
              </button>
            ))}
          </div>
          <QuestionsPreview rows={previewRows ?? questions} lang={viewLang} />
        </div>
      )}

      {!previewRows && questions.length > 0 && (
        <button onClick={() => setShowCurrent((s) => !s)} className={`${ghostBtn} mt-4`}>
          {showCurrent ? L("Жасыру", "Скрыть") : L("Жүктелген тапсырмаларды қарау", "Посмотреть загруженные задания")}
        </button>
      )}
    </Card>
  );
}

function QuestionsPreview({ rows, lang }: { rows: QuestionRow[]; lang: "kk" | "ru" }) {
  return (
    <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto rounded-2xl bg-parchment p-3">
      {rows.map((q) => {
        const text = lang === "ru" && q.text_ru ? q.text_ru : q.text_kk;
        const img = lang === "ru" ? q.image_url_ru || q.image_url : q.image_url;
        return (
          <div key={q.number} className="rounded-2xl border border-ink/10 bg-white p-4">
            <p className="whitespace-pre-line text-sm font-medium text-ink">
              {q.number}. <MathText text={text} />
            </p>
            {img && <img src={img} alt="" className="my-3 max-w-xs" />}
            {q.kind === "abcd" ? (
              <div className="mt-2 flex flex-col gap-1 text-sm">
                {q.choices.map((c, i) => (
                  <div key={i} className="rounded-lg border border-ink/10 px-3 py-1.5">
                    <span className="font-mono">{LETTERS[i]})</span>{" "}
                    <MathText text={lang === "ru" && c.ru ? c.ru : c.kk} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs italic text-ink/50">{lang === "kk" ? "Ашық жауап" : "Открытый ответ"}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
