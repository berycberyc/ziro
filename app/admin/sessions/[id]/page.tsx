"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { removeStoredFiles } from "@/lib/storageCleanup";
import { fetchAll } from "@/lib/fetchAll";

type Registration = {
  id: string;
  format: string;
  payment_status: string;
  classroom: string | null;
  seat: string | null;
  test_variant: string | null;
  students: { full_name: string; iin: string | null; language: string | null } | null;
  test_types: { name_kk: string; name_ru: string } | null;
};

type SessionInfo = {
  id: string;
  title_kk: string;
  title_ru: string;
  session_date: string;
  start_time: string | null;
  address: string | null;
  price: number;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  is_checking: boolean;
  has_results: boolean;
  /** Онлайн тест ашылатын нақты сәт. Базада 055 миграциясының триггері
   *  күн мен уақыттан өзі толтырады — біз тек көрсетеміз. */
  online_starts_at: string | null;
};

/** "17:00" не "17:00:00" → "17:00:00". Бос болса — null. */
function normalizeTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const [h, m] = value.split(":");
  if (h === undefined || m === undefined) return null;
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}:00`;
}

/**
 * Базадағы нақты сәтті Астана уақытымен көрсетеді: "18 қазан, 10:00".
 * МАҢЫЗДЫ: бұл жерде session_date/start_time емес, тестке кіргізетін
 * функция қарайтын дәл сол өріс көрсетіледі. Сондықтан экранда
 * көрінгені — жүйе шын мәнінде қолданатын уақыт.
 */
const MONTHS_KK = [
  "қаңтар", "ақпан", "наурыз", "сәуір", "мамыр", "маусым",
  "шілде", "тамыз", "қыркүйек", "қазан", "қараша", "желтоқсан",
];

function formatAstana(iso: string): string {
  const parts = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Almaty",
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((x) => x.type === type)?.value ?? "";
  const month = MONTHS_KK[Number(get("month")) - 1] ?? get("month");
  return `${get("day")} ${month}, ${get("hour")}:${get("minute")}`;
}

/** Сол сәттен 30 минут кейін — кіру жабылады. */
function formatAstanaPlus(iso: string, minutes: number): string {
  return formatAstana(new Date(new Date(iso).getTime() + minutes * 60000).toISOString());
}

/** "10:00" + 30 → "10:30". Тек көрсету үшін. */
function addMinutes(hhmm: string, minutes: number) {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const total = (h * 60 + m + minutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Өшіруді растау үшін жазылатын сөз. Кездейсоқ басып қалудан қорғайды. */
const DELETE_WORD = "ӨШІРУ";

export default function AdminSessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<SessionInfo>>({});
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteCounts, setDeleteCounts] = useState<{
    regs: number; questions: number; pdfs: number; attempts: number;
  } | null>(null);

  const load = useCallback(async () => {
    const { data: sessionData } = await supabase
      .from("test_sessions")
      .select(
        "id, title_kk, title_ru, session_date, start_time, address, price, registration_opens_at, registration_closes_at, is_checking, has_results, online_starts_at"
      )
      .eq("id", sessionId)
      .single();
    setSession(sessionData);
    if (sessionData) setForm(sessionData);

    try {
      const regs = await fetchAll<any>((from, to) =>
        supabase
          .from("registrations")
          .select(
            `
            id, format, payment_status, classroom, seat, test_variant,
            students ( full_name, iin, language ),
            test_types ( name_kk, name_ru )
            `
          )
          .eq("test_session_id", sessionId)
          .order("created_at", { ascending: true })
          .order("id")
          .range(from, to)
      );
      setRegistrations(regs as any);
    } catch (err) {
      console.error("Session registrations failed to load:", err);
      setRegistrations([]);
    }
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  async function updateSessionField(field: string, value: boolean) {
    // Қате үнсіз жұтылмауы керек: бұрын RLS тыйым салса да, экран ештеңе
    // болмағандай қайта салынатын.
    const { error } = await supabase
      .from("test_sessions")
      .update({ [field]: value })
      .eq("id", sessionId);
    if (error) {
      alert("Сақталмады: " + error.message);
      return;
    }
    load();
  }

  async function handleSaveEdit() {
    // Уақыт өрісі "17:00" болып та, "17:00:00" болып та келуі мүмкін —
    // екеуін де HH:MM:SS түріне келтіреміз, әйтпесе timestamp бүлінеді.
    const time = normalizeTime(form.start_time);

    const { error } = await supabase
      .from("test_sessions")
      .update({
        title_kk: form.title_kk,
        title_ru: form.title_ru,
        session_date: form.session_date,
        start_time: time,
        // Онлайн тест кестесі осы екеуінен шығады. Астана уақыты (+05:00)
        // анық жазылады — сервер қай белдеуде тұрса да, сәт дәл сақталады.
        online_starts_at:
          form.session_date && time ? `${form.session_date}T${time}+05:00` : null,
        address: form.address || null,
        price: Number(form.price),
        registration_opens_at: form.registration_opens_at || null,
        registration_closes_at: form.registration_closes_at || null,
      })
      .eq("id", sessionId);

    if (error) {
      // Бұрын қате үнсіз жұтылатын: сақталмағанын білу мүмкін емес еді.
      alert("Сақталмады: " + error.message);
      return;
    }

    setEditing(false);
    load();
  }

  /**
   * Сессияны өшіру.
   *
   * Дерекқордағы жазбалар «cascade» арқылы өзі жойылады, ал ҚОЙМАДАҒЫ
   * файлдар — жоқ. Сондықтан алдымен сілтемелерді жинап, файлдарды
   * өшіреміз, содан кейін ғана сессияны жоямыз: кері ретте сілтемелер
   * жоғалып, файлдарды табу мүмкін болмай қалар еді.
   */
  /** Не өшірілетінін алдын ала санап, көрсетеміз. */
  async function prepareDelete() {
    setConfirmingDelete(true);
    setDeleteConfirmText("");
    const [regs, qs, pdfs] = await Promise.all([
      supabase.from("registrations").select("id", { count: "exact", head: true })
        .eq("test_session_id", sessionId),
      supabase.from("questions").select("id", { count: "exact", head: true })
        .eq("session_id", sessionId),
      supabase.from("print_files").select("id", { count: "exact", head: true })
        .eq("test_session_id", sessionId),
    ]);
    setDeleteCounts({
      regs: regs.count ?? 0,
      questions: qs.count ?? 0,
      pdfs: pdfs.count ?? 0,
      attempts: 0,
    });
  }

  async function handleDeleteSession() {
    if (deleteConfirmText.trim() !== DELETE_WORD) return;
    setDeleting(true);
    try {
      const [{ data: qs }, { data: pdfs }, { data: regs }] = await Promise.all([
        supabase.from("questions").select("image_url, image_url_ru").eq("session_id", sessionId),
        supabase.from("print_files").select("file_url").eq("test_session_id", sessionId),
        supabase.from("registrations").select("receipt_url").eq("test_session_id", sessionId),
      ]);

      await removeStoredFiles(
        "question-images",
        (qs ?? []).flatMap((q: any) => [q.image_url, q.image_url_ru])
      );
      await removeStoredFiles("print-files", (pdfs ?? []).map((p: any) => p.file_url));

      // Түбіртектер жолмен сақталады (057 миграциясынан кейін), сілтемемен емес.
      const receiptPaths = (regs ?? [])
        .map((r: any) => r.receipt_url)
        .filter((u: string | null): u is string => !!u && !u.startsWith("http"));
      if (receiptPaths.length > 0) {
        try {
          await supabase.storage.from("receipts").remove(receiptPaths);
        } catch (err) {
          console.warn("Түбіртектер өшірілмеді:", err);
        }
      }

      const { error } = await supabase.from("test_sessions").delete().eq("id", sessionId);
      if (error) {
        alert("Өшірілмеді: " + error.message);
        return;
      }
      router.push("/admin/sessions");
    } finally {
      setDeleting(false);
    }
  }

  async function markPaid(regId: string) {
    const { error } = await supabase
      .from("registrations")
      .update({ payment_status: "paid" })
      .eq("id", regId);
    if (error) {
      alert("Қате: " + error.message);
      return;
    }
    load();
  }

  if (loading || !session) {
    return <p className="text-sm text-ink/50">Жүктелуде...</p>;
  }

  return (
    <div>
      <div className="flex items-start justify-between">
        <h1 className="font-display text-2xl font-bold text-admin">
          {session.title_kk} / {session.title_ru}
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => setEditing((v) => !v)}
            className="focus-ring rounded-full border border-ink/15 px-4 py-2 text-sm font-semibold text-ink hover:bg-parchment"
          >
            {editing ? "Жабу" : "Өзгерту"}
          </button>
          <button
            onClick={prepareDelete}
            className="focus-ring rounded-full border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            Өшіру
          </button>
        </div>
      </div>

      {/* Онлайн тесттің кестесі — базадан оқылған нақты сәт бойынша. */}
      {session.online_starts_at ? (
        <div className="mt-4 rounded-2xl border border-teacher/30 bg-teacher-soft/40 px-5 py-3">
          <p className="text-sm text-ink">
            <b>Онлайн тест:</b> {formatAstana(session.online_starts_at)} басталады
          </p>
          <p className="mt-1 text-xs text-ink/60">
            Кіру {formatAstanaPlus(session.online_starts_at, 30)}-де жабылады. Астана уақыты.
          </p>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-red-300 bg-red-50 px-5 py-3">
          <p className="text-sm font-semibold text-red-700">
            Онлайн тест ашылмайды: басталу уақыты көрсетілмеген.
          </p>
          <p className="mt-1 text-xs text-red-700/80">
            «Өзгерту» батырмасын басып, күні мен басталу уақытын толтырып сақтаңыз.
          </p>
        </div>
      )}

      {confirmingDelete && (
        <div className="mt-4 rounded-xl border border-red-300 bg-red-50 px-5 py-4">
          <p className="text-sm font-semibold text-red-700">
            Сессияны өшіру — қайтарылмайтын әрекет.
          </p>
          {deleteCounts && (
            <ul className="mt-2 space-y-1 text-sm text-red-700/90">
              <li>• Брондаулар: {deleteCounts.regs} — оқушылардың жауаптары мен нәтижелерімен бірге</li>
              <li>• Сұрақтар: {deleteCounts.questions} — суреттерімен бірге</li>
              <li>• Басып шығару файлдары: {deleteCounts.pdfs}</li>
              <li>• Осы сессияға жүктелген барлық түбіртектер</li>
            </ul>
          )}
          <p className="mt-3 text-sm text-red-700">
            Растау үшін төмендегі жолаққа <b>{DELETE_WORD}</b> деп жазыңыз.
          </p>
          <input
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder={DELETE_WORD}
            className="focus-ring mt-2 w-48 rounded-xl border border-red-300 bg-white px-4 py-2 text-sm"
          />
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleDeleteSession}
              disabled={deleteConfirmText.trim() !== DELETE_WORD || deleting}
              className="focus-ring rounded-full bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-40 disabled:hover:bg-red-600"
            >
              {deleting ? "Өшірілуде..." : "Иә, өшіру"}
            </button>
            <button
              onClick={() => { setConfirmingDelete(false); setDeleteConfirmText(""); }}
              className="focus-ring rounded-full border border-ink/15 px-4 py-1.5 text-xs font-semibold text-ink hover:bg-white"
            >
              Бас тарту
            </button>
          </div>
        </div>
      )}

      {editing && (
        <div className="mt-4 grid gap-3 rounded-2xl border border-ink/10 bg-white p-5 sm:grid-cols-2">
          <input
            className="focus-ring rounded-xl border border-ink/15 px-3 py-2 text-sm"
            placeholder="Атауы (қазақша)"
            value={form.title_kk ?? ""}
            onChange={(e) => setForm({ ...form, title_kk: e.target.value })}
          />
          <input
            className="focus-ring rounded-xl border border-ink/15 px-3 py-2 text-sm"
            placeholder="Название (русский)"
            value={form.title_ru ?? ""}
            onChange={(e) => setForm({ ...form, title_ru: e.target.value })}
          />
          <input
            type="date"
            className="focus-ring rounded-xl border border-ink/15 px-3 py-2 text-sm"
            value={form.session_date ?? ""}
            onChange={(e) => setForm({ ...form, session_date: e.target.value })}
          />
          <div>
            <input
              type="time"
              className="focus-ring w-full rounded-xl border border-ink/15 px-3 py-2 text-sm"
              value={form.start_time ?? ""}
              onChange={(e) => setForm({ ...form, start_time: e.target.value })}
            />
            {form.start_time && (
              <p className="mt-1 text-xs text-ink/50">
                Онлайн: кіру {form.start_time.slice(0, 5)} —{" "}
                {addMinutes(form.start_time.slice(0, 5), 30)} (Астана уақыты)
              </p>
            )}
          </div>
          <input
            className="focus-ring rounded-xl border border-ink/15 px-3 py-2 text-sm sm:col-span-2"
            placeholder="Мекенжайы"
            value={form.address ?? ""}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
          <div>
            <label className="mb-1 block text-xs text-ink/50">Тіркеу басталуы</label>
            <input
              type="date"
              className="focus-ring w-full rounded-xl border border-ink/15 px-3 py-2 text-sm"
              value={form.registration_opens_at ?? ""}
              onChange={(e) => setForm({ ...form, registration_opens_at: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-ink/50">Тіркеу аяқталуы</label>
            <input
              type="date"
              className="focus-ring w-full rounded-xl border border-ink/15 px-3 py-2 text-sm"
              value={form.registration_closes_at ?? ""}
              onChange={(e) => setForm({ ...form, registration_closes_at: e.target.value })}
            />
          </div>
          <input
            type="number"
            className="focus-ring rounded-xl border border-ink/15 px-3 py-2 text-sm"
            placeholder="Баға"
            value={form.price ?? ""}
            onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
          />
          <button
            onClick={handleSaveEdit}
            className="focus-ring self-start rounded-full bg-admin px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 sm:col-span-2"
          >
            Сақтау
          </button>
        </div>
      )}

      {/* Workflow row: entry → checking → results, left to right in real order */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <a
          href={`/admin/sessions/${session.id}/questions`}
          className="focus-ring rounded-full bg-gold px-4 py-2 text-sm font-bold text-ink shadow-[0_4px_12px_rgba(198,154,58,0.28)] transition-transform hover:-translate-y-0.5"
        >
          Сұрақтарды енгізу →
        </a>
        <a
          href={`/admin/sessions/${session.id}/print`}
          className="focus-ring rounded-full border border-teacher px-4 py-2 text-sm font-medium text-teacher hover:bg-teacher-soft"
        >
          Басып шығару
        </a>
        <button
          onClick={() => updateSessionField("is_checking", !session.is_checking)}
          className={`focus-ring rounded-full border px-4 py-2 text-sm font-medium ${
            session.is_checking ? "border-teacher bg-teacher text-white" : "border-ink/15 text-ink/70"
          }`}
        >
          Тексеру: {session.is_checking ? "Иә" : "Жоқ"}
        </button>
        <button
          onClick={() => updateSessionField("has_results", !session.has_results)}
          className={`focus-ring rounded-full border px-4 py-2 text-sm font-medium ${
            session.has_results ? "border-parent bg-parent text-white" : "border-ink/15 text-ink/70"
          }`}
        >
          Нәтиже дайын: {session.has_results ? "Иә" : "Жоқ"}
        </button>
        <a
          href={`/admin/sessions/${session.id}/results-preview`}
          className="focus-ring rounded-full border border-ink/15 px-4 py-2 text-sm font-medium text-ink/70 hover:bg-parchment"
        >
          Алдын ала қарау
        </a>
      </div>

      <div className="mt-8">
        <h2 className="font-display text-lg font-bold text-ink">
          Тіркелгендер ({registrations.length})
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-ink/50">
                <th className="py-2 pr-4">ФИО</th>
                <th className="py-2 pr-4">Тест түрі</th>
                <th className="py-2 pr-4">Формат</th>
                <th className="py-2 pr-4">Аудитория</th>
                <th className="py-2 pr-4">Орын</th>
                <th className="py-2 pr-4">Нұсқа</th>
                <th className="py-2 pr-4">Төлем</th>
              </tr>
            </thead>
            <tbody>
              {registrations.map((r) => (
                <tr key={r.id} className="border-b border-ink/5">
                  <td className="py-2 pr-4">{r.students?.full_name}</td>
                  <td className="py-2 pr-4">{r.test_types?.name_kk}</td>
                  <td className="py-2 pr-4">{r.format}</td>
                  <td className="py-2 pr-4">{r.classroom ?? "—"}</td>
                  <td className="py-2 pr-4">{r.seat ?? "—"}</td>
                  <td className="py-2 pr-4">{r.test_variant ?? "—"}</td>
                  <td className="py-2 pr-4">
                    {r.payment_status === "paid" ? (
                      <span className="rounded-full bg-parent-soft px-3 py-1 text-xs font-semibold text-parent">
                        Төленді
                      </span>
                    ) : (
                      <button
                        onClick={() => markPaid(r.id)}
                        className="focus-ring rounded-full border border-admin px-3 py-1 text-xs font-semibold text-admin hover:bg-admin-soft"
                      >
                        Растау
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {registrations.length === 0 && (
            <p className="mt-2 text-sm text-ink/50">Әзірге тіркелген жоқ.</p>
          )}
        </div>
      </div>
    </div>
  );
}
