"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useLang } from "@/lib/LangContext";
import EditStudentForm from "./EditStudentForm";

type Student = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string;
  gender: string | null;
  grade: string | null;
  region: string | null;
  city: string | null;
  school: string | null;
  iin: string | null;
  language: string | null;
  photo_url: string | null;
  zipgrade_id: string | null;
};

export default function StudentList({
  students,
  parentId,
  onChanged,
}: {
  students: Student[];
  parentId: string;
  onChanged: () => void;
}) {
  const { t } = useLang();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete(id: string) {
    setDeleting(true);
    await supabase.from("students").delete().eq("id", id);
    setDeleting(false);
    setConfirmingDeleteId(null);
    onChanged();
  }

  if (students.length === 0) {
    return <p className="text-sm text-ink/50">{t.noChildren}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {students.map((s) =>
        editingId === s.id ? (
          <EditStudentForm
            key={s.id}
            student={s}
            parentId={parentId}
            onSaved={() => {
              setEditingId(null);
              onChanged();
            }}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <div
            key={s.id}
            className="flex flex-wrap items-center gap-3 rounded-2xl border border-ink/10 bg-white px-4 py-3.5 shadow-sm transition-shadow hover:shadow-md"
          >
            {s.photo_url ? (
              <img
                src={s.photo_url}
                alt={s.full_name}
                className="h-11 w-11 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-parent-soft font-display text-sm font-bold text-parent">
                {s.first_name?.[0] ?? s.full_name?.[0] ?? "?"}
              </div>
            )}
            <div className="flex-1">
              <span className="font-display font-semibold text-ink">{s.full_name}</span>
              <span className="ml-2 font-mono text-xs text-ink/40">#{s.zipgrade_id ?? "—"}</span>
              <div className="text-sm text-ink/50">
                {[s.grade, s.city, s.school].filter(Boolean).join(" · ")}
              </div>
            </div>

            {confirmingDeleteId === s.id ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-600">{t.confirmDelete}</span>
                <button
                  onClick={() => handleDelete(s.id)}
                  disabled={deleting}
                  className="focus-ring rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {t.yes}
                </button>
                <button
                  onClick={() => setConfirmingDeleteId(null)}
                  className="focus-ring rounded-full border border-ink/15 px-3 py-1.5 text-xs text-ink/60"
                >
                  {t.no}
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingId(s.id)}
                  className="focus-ring rounded-full border border-ink/15 px-3 py-1.5 text-xs font-semibold text-ink/70 hover:bg-ink/5"
                >
                  {t.edit}
                </button>
                <button
                  onClick={() => setConfirmingDeleteId(s.id)}
                  className="focus-ring rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                >
                  {t.delete}
                </button>
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}
