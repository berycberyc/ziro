"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fromAstanaParts, toAstanaParts } from "@/lib/olympiad/time";
import { Card, Msg, inputCls, primaryBtn, useL } from "@/components/olympiad/ui";

export type OlympiadRow = {
  text1_kk: string;
  text1_ru: string;
  text2_kk: string;
  text2_ru: string;
  registration_open: boolean;
  registration_closes_at: string | null;
  starts_at: string | null;
  ends_at: string | null;
  max_leaves: number | null;
  results_published_at: string | null;
};

export default function TeacherSettings({
  olympiad,
  onSaved,
}: {
  olympiad: OlympiadRow;
  onSaved: () => void;
}) {
  const { L } = useL();
  const [form, setForm] = useState(() => toForm(olympiad));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => setForm(toForm(olympiad)), [olympiad]);

  const started = olympiad.starts_at ? new Date(olympiad.starts_at).getTime() <= Date.now() : false;

  function set<K extends keyof ReturnType<typeof toForm>>(k: K, v: ReturnType<typeof toForm>[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const startsAt = fromAstanaParts(form.date, form.startTime);
    const endsAt = fromAstanaParts(form.date, form.endTime);
    const closesAt = fromAstanaParts(form.closeDate, form.closeTime);

    if ((form.date || form.startTime || form.endTime) && (!startsAt || !endsAt)) {
      setMsg({ kind: "err", text: L("Күнін, басталу және аяқталу уақытын толық толтырыңыз.", "Заполните дату, время начала и окончания полностью.") });
      return;
    }
    if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
      setMsg({ kind: "err", text: L("Аяқталу уақыты басталудан кейін болуы керек.", "Время окончания должно быть позже начала.") });
      return;
    }
    if ((form.closeDate || form.closeTime) && !closesAt) {
      setMsg({ kind: "err", text: L("Тіркеудің жабылу күні мен уақытын толық толтырыңыз.", "Заполните дату и время закрытия регистрации полностью.") });
      return;
    }
    const maxLeaves = form.maxLeaves.trim() ? Number(form.maxLeaves) : null;
    if (maxLeaves !== null && (!Number.isInteger(maxLeaves) || maxLeaves < 1)) {
      setMsg({ kind: "err", text: L("Беттен шығу шегі — 1 немесе одан көп бүтін сан, не бос.", "Лимит уходов — целое число от 1 или пусто.") });
      return;
    }

    const patch: Record<string, unknown> = {
      text1_kk: form.text1_kk,
      text1_ru: form.text1_ru,
      text2_kk: form.text2_kk,
      text2_ru: form.text2_ru,
      registration_open: form.registrationOpen,
      registration_closes_at: closesAt,
      max_leaves: maxLeaves,
    };
    if (!started) {
      patch.starts_at = startsAt;
      patch.ends_at = endsAt;
    }

    setSaving(true);
    const { error } = await supabase.from("olympiad").update(patch).eq("id", 1);
    setSaving(false);
    if (error) {
      setMsg({
        kind: "err",
        text: error.message.includes("olympiad_time_locked")
          ? L("Олимпиада басталды — уақытын өзгертуге болмайды.", "Олимпиада началась — время менять нельзя.")
          : L("Сақталмады: ", "Не сохранилось: ") + error.message,
      });
      return;
    }
    setMsg({ kind: "ok", text: L("Сақталды.", "Сохранено.") });
    onSaved();
  }

  return (
    <Card id="settings" title={L("Баптаулар", "Настройки")}>
      <form onSubmit={save} className="flex flex-col gap-5">
        <div>
          <p className="mb-2 text-sm font-semibold text-ink">
            {L("Олимпиада уақыты (Астана уақыты)", "Время олимпиады (время Астаны)")}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs text-ink/60">
              {L("Күні", "Дата")}
              <input type="date" className={inputCls} value={form.date} disabled={started}
                onChange={(e) => set("date", e.target.value)} />
            </label>
            <label className="text-xs text-ink/60">
              {L("Кіру ашылады", "Вход открывается")}
              <input type="time" className={inputCls} value={form.startTime} disabled={started}
                onChange={(e) => set("startTime", e.target.value)} />
            </label>
            <label className="text-xs text-ink/60">
              {L("Аяқталады (бәріне бірдей)", "Заканчивается (у всех одинаково)")}
              <input type="time" className={inputCls} value={form.endTime} disabled={started}
                onChange={(e) => set("endTime", e.target.value)} />
            </label>
          </div>
          <p className="mt-2 text-xs text-ink/50">
            {started
              ? L("Олимпиада басталды — уақыт бекітілді.", "Олимпиада началась — время зафиксировано.")
              : L(
                  "Оқушы осы аралықта кез келген уақытта кіре алады, бірақ бәрі бір уақытта аяқталады. Мысалы, 10:55-те кірсе — 5 минут қалады.",
                  "Ученик может зайти в любой момент этого окна, но закрывается у всех одновременно. Например, зашёл в 10:55 — осталось 5 минут."
                )}
          </p>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-ink">{L("Тіркеу", "Регистрация")}</p>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" className="h-4 w-4" checked={form.registrationOpen}
              onChange={(e) => set("registrationOpen", e.target.checked)} />
            {L("Тіркеу ашық", "Регистрация открыта")}
          </label>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="text-xs text-ink/60">
              {L("Тіркеу жабылатын күн (міндетті емес)", "Дата закрытия регистрации (необязательно)")}
              <input type="date" className={inputCls} value={form.closeDate}
                onChange={(e) => set("closeDate", e.target.value)} />
            </label>
            <label className="text-xs text-ink/60">
              {L("Уақыты", "Время")}
              <input type="time" className={inputCls} value={form.closeTime}
                onChange={(e) => set("closeTime", e.target.value)} />
            </label>
          </div>
          <p className="mt-2 text-xs text-ink/50">
            {L("Олимпиада басталғанда тіркеу өзі жабылады.", "С началом олимпиады регистрация закрывается сама.")}
          </p>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-ink">{L("Беттен шығу", "Уход со страницы")}</p>
          <label className="text-xs text-ink/60">
            {L(
              "Неше рет шықса тест өзі аяқталады (бос — аяқталмайды, тек жазылады)",
              "После скольких уходов тест завершается сам (пусто — не завершается, только записывается)"
            )}
            <input inputMode="numeric" className={`${inputCls} sm:w-40`} value={form.maxLeaves}
              onChange={(e) => set("maxLeaves", e.target.value.replace(/[^\d]/g, ""))} />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs text-ink/60">
            {L("1-мәтін (басты бетте), қазақша", "Текст 1 (на главной), казахский")}
            <textarea rows={6} className={inputCls} value={form.text1_kk} onChange={(e) => set("text1_kk", e.target.value)} />
          </label>
          <label className="text-xs text-ink/60">
            {L("1-мәтін, орысша", "Текст 1, русский")}
            <textarea rows={6} className={inputCls} value={form.text1_ru} onChange={(e) => set("text1_ru", e.target.value)} />
          </label>
          <label className="text-xs text-ink/60">
            {L("2-мәтін (тіркелгеннен кейін), қазақша", "Текст 2 (после регистрации), казахский")}
            <textarea rows={6} className={inputCls} value={form.text2_kk} onChange={(e) => set("text2_kk", e.target.value)} />
          </label>
          <label className="text-xs text-ink/60">
            {L("2-мәтін, орысша", "Текст 2, русский")}
            <textarea rows={6} className={inputCls} value={form.text2_ru} onChange={(e) => set("text2_ru", e.target.value)} />
          </label>
        </div>

        {msg && <Msg kind={msg.kind}>{msg.text}</Msg>}

        <div>
          <button type="submit" disabled={saving} className={primaryBtn}>
            {saving ? L("Сақталуда...", "Сохраняем...") : L("Сақтау", "Сохранить")}
          </button>
        </div>
      </form>
    </Card>
  );
}

function toForm(o: OlympiadRow) {
  const s = toAstanaParts(o.starts_at);
  const e = toAstanaParts(o.ends_at);
  const c = toAstanaParts(o.registration_closes_at);
  return {
    text1_kk: o.text1_kk ?? "",
    text1_ru: o.text1_ru ?? "",
    text2_kk: o.text2_kk ?? "",
    text2_ru: o.text2_ru ?? "",
    registrationOpen: o.registration_open,
    closeDate: c.date,
    closeTime: c.time,
    date: s.date,
    startTime: s.time,
    endTime: e.time,
    maxLeaves: o.max_leaves ? String(o.max_leaves) : "",
  };
}
