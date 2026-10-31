"use client";

import { useState } from "react";
import type { RfmshAnswer } from "@/lib/sheets/rfmsh";

/**
 * РФМШ парағын түзету: әр жолдың суреті (сол жолдың өзі қиылған) және
 * қасында машина оқыған сан. Сан дұрыс болмаса — жөндеп жазасыз.
 * Күмәнді жолдар қызғылт фонмен, жоғарыда тұрады.
 */
export function RfmshFix({ shot, width, height, numbers, onDone, onCancel }: {
  shot: string;
  width: number;
  height: number;
  numbers: RfmshAnswer[];
  onDone: (numbers: RfmshAnswer[]) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<string[]>(() => numbers.map((n) => n.value));
  const [onlyDoubt, setOnlyDoubt] = useState(numbers.some((n) => n.unsure));
  const shown = numbers
    .map((n, i) => ({ n, i }))
    .filter(({ n }) => !onlyDoubt || n.unsure);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black">
      <div className="flex flex-wrap items-center gap-2 bg-black/90 p-2">
        <label className="flex items-center gap-1 text-xs text-white">
          <input type="checkbox" checked={onlyDoubt} onChange={(e) => setOnlyDoubt(e.target.checked)} />
          Тек күмәнділер ({numbers.filter((n) => n.unsure).length})
        </label>
        <span className="flex-1" />
        <button onClick={onCancel} className="min-h-10 rounded-xl border border-white/40 px-3 text-sm text-white">
          Болдырмау
        </button>
        <button
          onClick={() => onDone(numbers.map((n, i) => ({ ...n, value: values[i].replace(/\D/g, "").slice(0, 7), unsure: false })))}
          className="min-h-10 rounded-xl bg-green-600 px-4 text-sm font-semibold text-white">
          Дайын
        </button>
      </div>
      <p className="bg-black/90 px-3 pb-2 text-xs text-white/70">
        Суреттегі санды тексеріңіз. Қате болса — дұрысын жазыңыз. Бос жол — жауап жоқ.
      </p>
      <div className="mx-auto min-h-0 w-full max-w-xl flex-1 overflow-y-auto bg-white">
        {shown.length === 0 && <p className="p-4 text-sm text-ink/50">Күмәнді жол жоқ.</p>}
        {shown.map(({ n, i }) => {
          const b = n.box;
          return (
            <div key={n.question} className={`border-b border-ink/5 px-2 py-2 ${n.unsure ? "bg-pink-50" : ""}`}>
              <div className="relative w-full overflow-hidden rounded border border-ink/10"
                   style={{ aspectRatio: `${Math.max(1, b.w)} / ${Math.max(1, b.h)}` }}>
                <span className="absolute inset-0" style={{
                  backgroundImage: `url(${shot})`,
                  backgroundSize: `${(width / Math.max(1, b.w)) * 100}% ${(height / Math.max(1, b.h)) * 100}%`,
                  backgroundPosition: `${(100 * b.x) / Math.max(1, width - b.w)}% ${(100 * b.y) / Math.max(1, height - b.h)}%`,
                  backgroundRepeat: "no-repeat",
                }} />
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="w-8 text-right font-mono text-sm font-semibold text-ink/50">{n.question}</span>
                <input
                  value={values[i]}
                  inputMode="numeric"
                  maxLength={7}
                  onChange={(e) => setValues((was) => was.map((v, k) => (k === i ? e.target.value.replace(/\D/g, "") : v)))}
                  className="font-segment w-40 rounded-md border border-ink/15 px-3 py-1 text-lg tracking-[0.2em]"
                />
                {n.unsure && <span className="text-xs text-pink-700">машина сенімсіз</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
