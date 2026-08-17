"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";

type Registration = {
  id: string;
  format: string;
  payment_status: string;
  classroom: string | null;
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
  is_active: boolean;
  is_checking: boolean;
  has_results: boolean;
};

export default function AdminSessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [importMessage, setImportMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<SessionInfo>>({});
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const load = useCallback(async () => {
    const { data: sessionData } = await supabase
      .from("test_sessions")
      .select(
        "id, title_kk, title_ru, session_date, start_time, address, price, registration_opens_at, registration_closes_at, is_active, is_checking, has_results"
      )
      .eq("id", sessionId)
      .single();
    setSession(sessionData);
    if (sessionData) setForm(sessionData);

    const { data: regs } = await supabase
      .from("registrations")
      .select(
        `
        id, format, payment_status, classroom, test_variant,
        students ( full_name, iin, language ),
        test_types ( name_kk, name_ru )
        `
      )
      .eq("test_session_id", sessionId)
      .order("created_at", { ascending: true });
    setRegistrations((regs as any) ?? []);
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  async function updateSessionField(field: string, value: boolean) {
    await supabase.from("test_sessions").update({ [field]: value }).eq("id", sessionId);
    load();
  }

  async function handleSaveEdit() {
    await supabase
      .from("test_sessions")
      .update({
        title_kk: form.title_kk,
        title_ru: form.title_ru,
        session_date: form.session_date,
        start_time: form.start_time || null,
        address: form.address || null,
        price: Number(form.price),
      })
      .eq("id", sessionId);
    setEditing(false);
    load();
  }

  async function handleDeleteSession() {
    await supabase.from("test_sessions").delete().eq("id", sessionId);
    router.push("/admin/sessions");
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

  function exportExcel() {
    const rows = registrations.map((r) => ({
      ID: r.id,
      "ФИО": r.students?.full_name ?? "",
      "Тип теста": `${r.test_types?.name_kk ?? ""} / ${r.test_types?.name_ru ?? ""}`,
      "Формат": r.format,
      "Язык": r.students?.language ?? "",
      "ИИН": r.students?.iin ?? "",
      "Аудитория": r.classroom ?? "",
      "Вариант": r.test_variant ?? "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Тізім");
    XLSX.writeFile(workbook, `${session?.title_ru ?? "session"}.xlsx`);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportMessage("Жүктелуде...");

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<any>(sheet);

    let updated = 0;
    for (const row of rows) {
      const id = row["ID"];
      const classroom = row["Аудитория"];
      const variant = row["Вариант"];
      if (!id) continue;
      const { error } = await supabase
        .from("registrations")
        .update({
          classroom: classroom != null ? String(classroom) : null,
          test_variant: variant != null ? String(variant) : null,
        })
        .eq("id", id);
      if (!error) updated++;
    }

    setImportMessage(`${updated} жазба жаңартылды.`);
    load();
    e.target.value = "";
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
            onClick={() => setConfirmingDelete(true)}
            className="focus-ring rounded-full border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            Өшіру
          </button>
        </div>
      </div>

      {confirmingDelete && (
        <div className="mt-4 flex items-center justify-between rounded-xl bg-red-50 px-4 py-3">
          <span className="text-sm text-red-700">
            Сессияны өшіру керек пе? Барлық брондаулар да жойылады. Бұл әрекетті қайтару мүмкін емес.
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleDeleteSession}
              className="focus-ring rounded-full bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
            >
              Иә, өшіру
            </button>
            <button
              onClick={() => setConfirmingDelete(false)}
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
          <input
            type="time"
            className="focus-ring rounded-xl border border-ink/15 px-3 py-2 text-sm"
            value={form.start_time ?? ""}
            onChange={(e) => setForm({ ...form, start_time: e.target.value })}
          />
          <input
            className="focus-ring rounded-xl border border-ink/15 px-3 py-2 text-sm sm:col-span-2"
            placeholder="Мекенжайы"
            value={form.address ?? ""}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
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

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => updateSessionField("is_active", !session.is_active)}
          className={`focus-ring rounded-full border px-4 py-2 text-sm font-medium ${
            session.is_active ? "border-admin bg-admin text-white" : "border-ink/15 text-ink/70"
          }`}
        >
          Тіркеу ашық: {session.is_active ? "Иә" : "Жоқ"}
        </button>
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
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          onClick={exportExcel}
          className="focus-ring rounded-full bg-admin px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          Excel-ге жүктеу
        </button>
        <label className="focus-ring cursor-pointer rounded-full border border-admin px-5 py-2.5 text-sm font-semibold text-admin hover:bg-admin-soft">
          Excel-ден жүктеу (аудитория/вариант)
          <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
        </label>
      </div>
      {importMessage && <p className="mt-2 text-sm text-ink/60">{importMessage}</p>}

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
