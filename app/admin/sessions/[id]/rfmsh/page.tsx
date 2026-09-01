"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { fetchAll, fetchAllByIds } from "@/lib/fetchAll";
import { SUBJECT_MAX_COUNT } from "@/lib/questions/subjects";

/**
 * РФМШ жауаптарын қолмен енгізу.
 *
 * Неге бөлек экран керек. РФМШ-те жауап — сан, көпіршік жоқ, сондықтан
 * ZipGrade оның парағын оқи алмайды. Бұған дейін бұл жауаптарды жүйеге
 * кіргізудің жалғыз жолы ZipGrade экспортының құрылымын Excel-де қолмен
 * қайталау еді: отыз бағанды бір оқушыға теру — жол не бағанды жылжытып
 * алуға ең қолайлы жер, ал қатені кейін көру мүмкін емес.
 *
 * Экранның қалыбы қағаз парақпен бірдей: сол жақта 1–15, оң жақта 16–30.
 * Көз қағаздан экранға көшкенде орын іздемеу керек.
 *
 * Автосақтау ЖОҚ. Қағаздан теру кезінде бір сәтке алаңдап, санды басқа
 * жолға жазып жіберу оңай, сондықтан парақты толық енгізіп, көзбен
 * шолып шыққаннан кейін ғана сақталады.
 *
 * Қаріп — моноширинді. Парақтағы сегментті цифрлар балаға жазуға арналған,
 * ал мұнда керісінше — сверять керек, ал ондай қаріпте 5 пен 6, 8 бен 0
 * бір-біріне ұқсас.
 */

type Row = {
  zipgradeId: string;
  fullName: string;
  classroom: string;
  seat: string;
  variant: number;
};

const COUNT = SUBJECT_MAX_COUNT.rfmsh; // 30
const MAX_DIGITS = 7;

