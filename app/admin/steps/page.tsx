"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { fetchAll, fetchAllByIds } from "@/lib/fetchAll";
import {
  SUBJECT_LABELS,
  TEST_TYPE_SUBJECTS,
  MONOLINGUAL_SUBJECTS,
  type SubjectKey,
} from "@/lib/questions/subjects";

/**
 * Қадамдар — бір сессияны басынан аяғына дейін өткізу тізімі.
 *
 * Екі түрлі белгі бар:
 *   — өздігінен: база көріп тұрған нәрсе (сұрақ жүктелді ме, PDF салынды ма,
 *     төлем расталды ма, нәтиже жарияланды ма). Мұндай қадамды қолмен
 *     белгілеу мүмкін емес әрі керегі жоқ;
 *   — қолмен: база білмейтін нәрсе (басып шығардым, партаға тараттым,
 *     бланкілерді жинадым). Ол session_steps кестесінде сақталады.
 *
 * Қадам атауы — сілтеме: басқан жерде дәл сол жұмыс істейтін экран ашылады.
 */

// ---------------------------------------------------------------------------
// Қадамдар тізімі
// ---------------------------------------------------------------------------

type AutoKey =
  | "session_fields"
  | "questions"
  | "print_pdf"
  | "payments"
  | "seating"
  | "online_collected"
  | "zipgrade_imported"
  | "published"
  | "has_results";

type Step = {
  key: string;
  group: 1 | 2 | 3;
  title: string;
  hint: string;
  href: (sessionId: string) => string;
  /** Болса — белгі базадан алынады, қолмен қойылмайды. */
  auto?: AutoKey;
};

