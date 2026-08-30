"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { fetchAll } from "@/lib/fetchAll";
import { docxToContent, type DocxImage } from "@/lib/questions/docxReader";
import {
  parseQuestionsDocument,
  type ParseResult,
} from "@/lib/questions/parseQuestionsDoc";
import {
  SUBJECT_LABELS,
  SUBJECT_MAX_COUNT,
  QUANTITY_SUBJECTS,
  NUMERIC_SUBJECTS,
  PASSAGE_SUBJECTS,
  type SubjectKey,
} from "@/lib/questions/subjects";
import MathText from "@/components/MathText";
import { buildCleanDocx } from "@/lib/print/buildCleanDocx";
import { removeStoredFile, removeStoredFiles } from "@/lib/storageCleanup";
import { TEST_SUBJECT_LABELS } from "@/lib/i18n-test";
import { MONOLINGUAL_SUBJECTS } from "@/lib/questions/subjects";

/**
 * Word файлынан сұрақтарды жүктеу.
 *
 * Бір пробникке 24 файл, 1000-нан астам сұрақ — қолмен теру мүмкін емес.
 * Файл алдымен ТОЛЫҚ тексеріледі, әкімші көзімен көреді, содан кейін ғана
 * базаға жазылады. Жартылай жазу болмайды: не бәрі, не ештеңе.
 */

