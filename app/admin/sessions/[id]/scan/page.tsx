"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { fetchAll, fetchAllByIds } from "@/lib/fetchAll";
import { SheetCamera, type Shot } from "@/components/sheets/SheetCamera";
import { SheetFix } from "@/components/sheets/SheetFix";
import { RfmshFix } from "@/components/sheets/RfmshFix";
import type { RfmshAnswer } from "@/lib/sheets/rfmsh";
import { readFile } from "@/lib/sheets/camera";
import { answersBySubject, type OvalSpot, type RowAnswer } from "@/lib/sheets/read";
import { kindsForTestType, KIND_LABEL, layoutOf, type SheetKind } from "@/lib/sheets/layout";
import { buildSheetsPdf, type SheetStudent } from "@/lib/sheets/stamp";
import type { SheetCode } from "@/lib/sheets/code";
import type { SubjectKey } from "@/lib/questions/subjects";

/**
 * Жауап парақтарын суретке түсіріп оқу (ZipGrade-тің орнына).
 *
 * Админ телефонда камераны ашады, парақтарды бірінен соң бірін қояды.
 * Машина бұрыштағы белгілерді тауып, жоғарғы кодтан оқушыны, нұсқаны және
 * парақтың түрін (НИШ, Тілдер, БИЛ) таниды, дөңгелектерді оқиды. Админ
 * карточкада нәтижені көреді, керек болса түзетеді, «Қабылдау» басады.
 *
 * Жауаптар answer_sheets кестесіне ZipGrade-тегідей түрде жазылады
 * (source = 'photo'), сондықтан ұпай санау, рейтинг, жариялау бұрынғыдай.
 *
 * Суреттің өзі сақталмайды: түпнұсқа қағаздар орталықта қалады.
 */

type Student = {
  zipgradeId: string;
  fullName: string;
  classroom: string;
  seat: string;
  variant: number;
  lang: "kk" | "ru";
  kinds: SheetKind[];
};

type Pending = {
  code: SheetCode;
  answers: RowAnswer[];
  ovals: OvalSpot[];
  /** РФМШ: жазылған сандар (басқа парақтарда жоқ). */
  numbers?: RfmshAnswer[];
  shot: string;
  width: number;
  height: number;
  reviewed: boolean;
  askReplace: boolean;
};

const SUBJECT_LABEL: Partial<Record<SubjectKey, string>> = {
  math: "Математика", sandyq: "Сандық", zharatylystanu: "Жаратылыстану", tilder: "Тілдер", bil: "БИЛ",
  rfmsh: "РФМШ",
};

function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso ?? "";
}