const STEPS: Step[] = [
  // ----------------------------- 1. Дайындық -----------------------------
  {
    key: "session_fields",
    group: 1,
    title: "Сессия деректерін толтыру",
    hint: "Дата, время начала, адрес, цена",
    href: (id) => `/admin/sessions/${id}`,
    auto: "session_fields",
  },
  {
    key: "topics",
    group: 1,
    title: "Тақырыптарды тексеру",
    hint: "Если в вариантах есть новая тема — завести её заранее, иначе файл не загрузится",
    href: () => "/admin/topics",
  },
  {
    key: "questions",
    group: 1,
    title: "Сұрақтарды жүктеу",
    hint: "Word с метками, один файл — один предмет и один вариант",
    href: (id) => `/admin/sessions/${id}/questions`,
    auto: "questions",
  },
  {
    key: "clean_copies",
    group: 1,
    title: "Таза көшірмелерді түзету",
    hint: "Скачать две чистые копии, поправить разбивку по страницам, сохранить в PDF",
    href: (id) => `/admin/sessions/${id}/questions`,
  },
  {
    key: "print_pdf",
    group: 1,
    title: "PDF-терді кері салу",
    hint: "Тот же экран, что и загрузка Word — блок «Басып шығару файлдары»",
    href: (id) => `/admin/sessions/${id}/questions`,
    auto: "print_pdf",
  },
  {
    key: "payments",
    group: 1,
    title: "Төлемдерді растау",
    hint: "Неподтверждённые брони не попадут в печать",
    href: () => "/admin/bookings",
    auto: "payments",
  },
  {
    key: "seating",
    group: 1,
    title: "Нұсқа, аудитория, орын қою",
    hint: "Плюс язык и ZipGrade ID у ученика — без них комплект не соберётся",
    href: (id) => `/admin/sessions/${id}`,
    auto: "seating",
  },
  {
    key: "zipgrade_sheets",
    group: 1,
    title: "ZipGrade бланкілерін дайындау",
    hint: "Бланк на нужное число вопросов, ключи вариантов заведены",
    href: () => "/admin/zipgrade",
  },

  // ---------------------------- 2. Тест күні -----------------------------
  {
    key: "print_rooms",
    group: 2,
    title: "Аудитория бойынша басып шығару",
    hint: "Собрать PDF по аудиториям и распечатать",
    href: (id) => `/admin/sessions/${id}/print`,
  },
  {
    key: "handout",
    group: 2,
    title: "Партаға тарату",
    hint: "Соседи получают разные варианты. Бланки ZipGrade раздать вместе с работой",
    href: (id) => `/admin/sessions/${id}/print`,
  },
  {
    key: "monitoring",
    group: 2,
    title: "Тест барысын қадағалау",
    hint: "Для онлайн: кто вошёл, кто молчит больше 10 минут",
    href: () => "/admin/monitoring",
  },
  {
    key: "collect",
    group: 2,
    title: "Жұмыс пен бланкілерді жинау",
    hint: "Пересчитать по списку участников — пропавший бланк после теста не восстановить",
    href: (id) => `/admin/sessions/${id}`,
  },

  // --------------------------- 3. Тестен кейін ---------------------------
  {
    key: "collect_online",
    group: 3,
    title: "Онлайн жауаптарды жинау",
    hint: "1-қадам на экране расчёта. Нажимать после конца теста",
    href: () => "/admin/scoring",
    auto: "online_collected",
  },
  {
    key: "zipgrade_import",
    group: 3,
    title: "ZipGrade файлдарын жүктеу",
    hint: "Сначала отсканировать бланки в ZipGrade, затем экспорт по каждому предмету",
    href: () => "/admin/scoring",
    auto: "zipgrade_imported",
  },
  {
    key: "raw_check",
    group: 3,
    title: "Шикі жауаптарды тексеру",
    hint: "Выгрузить и просмотреть: пустые бланки, двойные отметки, расхождения ключа",
    href: () => "/admin/scoring",
  },
  {
    key: "compute",
    group: 3,
    title: "Нәтижелерді есептеу",
    hint: "Считать только после загрузки всех офлайн-файлов — веса НИШ зависят от всей группы",
    href: () => "/admin/scoring",
  },
  {
    key: "preview",
    group: 3,
    title: "Жариялау алдында қарау",
    hint: "Увидеть ровно то, что увидит родитель",
    href: (id) => `/admin/sessions/${id}/results-preview`,
  },
  {
    key: "publish",
    group: 3,
    title: "Нәтижелерді жариялау",
    hint: "Место и баллы фиксируются в этот момент",
    href: () => "/admin/scoring",
    auto: "published",
  },
  {
    key: "has_results",
    group: 3,
    title: "«Нәтиже дайын» белгісін қосу",
    hint: "Пока выключено, родитель результат не откроет",
    href: (id) => `/admin/sessions/${id}`,
    auto: "has_results",
  },
  {
    key: "cleanup",
    group: 3,
    title: "Басып шығару PDF-терін өшіру",
    hint: "Хранилище общее с фотографиями и чеками — после пробника файлы не нужны",
    href: (id) => `/admin/sessions/${id}/print`,
  },
];

const GROUPS: Record<1 | 2 | 3, string> = {
  1: "1. Дайындық · Подготовка",
  2: "2. Тест күні · В день теста",
  3: "3. Тестен кейін · После теста",
};

// ---------------------------------------------------------------------------
// Автоматты белгілердің нәтижесі
// ---------------------------------------------------------------------------

type AutoState = {
  done: boolean;
  /** «12 / 16» деген жазу. Болмаса — жазылмайды. */
  counter?: string;
  /** Не істеу керегі (қадам әлі бітпесе). */
  note?: string;
};

type Session = {
  id: string;
  title_kk: string;
  title_ru: string;
  session_date: string;
  start_time: string | null;
  address: string | null;
  price: number | null;
  has_results: boolean;
  results_published_at: string | null;
};

