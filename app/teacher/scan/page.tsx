"use client";

import { useLang } from "@/lib/LangContext";

export default function TeacherScanPage() {
  const { t } = useLang();

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">{t.teacherScanTitle}</h1>
      <p className="mt-6 text-sm text-ink/50">{t.teacherScanPlaceholder}</p>
    </div>
  );
}