export default function ScanSheetsPage() {
  const params = useParams();
  const sessionId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [sessionTitle, setSessionTitle] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  /** zipgrade_id -> { пән -> қайдан келген } */
  const [taken, setTaken] = useState<Record<string, Partial<Record<SubjectKey, string>>>>({});
  const [camera, setCamera] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [fixing, setFixing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: session } = await supabase
        .from("test_sessions").select("title_kk, session_date").eq("id", sessionId).single();
      setSessionTitle((session as any)?.title_kk ?? "");
      setSessionDate(formatDate((session as any)?.session_date ?? ""));

      const bookings = await fetchAll<any>((from, to) =>
        supabase.from("registrations")
          .select("classroom, seat, test_variant, student_id, test_type_id")
          .eq("test_session_id", sessionId).eq("format", "offline").eq("payment_status", "paid")
          .order("id").range(from, to));

      const [studentRows, typeRows, sheetRows] = await Promise.all([
        fetchAllByIds<any>(bookings.map((b) => b.student_id),
          (chunk) => supabase.from("students").select("id, full_name, zipgrade_id, language").in("id", chunk)),
        fetchAllByIds<any>(bookings.map((b) => b.test_type_id),
          (chunk) => supabase.from("test_types").select("id, code").in("id", chunk)),
        fetchAll<any>((from, to) =>
          supabase.from("answer_sheets").select("zipgrade_id, subject, source")
            .eq("test_session_id", sessionId).order("id").range(from, to)),
      ]);
      const studentById = new Map<string, any>(studentRows.map((s) => [s.id as string, s]));
      const typeById = new Map<string, any>(typeRows.map((t) => [t.id as string, t]));

      const list: Student[] = [];
      for (const b of bookings) {
        const s = studentById.get(b.student_id);
        const kinds = kindsForTestType(typeById.get(b.test_type_id)?.code);
        if (!s?.zipgrade_id || kinds.length === 0) continue;
        list.push({
          zipgradeId: String(s.zipgrade_id),
          fullName: s.full_name ?? "(аты жоқ)",
          classroom: b.classroom ?? "",
          seat: b.seat ?? "",
          variant: parseInt(String(b.test_variant ?? "").replace(/\D/g, ""), 10) || 0,
          lang: s.language === "ru" ? "ru" : "kk",
          kinds,
        });
      }
      list.sort((a, b) =>
        a.classroom.localeCompare(b.classroom, undefined, { numeric: true })
        || a.seat.localeCompare(b.seat, undefined, { numeric: true })
        || a.fullName.localeCompare(b.fullName));
      setStudents(list);

      const map: Record<string, Partial<Record<SubjectKey, string>>> = {};
      for (const r of sheetRows) (map[r.zipgrade_id] ??= {})[r.subject as SubjectKey] = r.source;
      setTaken(map);
    } catch (err: any) {
      setError("Жүктелмеді: " + (err?.message ?? "белгісіз"));
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => { load(); }, [load]);

  const byId = useMemo(() => new Map(students.map((s) => [s.zipgradeId, s])), [students]);

  /** Осы оқушының осы түрдегі парағы қабылданған ба (пәндердің бәрі бар ма). */
  const kindDone = (s: Student, kind: SheetKind) => {
    const lay = layoutOf(kind);
    const subjects: SubjectKey[] = lay ? lay.subjects : ["rfmsh"];
    return subjects.every((subj) => taken[s.zipgradeId]?.[subj]);
  };

  const sheetsTotal = students.reduce((n, s) => n + s.kinds.length, 0);
  const sheetsDone = students.reduce((n, s) => n + s.kinds.filter((k) => kindDone(s, k)).length, 0);

  // ---- суреттен келген нәтиже ----
  const takeShot = ({ reading, shot, width, height }: Shot) => {
    setMessage("");
    if (reading.status === "no_sheet") { setError("Парақ табылмады: төрт бұрыштағы қара белгі көрінуі керек."); return; }
    if (reading.status === "no_code") { setError("Код оқылмады. Парақты жарықта, тік ұстап қайта түсіріңіз."); return; }
    setError("");
    if (reading.status === "rfmsh") {
      setPending({
        code: reading.code, answers: [], ovals: [], numbers: reading.numbers,
        shot, width, height, reviewed: false, askReplace: false,
      });
      return;
    }
    setPending({
      code: reading.code, answers: reading.answers, ovals: reading.ovals,
      shot, width, height, reviewed: false, askReplace: false,
    });
  };

  const onFile = async (file: File | null) => {
    if (!file) return;
    try {
      takeShot(await readFile(file));
    } catch (err: any) {
      setError("Сурет ашылмады: " + (err?.message ?? "белгісіз"));
    }
  };

  // ---- карточка ----
  const card = useMemo(() => {
    if (!pending) return null;
    const student = byId.get(pending.code.zipgradeId) ?? null;
    const lay = layoutOf(pending.code.kind) ?? { subjects: ["rfmsh"] as SubjectKey[] };
    const perSubject = pending.numbers ? [{
      subject: "rfmsh" as SubjectKey,
      total: pending.numbers.length,
      answered: pending.numbers.filter((n) => n.value !== "").length,
      blank: pending.numbers.filter((n) => n.value === "").length,
      double: 0,
      doubtful: pending.numbers.filter((n) => n.unsure).length,
    }] : lay.subjects.map((subject) => {
      const rows = pending.answers.filter((a) => a.subject === subject);
      return {
        subject,
        total: rows.length,
        answered: rows.filter((a) => a.letters.length === 1).length,
        blank: rows.filter((a) => a.letters.length === 0).length,
        double: rows.filter((a) => a.letters.length > 1).length,
        doubtful: rows.filter((a) => a.doubtful).length,
      };
    });
    const doubtful = perSubject.reduce((n, p) => n + p.doubtful, 0);
    const wrongKind = student && !student.kinds.includes(pending.code.kind);
    const variantDiffers = student && student.variant && student.variant !== pending.code.variant;
    const already = student && lay.subjects.some((subj) => taken[student.zipgradeId]?.[subj]);
    const blockReason = !student ? "Бұл оқушы осы сессияда жоқ (немесе төлемі расталмаған)."
      : wrongKind ? `Бұл оқушы ${KIND_LABEL[pending.code.kind]} тапсырмайды.`
      : doubtful > 0 && !pending.reviewed ? `Күмәнді жол бар (${doubtful}) — «Тексеру» басып, көзбен қараңыз.`
      : "";
    return { student, lay, perSubject, doubtful, variantDiffers, already, blockReason };
  }, [pending, byId, taken]);

  const save = async (replace: boolean) => {
    if (!pending || !card?.student || card.blockReason) return;
    if (card.already && !replace) { setPending({ ...pending, askReplace: true }); return; }
    setSaving(true);
    setError("");
    try {
      const bySubject: Partial<Record<SubjectKey, Record<string, string>>> = pending.numbers
        ? { rfmsh: Object.fromEntries(pending.numbers.map((n) => [String(n.question), n.value])) }
        : answersBySubject(pending.answers);
      const now = new Date().toISOString();
      const rows = card.lay.subjects.map((subject) => ({
        test_session_id: sessionId,
        zipgrade_id: card.student!.zipgradeId,
        subject,
        variant_number: pending.code.variant,
        source: "photo",
        answers: bySubject[subject] ?? {},
        imported_at: now,
      }));
      const { error: upErr } = await supabase
        .from("answer_sheets").upsert(rows, { onConflict: "test_session_id,zipgrade_id,subject" });
      if (upErr) throw upErr;
      setTaken((prev) => {
        const next = { ...prev };
        const mine = { ...(next[card.student!.zipgradeId] ?? {}) };
        card.lay.subjects.forEach((s) => { mine[s] = "photo"; });
        next[card.student!.zipgradeId] = mine;
        return next;
      });
      setMessage(`${card.student.fullName} — ${KIND_LABEL[pending.code.kind]}: қабылданды.`);
      setPending(null);
    } catch (err: any) {
      setError("Сақталмады: " + (err?.message ?? "белгісіз"));
    } finally {
      setSaving(false);
    }
  };

  // ---- бланк басу ----
  const toSheetStudent = (s: Student): SheetStudent => ({
    fullName: s.fullName, zipgradeId: s.zipgradeId, variant: s.variant, lang: s.lang,
    classroom: s.classroom, seat: s.seat, sessionTitle, sessionDate,
  });

  const printSheets = async (list: Student[], only?: SheetKind) => {
    const items: { kind: SheetKind; student: SheetStudent }[] = [];
    const skipped: string[] = [];
    for (const s of list) {
      if (!(s.variant >= 1 && s.variant <= 4)) { skipped.push(s.fullName); continue; }
      for (const kind of s.kinds) if (!only || kind === only) items.push({ kind, student: toSheetStudent(s) });
    }
    if (items.length === 0) { setError("Басатын парақ жоқ: оқушыларға нұсқа қойылмаған."); return; }
    setPrinting("Парақтар жиналуда…");
    setError("");
    try {
      const bytes = await buildSheetsPdf(items);
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
      window.open(url, "_blank");
      if (skipped.length) setMessage(`Нұсқасы жоқ, басылмады: ${skipped.join(", ")}`);
    } catch (err: any) {
      setError("Парақ жиналмады: " + (err?.message ?? "белгісіз"));
    } finally {
      setPrinting("");
    }
  };

  if (loading) return <p className="mt-6 text-sm text-ink/50">Жүктелуде...</p>;

  return (
    <div>
      <Link href={`/admin/sessions/${sessionId}`} className="text-sm text-ink/50 hover:underline">
        ← Сессияға оралу
      </Link>
      <h1 className="font-display text-2xl font-bold text-admin">Жауап парақтарын түсіру</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink/60">
        Камераны ашып, парақтарды бірінен соң бірін қойыңыз — машина оқушыны, нұсқаны және парақтың
        түрін жоғарғы кодтан өзі таниды. Әр парақтан кейін карточка шығады: тексеріп, «Қабылдау»
        басыңыз. Тек біздің жаңа бланктер оқылады (төменде басуға болады).
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button onClick={() => { setError(""); setMessage(""); setCamera(true); }}
                className="focus-ring rounded-full bg-admin px-5 py-2.5 text-sm font-semibold text-white">
          Камераны ашу
        </button>
        <label className="focus-ring cursor-pointer rounded-full border border-ink/15 px-4 py-2.5 text-sm font-medium text-ink/70 hover:bg-ink/5">
          Суреттен оқу
          <input type="file" accept="image/*" className="hidden"
                 onChange={(e) => { void onFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
        </label>
        <button onClick={() => printSheets(students)} disabled={!!printing || students.length === 0}
                className="focus-ring rounded-full border border-teacher px-4 py-2.5 text-sm font-medium text-teacher hover:bg-teacher-soft disabled:opacity-40">
          {printing || "Барлық бланктер (PDF)"}
        </button>
        <span className="text-sm text-ink/55">Қабылданды: {sheetsDone} / {sheetsTotal}</span>
      </div>

      {message && <p className="mt-4 rounded-xl bg-parent/10 px-4 py-2 text-sm text-parent">{message}</p>}
      {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      {students.length === 0 ? (
        <p className="mt-6 rounded-xl bg-ink/5 px-4 py-3 text-sm text-ink/50">
          Бұл сессияда төлемі расталған, ZipGrade ID-і бар офлайн оқушы жоқ.
        </p>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-2xl border border-ink/10 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-xs text-ink/50">
                <th className="px-3 py-2">Ауд · орын</th>
                <th className="px-3 py-2">Оқушы</th>
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">Нұсқа</th>
                <th className="px-3 py-2">Парақтар</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.zipgradeId} className="border-b border-ink/5 last:border-0">
                  <td className="px-3 py-2 font-mono text-xs text-ink/50">{s.classroom || "—"}·{s.seat || "—"}</td>
                  <td className="px-3 py-2">{s.fullName}</td>
                  <td className="px-3 py-2 font-mono text-xs">{s.zipgradeId}</td>
                  <td className="px-3 py-2 font-mono">{s.variant || <span className="text-red-600">жоқ</span>}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1.5">
                      {s.kinds.map((kind) => {
                        const done = kindDone(s, kind);
                        return (
                          <button key={kind} onClick={() => printSheets([s], kind)}
                                  title="Осы оқушының бланкін басу"
                                  className={`rounded-full border px-2.5 py-1 text-xs ${
                                    done ? "border-parent bg-parent/10 text-parent" : "border-ink/15 text-ink/60 hover:bg-ink/5"}`}>
                            {done ? "✓ " : ""}{KIND_LABEL[kind]}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-ink/40">
        Парақтың атауын бассаңыз — сол оқушының бланкі ашылады (басып шығару үшін). ✓ — парақ қабылданған.
      </p>

      {camera && (
        <SheetCamera paused={!!pending} counter={`${sheetsDone} / ${sheetsTotal}`} notice={error}
                     onShot={takeShot} onClose={() => { setCamera(false); setPending(null); }} />
      )}

      {pending && card && !fixing && (
        <div className="fixed inset-x-0 bottom-0 z-[60] max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/45">{KIND_LABEL[pending.code.kind]}</p>
          {card.student ? (
            <p className="font-display text-2xl font-bold text-ink">{card.student.fullName}</p>
          ) : (
            <p className="font-display text-xl font-bold text-red-700">Белгісіз оқушы</p>
          )}
          <p className="mt-0.5 text-sm text-ink/60">
            ID <span className="font-mono">{pending.code.zipgradeId}</span>
            {card.student && <> · Ауд. {card.student.classroom || "—"}, орын {card.student.seat || "—"}</>}
            {" · "}Нұсқа <span className="font-mono text-base font-bold text-ink">{pending.code.variant}</span>
          </p>
          {card.variantDiffers && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Тіркеуде нұсқа {card.student!.variant}, ал парақта {pending.code.variant}. Парақтағы нұсқамен тексеріледі.
            </p>
          )}

          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {card.perSubject.map((p) => (
              <div key={p.subject} className="rounded-xl border border-ink/10 px-3 py-2 text-sm">
                <p className="font-semibold text-ink">{SUBJECT_LABEL[p.subject] ?? p.subject}</p>
                <p className="text-ink/70">Белгіленген: <b>{p.answered}</b> / {p.total}</p>
                <p className="text-xs text-ink/50">
                  Бос: {p.blank}
                  {p.double > 0 && <span className="text-amber-700"> · Екі белгі: {p.double}</span>}
                  {p.doubtful > 0 && !pending.reviewed && <span className="text-pink-700"> · Күмәнді: {p.doubtful}</span>}
                </p>
              </div>
            ))}
          </div>

          {card.blockReason && <p className="mt-3 text-sm text-red-700">{card.blockReason}</p>}

          {pending.askReplace ? (
            <div className="mt-4 rounded-xl bg-amber-50 p-3">
              <p className="text-sm text-amber-900">Бұл оқушының бұл парағы бұрын қабылданған. Жаңасымен ауыстыру керек пе?</p>
              <div className="mt-2 flex gap-2">
                <button onClick={() => save(true)} disabled={saving}
                        className="rounded-full bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
                  {saving ? "Сақталуда..." : "Иә, ауыстыру"}
                </button>
                <button onClick={() => setPending({ ...pending, askReplace: false })}
                        className="rounded-full border border-ink/15 px-4 py-2 text-sm text-ink/70">Жоқ</button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => save(false)} disabled={saving || !!card.blockReason}
                      className="rounded-full bg-admin px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
                {saving ? "Сақталуда..." : "Қабылдау"}
              </button>
              <button onClick={() => setFixing(true)}
                      className="rounded-full border border-admin px-4 py-2.5 text-sm font-medium text-admin">
                Тексеру {card.doubtful > 0 && !pending.reviewed ? `(${card.doubtful})` : ""}
              </button>
              <button onClick={() => setPending(null)}
                      className="rounded-full border border-ink/15 px-4 py-2.5 text-sm text-ink/70">
                Қайта түсіру
              </button>
            </div>
          )}
        </div>
      )}

      {pending && fixing && pending.numbers && (
        <RfmshFix shot={pending.shot} width={pending.width} height={pending.height}
                  numbers={pending.numbers}
                  onCancel={() => setFixing(false)}
                  onDone={(numbers) => { setPending({ ...pending, numbers, reviewed: true }); setFixing(false); }} />
      )}

      {pending && fixing && !pending.numbers && (
        <SheetFix shot={pending.shot} width={pending.width} height={pending.height}
                  ovals={pending.ovals} answers={pending.answers}
                  onCancel={() => setFixing(false)}
                  onDone={(answers) => { setPending({ ...pending, answers, reviewed: true }); setFixing(false); }} />
      )}
    </div>
  );
}
