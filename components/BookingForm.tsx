"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { SessionDetail } from "@/lib/sessions";

type Student = { id: string; full_name: string };

export default function BookingForm({
  session,
  students,
  parentId,
  onClose,
  onBooked,
}: {
  session: SessionDetail;
  students: Student[];
  parentId: string;
  onClose: () => void;
  onBooked: () => void;
}) {
  const [studentId, setStudentId] = useState("");
  const [testTypeId, setTestTypeId] = useState("");
  const [format, setFormat] = useState<"offline" | "online">("offline");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(false);

    const { error } = await supabase.from("registrations").insert({
      parent_id: parentId,
      student_id: studentId,
      test_session_id: session.id,
      test_type_id: testTypeId,
      format,
      payment_status: "pending",
    });

    setLoading(false);
    if (error) {
      setError(true);
      return;
    }
    onBooked();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6">
        <h2 className="font-display text-lg font-bold text-ink">
          {session.titleKk} / {session.titleRu}
        </h2>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink/70">Оқушы</label>
            <select
              required
              className="focus-ring w-full rounded-xl border border-ink/15 px-3 py-2 text-sm"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
            >
              <option value="">Таңдаңыз</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
            {students.length === 0 && (
              <p className="mt-1 text-xs text-ink/50">
                Алдымен &quot;Ученик&quot; бөлімінде баланы қосыңыз.
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink/70">Тест түрі</label>
            <select
              required
              className="focus-ring w-full rounded-xl border border-ink/15 px-3 py-2 text-sm"
              value={testTypeId}
              onChange={(e) => setTestTypeId(e.target.value)}
            >
              <option value="">Таңдаңыз</option>
              {session.testTypes.map((tt) => (
                <option key={tt.id} value={tt.id}>
                  {tt.nameKk} / {tt.nameRu} — {tt.price.toLocaleString("ru-RU")} ₸
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink/70">Формат</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFormat("offline")}
                className={`focus-ring flex-1 rounded-xl border px-3 py-2 text-sm font-medium ${
                  format === "offline"
                    ? "border-parent bg-parent-soft text-parent"
                    : "border-ink/15 text-ink/70"
                }`}
              >
                Офлайн
              </button>
              <button
                type="button"
                onClick={() => setFormat("online")}
                className={`focus-ring flex-1 rounded-xl border px-3 py-2 text-sm font-medium ${
                  format === "online"
                    ? "border-parent bg-parent-soft text-parent"
                    : "border-ink/15 text-ink/70"
                }`}
              >
                Онлайн
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">Қате шықты, қайта көріңіз.</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="focus-ring flex-1 rounded-full border border-ink/15 px-4 py-2.5 text-sm font-semibold text-ink hover:bg-ink/5"
            >
              Бас тарту
            </button>
            <button
              type="submit"
              disabled={loading || students.length === 0}
              className="focus-ring flex-1 rounded-full bg-parent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              Брондау
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