export default function AdminStepsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const [auto, setAuto] = useState<Partial<Record<AutoKey, AutoState>>>({});
  const [manual, setManual] = useState<Record<string, boolean>>({});

  // --------------------------------------------------------------- сессиялар
  useEffect(() => {
    async function load() {
      const { data, error: err } = await supabase
        .from("test_sessions")
        .select(
          "id, title_kk, title_ru, session_date, start_time, address, price, has_results, results_published_at"
        )
        .order("session_date", { ascending: false });
      if (err) {
        console.error("sessions load error:", err);
        setError("Сессиялар жүктелмеді: " + err.message);
      }
      setSessions((data as Session[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  // ------------------------------------------------------- таңдалған сессия
  const loadSession = useCallback(async (sessionId: string) => {
    setBusy("load");
    setError("");
    try {
      const session = sessions.find((s) => s.id === sessionId);

      // --- қандай пәндер керек: сессияға тіркелген тест түрлері бойынша ---
      const { data: stt } = await supabase
        .from("session_test_types")
        .select("test_type_id")
        .eq("test_session_id", sessionId);

      let typeIds = (stt ?? []).map((r: any) => r.test_type_id as string);

      // Егер сессияға тест түрі тікелей тіркелмесе — брондаулардан аламыз.
      const bookings = await fetchAll<any>((from, to) =>
        supabase
          .from("registrations")
          .select(
            "id, format, payment_status, classroom, seat, test_variant, student_id, test_type_id"
          )
          .eq("test_session_id", sessionId)
          .order("id")
          .range(from, to)
      );
      if (typeIds.length === 0) {
        typeIds = [...new Set(bookings.map((b) => b.test_type_id as string))];
      }

      const typeRows =
        typeIds.length > 0
          ? await fetchAllByIds<any>(typeIds, (chunk) =>
              supabase.from("test_types").select("id, code").in("id", chunk)
            )
          : [];
      const codeById = new Map<string, string>(typeRows.map((t) => [t.id, t.code]));

      const subjects = [
        ...new Set(
          typeRows.flatMap((t) => (TEST_TYPE_SUBJECTS[t.code] ?? []) as SubjectKey[])
        ),
      ];

      // --- оқушылар (тіл және ZipGrade ID басып шығаруға керек) ---
      const studentIds = [...new Set(bookings.map((b) => b.student_id as string))];
      const studentRows =
        studentIds.length > 0
          ? await fetchAllByIds<any>(studentIds, (chunk) =>
              supabase.from("students").select("id, full_name, zipgrade_id, language").in("id", chunk)
            )
          : [];
      const studentById = new Map<string, any>(studentRows.map((s) => [s.id, s]));

      // --- сұрақтар ---
      const questionRows = await fetchAll<any>((from, to) =>
        supabase
          .from("questions")
          .select("subject, variant_number")
          .eq("session_id", sessionId)
          .order("id")
          .range(from, to)
      );
      const questionGroups = new Set(
        questionRows.map((q) => `${q.subject}|${q.variant_number}`)
      );

      // --- басып шығару PDF-тері ---
      const printRows = await fetchAll<any>((from, to) =>
        supabase
          .from("print_files")
          .select("subject, variant_number, lang")
          .eq("test_session_id", sessionId)
          .order("id")
          .range(from, to)
      );
      const printHave = new Set(
        printRows.map((p) => `${p.subject}|${p.variant_number}|${p.lang}`)
      );

      // --- жауап парақтары ---
      const sheetRows = await fetchAll<any>((from, to) =>
        supabase
          .from("answer_sheets")
          .select("subject, source")
          .eq("test_session_id", sessionId)
          .order("id")
          .range(from, to)
      );

      // --- жарияланған нәтиже ---
      const { count: publishedCount } = await supabase
        .from("published_results")
        .select("id", { count: "exact", head: true })
        .eq("test_session_id", sessionId);

      // --- қолмен қойылған белгілер ---
      const { data: marks } = await supabase
        .from("session_steps")
        .select("step_key, done")
        .eq("test_session_id", sessionId);
      const marksMap: Record<string, boolean> = {};
      (marks ?? []).forEach((m: any) => {
        marksMap[m.step_key] = m.done;
      });
      setManual(marksMap);

      // ================================================================
      // Есептеулер
      // ================================================================
      const next: Partial<Record<AutoKey, AutoState>> = {};

      // 1. Сессия деректері
      const gaps: string[] = [];
      if (!session?.session_date) gaps.push("дата");
      if (!session?.start_time) gaps.push("время начала");
      if (!session?.address) gaps.push("адрес");
      if (!session?.price) gaps.push("цена");
      next.session_fields = {
        done: gaps.length === 0,
        note: gaps.length > 0 ? "не заполнено: " + gaps.join(", ") : undefined,
      };

      // 2. Сұрақтар: әр пән × 4 нұсқа
      const needQuestions = subjects.length * 4;
      const haveQuestions = subjects.reduce(
        (acc, subj) =>
          acc + [1, 2, 3, 4].filter((v) => questionGroups.has(`${subj}|${v}`)).length,
        0
      );
      const missingQuestions = subjects.flatMap((subj) =>
        [1, 2, 3, 4]
          .filter((v) => !questionGroups.has(`${subj}|${v}`))
          .map((v) => `${SUBJECT_LABELS[subj].split(" /")[0]} ${v}`)
      );
      next.questions = {
        done: needQuestions > 0 && haveQuestions >= needQuestions,
        counter: needQuestions > 0 ? `${haveQuestions} / ${needQuestions}` : undefined,
        note:
          missingQuestions.length > 0
            ? "нет: " + missingQuestions.slice(0, 6).join(", ") +
              (missingQuestions.length > 6 ? " и ещё " + (missingQuestions.length - 6) : "")
            : undefined,
      };

      // 3. Басып шығару PDF-тері: пән × 4 нұсқа × тіл
      //    Тілдер бір тілде — файл біреу, ол 'kk' болып сақталады.
      const needPrint: string[] = [];
      subjects.forEach((subj) => {
        const langs = MONOLINGUAL_SUBJECTS.includes(subj) ? ["kk"] : ["kk", "ru"];
        [1, 2, 3, 4].forEach((v) => {
          langs.forEach((lang) => needPrint.push(`${subj}|${v}|${lang}`));
        });
      });
      const havePrint = needPrint.filter((k) => printHave.has(k)).length;
      next.print_pdf = {
        done: needPrint.length > 0 && havePrint >= needPrint.length,
        counter: needPrint.length > 0 ? `${havePrint} / ${needPrint.length}` : undefined,
      };

      // 4. Төлем
      const paid = bookings.filter((b) => b.payment_status === "paid").length;
      next.payments = {
        done: bookings.length > 0 && paid === bookings.length,
        counter: bookings.length > 0 ? `${paid} / ${bookings.length}` : undefined,
        note:
          bookings.length === 0
            ? "ещё никто не записался"
            : paid < bookings.length
            ? `${bookings.length - paid} ждут подтверждения`
            : undefined,
      };

      // 5. Нұсқа, аудитория, орын, тіл, ZipGrade ID — тек офлайн, төленген
      const offlinePaid = bookings.filter(
        (b) => b.format === "offline" && b.payment_status === "paid"
      );
      const incomplete = offlinePaid.filter((b) => {
        const st = studentById.get(b.student_id);
        const variant = parseInt(String(b.test_variant ?? "").replace(/\D/g, ""), 10);
        return !variant || !b.classroom || !b.seat || !st?.language || !st?.zipgrade_id;
      });
      next.seating = {
        done: offlinePaid.length > 0 && incomplete.length === 0,
        counter:
          offlinePaid.length > 0
            ? `${offlinePaid.length - incomplete.length} / ${offlinePaid.length}`
            : undefined,
        note:
          offlinePaid.length === 0
            ? "офлайн-участников пока нет"
            : incomplete.length > 0
            ? `${incomplete.length} учеников без варианта, места или ZipGrade ID`
            : undefined,
      };

      // 6. Онлайн жауаптар жиналды ма
      const onlineSheets = sheetRows.filter((s) => s.source !== "zipgrade").length;
      const hasOnline = bookings.some((b) => b.format === "online");
      next.online_collected = {
        done: !hasOnline || onlineSheets > 0,
        counter: onlineSheets > 0 ? `${onlineSheets} парақ` : undefined,
        note: !hasOnline ? "в этой сессии онлайна нет — шаг не нужен" : undefined,
      };

      // 7. ZipGrade файлдары: әр пән бойынша кем дегенде бір парақ
      const zipBySubject = new Set(
        sheetRows.filter((s) => s.source === "zipgrade").map((s) => s.subject)
      );
      const needZip = offlinePaid.length > 0 ? subjects : [];
      const haveZip = needZip.filter((s) => zipBySubject.has(s)).length;
      next.zipgrade_imported = {
        done: needZip.length === 0 || haveZip >= needZip.length,
        counter: needZip.length > 0 ? `${haveZip} / ${needZip.length} пән` : undefined,
        note:
          needZip.length === 0
            ? "офлайн-участников нет — шаг не нужен"
            : haveZip < needZip.length
            ? "нет: " +
              needZip
                .filter((s) => !zipBySubject.has(s))
                .map((s) => SUBJECT_LABELS[s].split(" /")[0])
                .join(", ")
            : undefined,
      };

      // 8. Жарияланды ма
      next.published = {
        done: (publishedCount ?? 0) > 0,
        counter: publishedCount ? `${publishedCount} оқушы` : undefined,
        note: session?.results_published_at
          ? "опубликовано " + new Date(session.results_published_at).toLocaleString("ru-RU")
          : undefined,
      };

      // 9. «Нәтиже дайын» белгісі
      next.has_results = {
        done: !!session?.has_results,
        note: session?.has_results ? undefined : "родители результат пока не видят",
      };

      setAuto(next);
    } catch (err: any) {
      console.error(err);
      setError("Жүктеу кезінде қате: " + (err?.message ?? "белгісіз"));
    } finally {
      setBusy("");
    }
  }, [sessions]);

  useEffect(() => {
    if (selectedId) loadSession(selectedId);
  }, [selectedId, loadSession]);

  // ------------------------------------------------------------ белгі қою
  async function toggle(stepKey: string, value: boolean) {
    if (!selectedId) return;
    setManual((m) => ({ ...m, [stepKey]: value })); // бірден көрінсін
    const { error: err } = await supabase.from("session_steps").upsert(
      {
        test_session_id: selectedId,
        step_key: stepKey,
        done: value,
        done_at: value ? new Date().toISOString() : null,
      },
      { onConflict: "test_session_id,step_key" }
    );
    if (err) {
      console.error(err);
      setError("Белгі сақталмады: " + err.message);
      setManual((m) => ({ ...m, [stepKey]: !value })); // кері қайтарамыз
    }
  }

  // --------------------------------------------------------------- көрініс
  function stateOf(step: Step): { done: boolean; counter?: string; note?: string } {
    if (step.auto) {
      const a = auto[step.auto];
      return { done: !!a?.done, counter: a?.counter, note: a?.note };
    }
    return { done: !!manual[step.key] };
  }

  const totalDone = selectedId ? STEPS.filter((s) => stateOf(s).done).length : 0;

  if (loading) return <p className="mt-6 text-sm text-ink/50">Жүктелуде...</p>;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-admin">Қадамдар</h1>
      <p className="mt-1 text-sm text-ink/60">
        Бір сессияның басынан аяғына дейінгі реті. Қадам атауын бассаңыз — керекті экран ашылады.
      </p>

      <select
        value={selectedId}
        onChange={(e) => {
          setSelectedId(e.target.value);
          setAuto({});
          setManual({});
          setError("");
        }}
        className="focus-ring mt-5 w-full max-w-xl rounded-xl border border-ink/15 px-3 py-2 text-sm"
      >
        <option value="">— Пробный тест таңдаңыз —</option>
        {sessions.map((s) => (
          <option key={s.id} value={s.id}>
            {s.title_kk} / {s.title_ru} — {s.session_date}
          </option>
        ))}
      </select>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {selectedId && busy === "load" && (
        <p className="mt-6 text-sm text-ink/50">Тексерілуде...</p>
      )}

      {selectedId && busy !== "load" && (
        <>
          {/* Жалпы дайындық */}
          <div className="mt-5 flex flex-wrap items-center gap-4 rounded-2xl border border-ink/10 bg-white px-5 py-4">
            <div className="h-2.5 w-56 overflow-hidden rounded-full bg-ink/10">
              <div
                className="h-full rounded-full bg-admin transition-all"
                style={{ width: `${Math.round((totalDone / STEPS.length) * 100)}%` }}
              />
            </div>
            <span className="font-mono text-sm font-bold text-ink">
              {totalDone} / {STEPS.length}
            </span>
            <button
              onClick={() => loadSession(selectedId)}
              className="focus-ring ml-auto rounded-full border border-ink/15 px-4 py-1.5 text-xs font-semibold text-ink/60 hover:bg-ink/5"
            >
              Қайта тексеру
            </button>
          </div>

          {([1, 2, 3] as const).map((g) => {
            const rows = STEPS.filter((s) => s.group === g);
            const doneInGroup = rows.filter((s) => stateOf(s).done).length;
            return (
              <section key={g} className="mt-6">
                <div className="flex flex-wrap items-baseline gap-3">
                  <h2 className="font-display text-lg font-bold text-ink">{GROUPS[g]}</h2>
                  <span className="font-mono text-xs text-ink/50">
                    {doneInGroup} / {rows.length}
                  </span>
                  {doneInGroup === rows.length && (
                    <span className="rounded-full bg-parent/10 px-2.5 py-0.5 text-xs font-bold text-parent">
                      дайын
                    </span>
                  )}
                </div>

                <div className="mt-3 overflow-hidden rounded-2xl border border-ink/10 bg-white">
                  {rows.map((step, i) => {
                    const st = stateOf(step);
                    return (
                      <div
                        key={step.key}
                        className={`flex flex-wrap items-center gap-4 px-5 py-3.5 ${
                          i > 0 ? "border-t border-ink/5" : ""
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                            st.done
                              ? "bg-parent text-white"
                              : "border-2 border-ink/20 bg-white text-transparent"
                          }`}
                        >
                          ✓
                        </span>

                        <div className="min-w-0 flex-1">
                          <Link
                            href={step.href(selectedId)}
                            className="focus-ring text-sm font-semibold text-ink underline decoration-ink/20 underline-offset-4 hover:text-admin hover:decoration-admin"
                          >
                            {step.title}
                          </Link>
                          <p className="mt-0.5 text-xs text-ink/50">{step.hint}</p>
                          {st.note && !st.done && (
                            <p className="mt-0.5 text-xs font-medium text-red-600">{st.note}</p>
                          )}
                          {st.note && st.done && (
                            <p className="mt-0.5 text-xs text-ink/40">{st.note}</p>
                          )}
                        </div>

                        {st.counter && (
                          <span
                            className={`shrink-0 font-mono text-xs font-bold ${
                              st.done ? "text-parent" : "text-ink/50"
                            }`}
                          >
                            {st.counter}
                          </span>
                        )}

                        {step.auto ? (
                          <span className="shrink-0 text-xs text-ink/35">өздігінен</span>
                        ) : (
                          <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs text-ink/50">
                            <input
                              type="checkbox"
                              checked={!!manual[step.key]}
                              onChange={(e) => toggle(step.key, e.target.checked)}
                              className="h-4 w-4 cursor-pointer"
                            />
                            белгілеу
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}

          <p className="mt-6 text-xs text-ink/40">
            «Өздігінен» деген қадамдарды қолмен белгілеу керек емес — олар базадан көрінеді.
            Қалғаны тек сіз білетін жұмыс: басып шығару, тарату, жинау.
          </p>
        </>
      )}
    </div>
  );
}
