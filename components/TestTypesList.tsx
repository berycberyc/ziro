"use client";

import { useState } from "react";

type Stage = { subject: string; questions: number; minutes: number; format: string };
type TestType = {
  id: string;
  code: string;
  name_kk: string;
  name_ru: string;
  stages: Stage[];
  scoring_scheme: string;
};

export default function TestTypesList({
  testTypes,
  onEdit,
  onDelete,
}: {
  testTypes: TestType[];
  onEdit: (tt: TestType) => void;
  onDelete: (id: string) => void;
}) {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  if (testTypes.length === 0) {
    return <p className="text-sm text-ink/50">Әзірге тест түрі жоқ.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {testTypes.map((tt) => (
        <div key={tt.id} className="rounded-xl border border-ink/10 bg-white px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="font-medium text-ink">
              {tt.name_kk} / {tt.name_ru}
            </span>
            <div className="flex items-center gap-3">
              <span className="text-xs text-ink/40">{tt.code}</span>
              <button
                onClick={() => onEdit(tt)}
                className="focus-ring rounded-full border border-admin/30 px-3 py-1 text-xs font-semibold text-admin hover:bg-admin-soft"
              >
                Өзгерту
              </button>
              <button
                onClick={() => setPendingDeleteId(tt.id)}
                className="focus-ring rounded-full border border-red-300 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
              >
                Өшіру
              </button>
            </div>
          </div>
          <p className="mt-1 text-sm text-ink/50">
            {tt.stages.map((s) => `${s.subject} (${s.questions})`).join(" · ")}
          </p>

          {pendingDeleteId === tt.id && (
            <div className="mt-3 flex items-center justify-between rounded-xl bg-red-50 px-3 py-2">
              <span className="text-sm text-red-700">Жою керек пе? Бұл әрекетті қайтару мүмкін емес.</span>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    onDelete(tt.id);
                    setPendingDeleteId(null);
                  }}
                  className="focus-ring rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700"
                >
                  Иә, өшіру
                </button>
                <button
                  onClick={() => setPendingDeleteId(null)}
                  className="focus-ring rounded-full border border-ink/15 px-3 py-1 text-xs font-semibold text-ink hover:bg-white"
                >
                  Бас тарту
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
