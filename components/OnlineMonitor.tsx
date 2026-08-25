"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { SUBJECT_LABELS, type SubjectKey } from "@/lib/questions/subjects";

/**
 * Онлайн тест кезіндегі тірі көрініс.
 *
 * Оқушының әр басқан түймесі емес, тек маңызды оқиғалар жазылады
 * (кірді, блок басталды/аяқталды, тапсырды, мәжбүрлі жабылды). Бір
 * оқушыға бүкіл тест бойы шамамен он жол — базаны да, көзді де шаршатпайды.
 */

const SILENT_LIMIT_MINUTES = 10;
const REFRESH_MS = 20000;

type MonitorRow = {
  registration_id: string;
  student_name: string;
  zipgrade_id: string;
  status: "not_entered" | "break" | "writing" | "finished";
  current_subject: string | null;
  answered: number;
  entered_at: string | null;
  subject_started_at: string | null;
  block_ends_at: string | null;
  break_ends_at: string | null;
  deadline_at: string | null;
  last_event_at: string | null;
  silent_minutes: number | null;
};

type EventRow = {
  id: number;
  event: string;
  subject: string | null;
  created_at: string;
};

const EVENT_LABELS: Record<string, string> = {
  entered: "Тестке кірді",
  consent: "Ережемен танысты",
  block_started: "Блокты бастады",
  block_auto_started: "Блок өзі басталды (үзіліс бітті)",
  block_finished: "Блокты аяқтады",
  block_timeout: "Блок уақыты бітті",
  submitted: "Тестті тапсырды",
  force_closed: "Жалпы уақыт бітті — жабылды",
};

function timeOnly(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Almaty",
  });
}

function minutesLeft(iso: string | null) {
  if (!iso) return null;
  return Math.round((new Date(iso).getTime() - Date.now()) / 60000);
}

export default function OnlineMonitor({ sessionId }: { sessionId: string }) {
  const [rows, setRows] = useState<MonitorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.rpc("online_monitor", {
      p_session_id: sessionId,
    });
    if (err) {
      console.error("online_monitor failed:", err);
      setError("Деректерді жүктеу мүмкін болмады.");
    } else {
      setRows((data as MonitorRow[]) ?? []);
      setError("");
      setUpdatedAt(new Date());
    }
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  async function openStudent(registrationId: string) {
    if (openId === registrationId) {
      setOpenId(null);
      return;
    }
    setOpenId(registrationId);
    setEvents([]);
    const { data } = await supabase
      .from("test_events")
      .select("id, event, subject, created_at")
      .eq("registration_id", registrationId)
      .order("created_at");
    setEvents((data as EventRow[]) ?? []);
  }

  if (loading) return <p className="mt-6 text-sm text-ink/50">Жүктелуде...</p>;
  if (error) return <p className="mt-6 text-sm text-red-600">{error}</p>;
  if (rows.length === 0)
    return (
      <p className="mt-6 rounded-xl bg-ink/5 px-4 py-3 text-sm text-ink/50">
        Бұл сессияда төлемі расталған онлайн қатысушы жоқ.
      </p>
    );

  const entered = rows.filter((r) => r.status !== "not_entered").length;
  const finished = rows.filter((r) => r.status === "finished").length;
  const silent = rows.filter(
    (r) => (r.silent_minutes ?? 0) >= SILENT_LIMIT_MINUTES && r.status === "writing"
  ).length;

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-ink/5 px-4 py-1.5 text-sm">
          Кірді: <b>{entered}</b> / {rows.length}
        </span>
        <span className="rounded-full bg-parent-soft px-4 py-1.5 text-sm text-parent">
          Аяқтады: <b>{finished}</b>
        </span>
        {silent > 0 && (
          <span className="rounded-full bg-red-50 px-4 py-1.5 text-sm text-red-700">
            Байланыс жоқ: <b>{silent}</b>
          </span>
        )}
        <span className="ml-auto font-mono text-xs text-ink/40">
          {updatedAt ? `жаңартылды ${timeOnly(updatedAt.toISOString())}` : ""}
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {rows.map((r) => {
          const isSilent =
            r.status === "writing" && (r.silent_minutes ?? 0) >= SILENT_LIMIT_MINUTES;
          const left =
            r.status === "writing"
              ? minutesLeft(r.block_ends_at)
              : r.status === "break"
              ? minutesLeft(r.break_ends_at)
              : null;

          return (
            <div key={r.registration_id}>
              <button
                onClick={() => openStudent(r.registration_id)}
                className={`focus-ring flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-2.5 text-left text-sm ${
                  isSilent ? "border-red-300 bg-red-50" : "border-ink/10 bg-white"
                }`}
              >
                <span className="font-medium text-ink">
                  {r.student_name}
                  <span className="ml-2 font-mono text-xs text-ink/40">{r.zipgrade_id}</span>
                </span>

                <span className="flex items-center gap-3 text-xs">
                  {r.status === "not_entered" && <span className="text-ink/40">кірген жоқ</span>}

                  {r.status === "writing" && (
                    <>
                      <span className="text-ink/60">
                        {r.current_subject
                          ? SUBJECT_LABELS[r.current_subject as SubjectKey] ?? r.current_subject
                          : ""}
                      </span>
                      <span className="font-mono text-ink/50">{r.answered} жауап</span>
                      {left !== null && (
                        <span className="font-mono text-teacher">{left} мин қалды</span>
                      )}
                      {isSilent && (
                        <span className="font-semibold text-red-600">
                          {r.silent_minutes} мин үнсіз
                        </span>
                      )}
                    </>
                  )}

                  {r.status === "break" && (
                    <span className="text-teacher">
                      үзіліс{left !== null ? ` · ${Math.max(0, left)} мин` : ""}
                    </span>
                  )}

                  {r.status === "finished" && <span className="text-parent">аяқтады</span>}
                </span>
              </button>

              {openId === r.registration_id && (
                <div className="mt-1 rounded-xl border border-ink/10 bg-parchment px-4 py-3">
                  <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ink/40">
                    Оқиғалар журналы
                  </p>
                  {events.length === 0 ? (
                    <p className="text-xs text-ink/40">Жазба жоқ.</p>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {events.map((e) => (
                        <li key={e.id} className="flex gap-3 text-xs">
                          <span className="font-mono text-ink/50">{timeOnly(e.created_at)}</span>
                          <span className="text-ink/70">
                            {EVENT_LABELS[e.event] ?? e.event}
                            {e.subject
                              ? ` — ${SUBJECT_LABELS[e.subject as SubjectKey] ?? e.subject}`
                              : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {r.deadline_at && (
                    <p className="mt-2 font-mono text-[11px] text-ink/40">
                      Жеке шекті уақыт: {timeOnly(r.deadline_at)}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