export default function ImportQuestionsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const sessionId = params.id as string;
  const subject = (searchParams.get("subject") ?? "math") as SubjectKey;

  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [fileName, setFileName] = useState("");
  // Тазалау сол файлдың өзінен жасалады, сондықтан оны ұстап тұрамыз.
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  // Қай әрекет жүріп жатқанын білдіреді: "" — бос, әйтпесе түйменің аты.
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [topicIds, setTopicIds] = useState<Map<string, string>>(new Map());
  const [missingTopics, setMissingTopics] = useState<string[]>([]);
  const [existing, setExisting] = useState<number | null>(null);
  const [images, setImages] = useState<Map<number, DocxImage>>(new Map());
  // Басып шығаруға дайын файлдар: осы пән мен нұсқа бойынша қай тілде
  // PDF жүктелген.
  const [printVariant, setPrintVariant] = useState<number>(1);
  const [printFiles, setPrintFiles] = useState<Record<string, { url: string; pages: number | null }>>({});
  const [sessionTitle, setSessionTitle] = useState("");
  const mono = MONOLINGUAL_SUBJECTS.includes(subject);
  const langs: ("kk" | "ru")[] = mono ? ["kk"] : ["kk", "ru"];

  // Пән бойынша бар тақырыптар — файлдағы атаулар солармен салыстырылады.
  useEffect(() => {
    supabase
      .from("test_sessions")
      .select("title_kk")
      .eq("id", sessionId)
      .single()
      .then(({ data }) => setSessionTitle((data as any)?.title_kk ?? ""));
  }, [sessionId]);

  const loadPrintFiles = useCallback(
    async (variant: number) => {
      const { data } = await supabase
        .from("print_files")
        .select("lang, file_url, page_count")
        .eq("test_session_id", sessionId)
        .eq("subject", subject)
        .eq("variant_number", variant);
      const map: Record<string, { url: string; pages: number | null }> = {};
      (data ?? []).forEach((f: any) => {
        map[f.lang] = { url: f.file_url, pages: f.page_count };
      });
      setPrintFiles(map);
    },
    [sessionId, subject]
  );

  // Экранға кіргенде бірінші нұсқаның PDF күйін көрсетеміз.
  useEffect(() => {
    loadPrintFiles(printVariant);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadPrintFiles]);

  useEffect(() => {
    supabase
      .from("topics")
      .select("id, name_kk")
      .eq("subject", subject)
      .then(({ data }) => {
        const map = new Map<string, string>();
        (data ?? []).forEach((t: any) => map.set(t.name_kk.trim().toLowerCase(), t.id));
        setTopicIds(map);
      });
  }, [subject]);

  async function handleFile(file: File) {
    setBusy("read");
    setError("");
    setMessage("");
    setParsed(null);
    setMissingTopics([]);
    setExisting(null);
    setFileName(file.name);
    setSourceFile(file);

    try {
      const { lines, images: found } = await docxToContent(file);
      setImages(found);
      const result = parseQuestionsDocument(lines, subject);
      setParsed(result);

      // Тақырыптарды тексеру: базада жоқ атау болса, жүктеуге болмайды.
      const missing = new Set<string>();
      result.questions.forEach((q) => {
        if (q.topic && !topicIds.has(q.topic.trim().toLowerCase())) missing.add(q.topic);
      });
      setMissingTopics([...missing]);

      if (result.variant) {
        const { count } = await supabase
          .from("questions")
          .select("id", { count: "exact", head: true })
          .eq("session_id", sessionId)
          .eq("subject", subject)
          .eq("variant_number", result.variant);
        setExisting(count ?? 0);
      }
    } catch (err: any) {
      console.error(err);
      setError("Файлды оқу мүмкін болмады: " + (err?.message ?? "белгісіз қате"));
    } finally {
      setBusy("");
    }
  }

  async function handleSave() {
    if (!parsed || !parsed.variant) return;
    setBusy("save");
    setError("");
    setMessage("");

    try {
      const variant = parsed.variant;

      // Ескі сұрақтардың суреттерін есте сақтаймыз: жаңа сұрақтар сәтті
      // жазылғаннан кейін қоймадан өшіреміз. Бұрын олар қоймада мәңгі
      // қалып, әр қайта жүктеу сайын жаңа жинақ қосыла беретін.
      const { data: oldQuestions } = await supabase
        .from("questions")
        .select("image_url, image_url_ru")
        .eq("session_id", sessionId)
        .eq("subject", subject)
        .eq("variant_number", variant);
      const oldImageUrls = (oldQuestions ?? []).flatMap((q: any) => [
        q.image_url,
        q.image_url_ru,
      ]);

      // Осы нұсқаның ескі сұрақтарын алдымен өшіреміз — араласып кетпеуі үшін.
      await supabase
        .from("questions")
        .delete()
        .eq("session_id", sessionId)
        .eq("subject", subject)
        .eq("variant_number", variant);
      await supabase
        .from("passages")
        .delete()
        .eq("session_id", sessionId)
        .eq("subject", subject)
        .eq("variant_number", variant);

      // Мәтіндер (болса) — сұрақтар оларға сілтейді.
      const passageIds = new Map<number, string>();
      if (parsed.passages.length > 0) {
        const { data: inserted, error: pErr } = await supabase
          .from("passages")
          .insert(
            parsed.passages.map((p) => ({
              session_id: sessionId,
              subject,
              variant_number: variant,
              passage_text_kk: p.text,
              passage_text_ru: p.text,
              order_number: p.index,
            }))
          )
          .select("id, order_number");
        if (pErr) throw pErr;
        (inserted ?? []).forEach((p: any) => passageIds.set(p.order_number, p.id));
      }

      // Суреттерді қоймаға жүктеп, әр сұраққа сілтеме дайындаймыз.
      // Бір сұрақта екі сурет болуы мүмкін: [kk] блогындағысы қазақшаға,
      // [ru] блогындағысы орысшаға. Әр суретті бір рет қана жүктейміз.
      const imageUrls = new Map<number, string>();
      const uploadImage = async (idx: number | null, qNumber: number) => {
        if (idx === null || imageUrls.has(idx)) return;
        const img = images.get(idx);
        if (!img) return;
        const path = `${sessionId}/${subject}/${variant}/${qNumber}-${idx}-${Date.now()}.${img.ext}`;
        const { error: upErr } = await supabase.storage
          .from("question-images")
          .upload(path, img.blob, { contentType: img.blob.type });
        if (upErr) throw upErr;
        const { data } = supabase.storage.from("question-images").getPublicUrl(path);
        imageUrls.set(idx, data.publicUrl);
      };
      for (const q of parsed.questions) {
        await uploadImage(q.image_index, q.question_number);
        await uploadImage(q.image_index_ru, q.question_number);
      }

      const isQuantity = QUANTITY_SUBJECTS.includes(subject);
      const isNumeric = NUMERIC_SUBJECTS.includes(subject);

      const rows = parsed.questions.map((q) => ({
        session_id: sessionId,
        subject,
        variant_number: variant,
        question_number: q.question_number,
        topic_id: q.topic ? topicIds.get(q.topic.trim().toLowerCase()) ?? null : null,
        passage_id: q.passage_index !== null ? passageIds.get(q.passage_index) ?? null : null,
        text_kk: q.text_kk,
        text_ru: q.text_ru || q.text_kk,
        image_url: q.image_index !== null ? imageUrls.get(q.image_index) ?? null : null,
        // Орысша суреті болмаса — бос қалады, тест экраны сонда қазақшасын
        // көрсетеді. Сол себепті бірдей суретті екі рет қоюдың қажеті жоқ.
        image_url_ru: q.image_index_ru !== null ? imageUrls.get(q.image_index_ru) ?? null : null,
        answer_format: isQuantity ? "quantity" : isNumeric ? "numeric" : "abcd",
        choices: isQuantity || isNumeric ? null : q.choices,
        correct_answer: isQuantity || isNumeric ? q.correct_answer : null,
        column_a_kk: q.column_a_kk || null,
        column_a_ru: q.column_a_ru || q.column_a_kk || null,
        column_b_kk: q.column_b_kk || null,
        column_b_ru: q.column_b_ru || q.column_b_kk || null,
      }));

      for (let i = 0; i < rows.length; i += 200) {
        const { error: qErr } = await supabase.from("questions").insert(rows.slice(i, i + 200));
        if (qErr) throw qErr;
      }

      // Жаңа сұрақтар сәтті жазылды — енді ескі суреттерді қоймадан
      // өшіруге болады. Дәл осы кезекте: жазу сәтсіз болса, ескі
      // суреттер орнында қалады.
      await removeStoredFiles("question-images", oldImageUrls);

      setMessage(
        `${SUBJECT_LABELS[subject]}, ${variant}-нұсқа: ${rows.length} сұрақ жүктелді.` +
          (parsed.passages.length > 0 ? ` Мәтін саны: ${parsed.passages.length}.` : "")
      );
      setPrintVariant(variant);
      await loadPrintFiles(variant);

      // Бірден таза көшірмелерді береміз — екінші рет басудың қажеті жоқ.
      if (sourceFile) {
        try {
          await makeCleanFiles(sourceFile, variant);
        } catch (err) {
          console.error("Clean docx failed:", err);
          setError("Сұрақтар сақталды, бірақ таза Word жасалмады.");
        }
      }

      setParsed(null);
      setFileName("");
    } catch (err: any) {
      console.error(err);
      setError("Сақтау кезінде қате: " + (err?.message ?? "белгісіз"));
    } finally {
      setBusy("");
    }
  }

  /**
   * Жүктелген файлдың өзінен таза көшірмелер жасау.
   * Формулалар Word-тың нағыз теңдеулері күйінде қалады — сондықтан
   * құжатты нөлден құрастырмай, көшірмесін тазалаймыз.
   */
  async function makeCleanFiles(file: File, variant: number) {
    for (const lang of langs) {
      // Колонтитулдағы жазу: пән аты сол тілде + нұсқа нөмірі.
      const title =
        lang === "kk"
          ? `${TEST_SUBJECT_LABELS[subject].kk} — ${variant}-нұсқа`
          : `${TEST_SUBJECT_LABELS[subject].ru} — вариант ${variant}`;
      const blob = await buildCleanDocx(file, lang, title);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${subject}-nuska${variant}-${lang}.docx`;
      a.click();
      URL.revokeObjectURL(a.href);
      // Браузер бірнеше файлды қатар жүктегенде біреуін тастап кетуі мүмкін.
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  /** Түзетілген PDF-ті кері жүктеу. */
  async function handleUploadPdf(lang: "kk" | "ru", file: File) {
    if (!printVariant) return;
    setBusy("pdf-" + lang);
    setError("");
    try {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        setError("Тек PDF файл жүктеуге болады.");
        return;
      }

      const path = `${sessionId}/${subject}/${printVariant}-${lang}-${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage
        .from("print-files")
        .upload(path, file, { contentType: "application/pdf" });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("print-files").getPublicUrl(path);

      // Ауыстырудан бұрынғы PDF-тің сілтемесін есте сақтаймыз.
      const previousUrl = printFiles[lang]?.url ?? null;

      const { error: dbErr } = await supabase.from("print_files").upsert(
        {
          test_session_id: sessionId,
          subject,
          variant_number: printVariant,
          lang,
          file_url: pub.publicUrl,
          uploaded_at: new Date().toISOString(),
        },
        { onConflict: "test_session_id,subject,variant_number,lang" }
      );
      if (dbErr) throw dbErr;

      // Жаңасы дерекқорға жазылды — ескісін қоймадан өшіреміз.
      if (previousUrl && previousUrl !== pub.publicUrl) {
        await removeStoredFile("print-files", previousUrl);
      }

      await loadPrintFiles(printVariant);
      setMessage("PDF жүктелді.");
    } catch (err: any) {
      console.error(err);
      setError("PDF жүктелмеді: " + (err?.message ?? "белгісіз"));
    } finally {
      setBusy("");
    }
  }

  const blocked =
    !parsed ||
    parsed.errors.length > 0 ||
    missingTopics.length > 0 ||
    !parsed.variant;

  return (
    <div>
      <Link
        href={`/admin/sessions/${sessionId}/questions`}
        className="text-sm text-ink/50 hover:underline"
      >
        ← Сұрақтарға оралу
      </Link>
      <h1 className="font-display text-2xl font-bold text-admin">
        Word файлынан жүктеу — {SUBJECT_LABELS[subject]}
      </h1>
      <p className="mt-1 text-sm text-ink/60">
        Бір файл — бір нұсқа. Файл алдымен тексеріледі, қате болса жазылмайды.
        Күтілетін сұрақ саны: {SUBJECT_MAX_COUNT[subject]}.
      </p>

      <label className="focus-ring mt-5 inline-block cursor-pointer rounded-full bg-admin px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90">
        {busy === "read" ? "Оқылуда..." : "Word файлын таңдау"}
        <input
          type="file"
          accept=".docx"
          disabled={busy !== ""}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) handleFile(f);
          }}
        />
      </label>
      {fileName && <span className="ml-3 font-mono text-xs text-ink/50">{fileName}</span>}

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {message && <p className="mt-4 text-sm text-parent">{message}</p>}

      {/* Басып шығару файлдары — әрқашан көрінеді, Word жүктелмесе де.
          Түзетілген PDF-ті кейін, басқа күні әкелуге болады. */}
      <section className="mt-6 rounded-2xl border border-teacher/30 bg-teacher-soft/30 p-5">
        <h2 className="font-display text-lg font-bold text-ink">Басып шығару файлдары</h2>
        <p className="mt-1 text-sm text-ink/60">
          Word жүктегенде таза көшірмелер өздігінен жүктеліп алынады. Беттердің бөлінуін
          түзетіп, PDF ретінде сақтап, осында қайта салыңыз.
          {mono && " Тілдер бір тілде — файл біреу."}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {[1, 2, 3, 4].map((v) => (
            <button
              key={v}
              onClick={() => {
                setPrintVariant(v);
                loadPrintFiles(v);
              }}
              className={`focus-ring rounded-full px-4 py-1.5 text-sm font-semibold ${
                printVariant === v ? "bg-admin text-white" : "bg-admin-soft text-admin"
              }`}
            >
              Нұсқа {v}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {langs.map((lang) => {
            const ready = printFiles[lang];
            return (
              <div
                key={lang}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink/10 bg-white px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {mono ? "Файл" : lang === "kk" ? "Қазақша" : "Орысша"}
                  </p>
                  <p
                    className={`font-mono text-xs ${ready ? "text-parent" : "text-ink/50"}`}
                  >
                    {ready ? "PDF дайын ✓" : "PDF жүктелмеген"}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <label className="focus-ring cursor-pointer rounded-full bg-teacher px-4 py-2 text-xs font-semibold text-white hover:opacity-90">
                    {busy === "pdf-" + lang ? "Жүктелуде..." : ready ? "PDF ауыстыру" : "PDF салу"}
                    <input
                      type="file"
                      accept=".pdf"
                      disabled={busy !== ""}
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) handleUploadPdf(lang, f);
                      }}
                    />
                  </label>

                  {ready && (
                    <a
                      href={ready.url}
                      target="_blank"
                      rel="noreferrer"
                      className="focus-ring rounded-full px-3 py-2 text-xs font-semibold text-ink/50 hover:text-ink"
                    >
                      Қарау ↗
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {parsed && (
        <>
          <section className="mt-6 rounded-2xl border border-ink/10 bg-white p-5">
            <h2 className="font-display text-lg font-bold text-ink">Файлдан оқылғаны</h2>
            <div className="mt-2 grid gap-1 text-sm text-ink/70 sm:grid-cols-2">
              <p>Сессия атауы: {parsed.sessionTitle || "—"}</p>
              <p>Тест түрі: {parsed.testType || "—"}</p>
              <p>Пән: {parsed.subjectLabel || "—"}</p>
              <p>
                Нұсқа:{" "}
                <b className={parsed.variant ? "" : "text-red-600"}>{parsed.variant ?? "жоқ"}</b>
              </p>
              <p>Сұрақ саны: {parsed.questions.length}</p>
              <p>
                Суреті бар сұрақ:{" "}
                {parsed.questions.filter((q) => q.image_index !== null || q.image_index_ru !== null).length}
                {parsed.questions.some((q) => q.image_index_ru !== null) && (
                  <> (оның {parsed.questions.filter((q) => q.image_index_ru !== null).length}-інде
                  орысша суреті бөлек)</>
                )}
              </p>
              {PASSAGE_SUBJECTS.includes(subject) && <p>Мәтін саны: {parsed.passages.length}</p>}
            </div>

            {existing !== null && existing > 0 && (
              <p className="mt-3 rounded-xl bg-gold/10 px-4 py-2 text-sm text-gold-deep">
                Бұл нұсқада қазір {existing} сұрақ бар. Жүктесеңіз, олар өшіп, орнына жаңасы
                жазылады.
              </p>
            )}
          </section>

          {parsed.errors.length > 0 && (
            <section className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-5">
              <h2 className="font-display text-lg font-bold text-red-700">
                Қате: {parsed.errors.length}
              </h2>
              <p className="mt-1 text-sm text-red-700/80">
                Бәрі түзетілмейінше файл жүктелмейді.
              </p>
              <ul className="mt-3 max-h-64 list-disc overflow-auto pl-5 text-sm text-red-700">
                {parsed.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </section>
          )}

          {missingTopics.length > 0 && (
            <section className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-5">
              <h2 className="font-display text-lg font-bold text-red-700">
                Базада жоқ тақырыптар: {missingTopics.length}
              </h2>
              <p className="mt-1 text-sm text-red-700/80">
                «Тақырыптар» бөлімінен қосыңыз немесе файлдағы жазылуын түзетіңіз. Емле
                қатесі жаңа тақырып жасап жібермеуі үшін өздігінен қосылмайды.
              </p>
              <ul className="mt-3 list-disc pl-5 text-sm text-red-700">
                {missingTopics.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </section>
          )}

          {parsed.warnings.length > 0 && (
            <section className="mt-4 rounded-2xl border border-gold/30 bg-gold/5 p-5">
              <h2 className="font-display text-sm font-bold text-gold-deep">Ескертулер</h2>
              <ul className="mt-2 list-disc pl-5 text-sm text-ink/60">
                {parsed.warnings.slice(0, 10).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </section>
          )}

          {/* Алғашқы үш сұрақ — формулалар дұрыс оқылғанын көзбен тексеру үшін */}
          {parsed.questions.length > 0 && (
            <section className="mt-4 rounded-2xl border border-ink/10 bg-white p-5">
              <h2 className="font-display text-lg font-bold text-ink">Алдын ала қарау</h2>
              <p className="mt-1 text-sm text-ink/60">
                Формулалар дұрыс шыққанын тексеріңіз.
              </p>
              <div className="mt-3 flex flex-col gap-4">
                {parsed.questions.slice(0, 3).map((q) => (
                  <div key={q.question_number} className="rounded-xl border border-ink/10 p-4">
                    <p className="font-mono text-xs text-ink/40">
                      {q.question_number}-сұрақ · {q.topic ?? "тақырыпсыз"}
                    </p>
                    {QUANTITY_SUBJECTS.includes(subject) ? (
                      <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-lg border border-ink/10 p-2">
                          <span className="font-mono text-xs text-ink/40">А</span>{" "}
                          <MathText text={q.column_a_kk} />
                        </div>
                        <div className="rounded-lg border border-ink/10 p-2">
                          <span className="font-mono text-xs text-ink/40">В</span>{" "}
                          <MathText text={q.column_b_kk} />
                        </div>
                      </div>
                    ) : (
                      <p className="mt-1 whitespace-pre-line text-sm text-ink">
                        <MathText text={q.text_kk} />
                      </p>
                    )}
                    {q.image_index !== null && images.get(q.image_index) && (
                      <img
                        src={URL.createObjectURL(images.get(q.image_index)!.blob)}
                        alt=""
                        className="mt-2 max-h-40 rounded-lg border border-ink/10"
                      />
                    )}
                    {q.choices.length > 0 && (
                      <ul className="mt-2 flex flex-col gap-1 text-sm">
                        {q.choices.map((c, i) => (
                          <li key={i} className={c?.correct ? "font-semibold text-parent" : ""}>
                            <span className="font-mono">{"ABCD"[i]})</span>{" "}
                            <MathText text={c?.text_kk ?? ""} />
                          </li>
                        ))}
                      </ul>
                    )}
                    {q.correct_answer && q.choices.length === 0 && (
                      <p className="mt-2 text-sm">
                        Дұрыс жауап: <b className="text-parent">{q.correct_answer}</b>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <button
            onClick={handleSave}
            disabled={blocked || busy !== ""}
            className="focus-ring mt-5 w-full rounded-full bg-parent px-6 py-3 text-sm font-bold text-white disabled:opacity-40"
          >
            {busy === "save"
              ? "Сақталуда..."
              : blocked
              ? "Қате түзетілмейінше сақтауға болмайды"
              : `${parsed.questions.length} сұрақты базаға жазу`}
          </button>
        </>
      )}
    </div>
  );
}
