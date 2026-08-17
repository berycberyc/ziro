"use client";

import { useLang } from "@/lib/LangContext";

type Student = {
  id: string;
  full_name: string;
  grade: string | null;
  school: string | null;
  photo_url?: string | null;
};

export default function StudentList({ students }: { students: Student[] }) {
  const { t } = useLang();

  if (students.length === 0) {
    return <p className="text-sm text-ink/50">{t.noChildren}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {students.map((s) => (
        <div
          key={s.id}
          className="flex items-center gap-3 rounded-xl border border-ink/10 bg-white px-4 py-3"
        >
          {s.photo_url ? (
            <img
              src={s.photo_url}
              alt={s.full_name}
              className="h-10 w-10 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="h-10 w-10 shrink-0 rounded-full bg-parent-soft" />
          )}
          <span className="flex-1 font-medium text-ink">{s.full_name}</span>
          <span className="text-sm text-ink/50">
            {[s.grade, s.school].filter(Boolean).join(" · ")}
          </span>
        </div>
      ))}
    </div>
  );
}