export default function RfmshEntryPage() {
  const params = useParams();
  const sessionId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [students, setStudents] = useState<Row[]>([]);
  /** zipgrade_id -> { сұрақ нөмірі -> жауап } */
  const [saved, setSaved] = useState<Record<string, Record<string, string>>>({});
  const [activeId, setActiveId] = useState("");
  const [draft, setDraft] = useState<string[]>(() => Array(COUNT).fill(""));
  const [dirty, setDirty] = useState(false);

  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    const bookings = await fetchAll<any>((from, to) =>
      supabase
        .from("registrations")
        .select("classroom, seat, test_variant, student_id, test_type_id")
        .eq("test_session_id", sessionId)
        .eq("format", "offline")
        .eq("payment_status", "paid")
        .order("id")
        .range(from, to)
    );

    if (bookings.length === 0) {
      setStudents([]);
      setLoading(false);
      return;
    }

    const [studentRows, typeRows, sheetRows] = await Promise.all([
      fetchAllByIds<any>(
        bookings.map((b) => b.student_id),
        (chunk) => supabase.from("students").select("id, full_name, zipgrade_id").in("id", chunk)
      ),
      fetchAllByIds<any>(
        bookings.map((b) => b.test_type_id),
        (chunk) => supabase.from("test_types").select("id, code").in("id", chunk)
      ),
      fetchAll<any>((from, to) =>
        supabase
          .from("answer_sheets")
          .select("zipgrade_id, answers")
          .eq("test_session_id", sessionId)
          .eq("subject", "rfmsh")
          .order("id")
          .range(from, to)
      ),
    ]);

    const studentById = new Map<string, any>(studentRows.map((s) => [s.id as string, s]));
    const typeById = new Map<string, any>(typeRows.map((t) => [t.id as string, t]));

    const list: Row[] = [];
    bookings.forEach((b) => {
      if (typeById.get(b.test_type_id)?.code !== "RFMS") return;
      const s = studentById.get(b.student_id);
      if (!s?.zipgrade_id) return;
      list.push({
        zipgradeId: s.zipgrade_id,
        fullName: s.full_name ?? "(аты жоқ)",
        classroom: b.classroom ?? "—",
        seat: b.seat ?? "—",
        variant: parseInt(String(b.test_variant ?? "").replace(/\D/g, ""), 10) || 1,
      });
    });

    // Парақтар аудиториядағы орын ретімен жиналған — сол ретпен көрсетеміз,
    // сонда стопканы бетпе-бет теруге болады.
    list.sort(
      (a, b) =>
        a.classroom.localeCompare(b.classroom, undefined, { numeric: true }) ||
        a.seat.localeCompare(b.seat, undefined, { numeric: true })
    );

    const savedMap: Record<string, Record<string, string>> = {};
    sheetRows.forEach((r: any) => {
      savedMap[r.zipgrade_id] = (r.answers ?? {}) as Record<string, string>;
    });

    setStudents(list);
    setSaved(savedMap);
    setActiveId((prev) => (list.some((s) => s.zipgradeId === prev) ? prev : list[0]?.zipgradeId ?? ""));
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  const active = useMemo(
    () => students.find((s) => s.zipgradeId === activeId) ?? null,
    [students, activeId]
  );

  // Оқушы ауысқанда — сақталған жауаптарды өріске саламыз.
  useEffect(() => {
    if (!activeId) return;
    const stored = saved[activeId] ?? {};
    setDraft(Array.from({ length: COUNT }, (_, i) => stored[String(i + 1)] ?? ""));
    setDirty(false);
  }, [activeId, saved]);

  // Сақталмаған жауаптармен беттен шығып кетпеу үшін.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const filledCount = (answers: Record<string, string>) =>
    Object.values(answers).filter((v) => String(v).trim() !== "").length;

  function setCell(i: number, raw: string) {
    // Тек цифр. Нөл — жарамды жауап, сондықтан оны алып тастамаймыз;
    // бос өріс «жауап берілмеді» дегенді білдіреді.
    const clean = raw.replace(/[^0-9]/g, "").slice(0, MAX_DIGITS);
    setDraft((prev) => {
      const next = [...prev];
      next[i] = clean;
      return next;
    });
    setDirty(true);
  }

  /**
   * Өрістер экранда кезектесіп тұр (1, 16, 2, 17…), сондықтан Tab-тың өз
   * реті сұрақтардың ретімен сәйкес келмейді. Оны да өзіміз басқарамыз —
   * қолмен теру кезінде саусақ әдетте Tab-қа барады.
   */
  function onKey(e: React.KeyboardEvent<HTMLInputElement>, i: number) {
    const go = (to: number) => {
      e.preventDefault();
      inputs.current[to]?.focus();
      inputs.current[to]?.select();
    };
    if (e.key === "Enter" || e.key === "ArrowDown") go(i + 1);
    else if (e.key === "ArrowUp") go(i - 1);
    else if (e.key === "Tab") go(e.shiftKey ? i - 1 : i + 1);
  }

  async function handleSave(goNext: boolean) {
    if (!active) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const answers: Record<string, string> = {};
      draft.forEach((v, i) => {
        answers[String(i + 1)] = v.trim();
      });

      const { error: upErr } = await supabase.from("answer_sheets").upsert(
        {
          test_session_id: sessionId,
          zipgrade_id: active.zipgradeId,
          subject: "rfmsh",
          variant_number: active.variant,
          source: "manual",
          answers,
          imported_at: new Date().toISOString(),
        },
        { onConflict: "test_session_id,zipgrade_id,subject" }
      );
      if (upErr) throw upErr;

      setSaved((prev) => ({ ...prev, [active.zipgradeId]: answers }));
      setDirty(false);
      setMessage(`${active.fullName}: сақталды.`);

      if (goNext) {
        const idx = students.findIndex((s) => s.zipgradeId === active.zipgradeId);
        const next = students[idx + 1];
        if (next) setActiveId(next.zipgradeId);
      }
    } catch (err: any) {
      console.error(err);
      setError("Сақталмады: " + (err?.message ?? "белгісіз"));
    } finally {
      setSaving(false);
    }
  }

  function switchTo(id: string) {
    if (dirty && !confirm("Сақталмаған жауаптар бар. Ауысасыз ба?")) return;
    setActiveId(id);
  }

  if (loading) return <p className="mt-6 text-sm text-ink/50">Жүктелуде...</p>;

  const done = students.filter((s) => filledCount(saved[s.zipgradeId] ?? {}) > 0).length;

  return (
    <div>
      <Link href={`/admin/sessions/${sessionId}`} className="text-sm text-ink/50 hover:underline">
        ← Сессияға оралу
      </Link>
      <h1 className="font-display text-2xl font-bold text-admin">РФМШ жауаптары</h1>
      <p className="mt-1 text-sm text-ink/60">
        Парақтар аудиториядағы орын ретімен тізілген. Жауап — сан, бос өріс «жауап берілмеді»
        дегенді білдіреді. Нөл — жарамды жауап, оны да жазыңыз.
      </p>

      {students.length === 0 ? (
        <p className="mt-6 rounded-xl bg-ink/5 px-4 py-3 text-sm text-ink/50">
          Бұл сессияда РФМШ тапсыратын, төлемі расталған офлайн оқушы жоқ.
        </p>
      ) : (
        <div className="mt-5 flex flex-col gap-5 lg:flex-row">
          {/* ---- оқушылар тізімі ---- */}
          <aside className="lg:w-64 lg:shrink-0">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/45">
              Енгізілді: {done} / {students.length}
            </p>
            <div className="max-h-[70vh] overflow-auto rounded-2xl border border-ink/10 bg-white">
              {students.map((s) => {
                const n = filledCount(saved[s.zipgradeId] ?? {});
                const isActive = s.zipgradeId === activeId;
                return (
                  <button
                    key={s.zipgradeId}
                    onClick={() => switchTo(s.zipgradeId)}
                    className={`flex w-full items-center justify-between gap-2 border-b border-ink/5 px-3 py-2 text-left text-sm last:border-0 ${
                      isActive ? "bg-admin/10 font-semibold text-admin" : "text-ink/80 hover:bg-ink/5"
                    }`}
                  >
                    <span className="truncate">
                      <span className="font-mono text-xs text-ink/45">
                        {s.classroom}·{s.seat}
                      </span>{" "}
                      {s.fullName}
                    </span>
                    <span
                      className={`font-mono text-xs ${n > 0 ? "text-parent" : "text-ink/30"}`}
                    >
                      {n > 0 ? `${n}/${COUNT}` : "—"}
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* ---- енгізу парағы ---- */}
          {active && (
            <section className="flex-1 rounded-2xl border border-ink/10 bg-white p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-ink/10 pb-4">
                <div>
                  <p className="font-display text-xl font-bold text-ink">{active.fullName}</p>
                  <p className="mt-0.5 text-sm text-ink/55">
                    Оқушы ID:{" "}
                    <span className="font-mono font-semibold text-ink">{active.zipgradeId}</span>
                    {"  ·  "}
                    Аудитория {active.classroom}, орын {active.seat}
                  </p>
                </div>
                <p className="text-sm text-ink/55">
                  Нұсқа:{" "}
                  <span className="font-mono text-lg font-bold text-ink">{active.variant}</span>
                </p>
              </div>

              {/* Қалыбы қағаз парақпен бірдей: сол жақта 1–15, оң жақта 16–30.
                  Тор жол-жолмен толатындықтан реті кезектесіп жазылады:
                  1, 16, 2, 17, ... — сонда бағандар қағаздағыдай шығады. */}
              <div className="mt-4 grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
                {Array.from({ length: COUNT / 2 }, (_, r) => [r, r + COUNT / 2])
                  .flat()
                  .map((i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-lg border border-ink/10 px-2 py-1"
                    >
                      <span className="w-7 text-right font-mono text-sm font-semibold text-ink/50">
                        {i + 1}
                      </span>
                      <input
                        ref={(el) => {
                          inputs.current[i] = el;
                        }}
                        value={draft[i]}
                        onChange={(e) => setCell(i, e.target.value)}
                        onKeyDown={(e) => onKey(e, i)}
                        onFocus={(e) => e.target.select()}
                        inputMode="numeric"
                        autoComplete="off"
                        maxLength={MAX_DIGITS}
                        className="focus-ring w-full rounded-md bg-parchment/60 px-3 py-1.5 text-center font-mono text-lg tracking-[0.15em] text-ink"
                      />
                    </div>
                  ))}
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-ink/10 pt-4">
                <button
                  onClick={() => handleSave(true)}
                  disabled={saving}
                  className="focus-ring rounded-full bg-admin px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {saving ? "Сақталуда..." : "Сақтап, келесіге →"}
                </button>
                <button
                  onClick={() => handleSave(false)}
                  disabled={saving}
                  className="focus-ring rounded-full border border-ink/15 px-4 py-2.5 text-sm font-medium text-ink/70 hover:bg-ink/5 disabled:opacity-40"
                >
                  Сақтау
                </button>
                <span className="text-xs text-ink/45">
                  {dirty
                    ? "Сақталмаған өзгеріс бар"
                    : `Толтырылды: ${draft.filter((v) => v.trim() !== "").length} / ${COUNT}`}
                </span>
              </div>

              <p className="mt-3 text-xs text-ink/40">
                Enter немесе ↓ — келесі сұраққа, ↑ — алдыңғысына. Тінтуірсіз теруге болады.
              </p>
            </section>
          )}
        </div>
      )}

      {message && <p className="mt-4 text-sm text-parent">{message}</p>}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </div>
  );
}
