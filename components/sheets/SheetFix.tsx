"use client";

import { useMemo, useState } from "react";
import type { OvalSpot, RowAnswer } from "@/lib/sheets/read";
import type { SubjectKey } from "@/lib/questions/subjects";

/**
 * Оқылғанды түзету: әр дөңгелек суреттен бөлек қиылып көрсетіледі,
 * басқанда белгі қойылады не алынады.
 *
 * Қиынды — сызу емес: машина сәл қате орналастырса да, дөңгелек терезеде
 * толық көрінеді, ал админ баланың нақты не бояғанын өз көзімен көреді.
 *
 * Жол нөмірінің түсі: сары — екі белгі (0 ұпай), қызыл — бос, қызғылт
 * фон — машина күмәнданған жол.
 */

const LETTERS = ["A", "B", "C", "D"];
const ROOMY = 1.6;

const SUBJECT_SHORT: Partial<Record<SubjectKey, string>> = {
  math: "Математика", sandyq: "Сандық", zharatylystanu: "Жаратылыстану", tilder: "Тілдер", bil: "БИЛ",
};

export function SheetFix({ shot, width, height, ovals, answers, onDone, onCancel }: {
  shot: string;
  width: number;
  height: number;
  ovals: OvalSpot[];
  answers: RowAnswer[];
  onDone: (answers: RowAnswer[]) => void;
  onCancel: () => void;
}) {
  const subjects = useMemo(() => [...new Set(answers.map((a) => a.subject))], [answers]);
  const [at, setAt] = useState(0);
  const [onlyDoubt, setOnlyDoubt] = useState(answers.some((a) => a.doubtful));
  const [picked, setPicked] = useState<Map<string, number[]>>(
    () => new Map(answers.map((a) => [`${a.subject}|${a.question}`, [...a.letters]])),
  );
  const doubt = useMemo(
    () => new Set(answers.filter((a) => a.doubtful).map((a) => `${a.subject}|${a.question}`)),
    [answers],
  );
  const subject = subjects[at] ?? subjects[0];

  const rows = useMemo(() => {
    const out = new Map<number, OvalSpot[]>();
    for (const one of ovals) {
      if (one.subject !== subject) continue;
      if (onlyDoubt && !doubt.has(`${one.subject}|${one.question}`)) continue;
      if (!out.has(one.question)) out.set(one.question, []);
      out.get(one.question)!.push(one);
    }
    out.forEach((list) => list.sort((a, b) => a.letter - b.letter));
    return [...out.entries()].sort((a, b) => a[0] - b[0]);
  }, [ovals, subject, onlyDoubt, doubt]);

  const flip = (question: number, letter: number) => {
    const key = `${subject}|${question}`;
    setPicked((was) => {
      const out = new Map(was);
      const list = new Set(out.get(key) ?? []);
      if (list.has(letter)) list.delete(letter); else list.add(letter);
      out.set(key, [...list].sort());
      return out;
    });
  };

  const finish = () => {
    onDone(answers.map((a) => ({
      ...a, letters: picked.get(`${a.subject}|${a.question}`) ?? [], doubtful: false,
    })));
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black">
      <div className="flex flex-wrap items-center gap-2 bg-black/90 p-2">
        {subjects.map((one, k) => (
          <button key={one} onClick={() => setAt(k)}
                  className={`min-h-10 rounded-xl px-3 text-xs ${k === at ? "bg-white text-ink" : "border border-white/40 text-white"}`}>
            {SUBJECT_SHORT[one] ?? one}
          </button>
        ))}
        <label className="flex items-center gap-1 text-xs text-white">
          <input type="checkbox" checked={onlyDoubt} onChange={(e) => setOnlyDoubt(e.target.checked)} />
          Тек күмәнділер ({doubt.size})
        </label>
        <span className="flex-1" />
        <button onClick={onCancel} className="min-h-10 rounded-xl border border-white/40 px-3 text-sm text-white">
          Болдырмау
        </button>
        <button onClick={finish} className="min-h-10 rounded-xl bg-green-600 px-4 text-sm font-semibold text-white">
          Дайын
        </button>
      </div>
      <p className="bg-black/90 px-3 pb-2 text-xs text-white/70">
        Дөңгелекті басыңыз — белгі қойылады немесе алынады. Екі белгі қалса, сұрақ қате саналады.
      </p>

      <div className="mx-auto min-h-0 w-full max-w-md flex-1 overflow-y-auto bg-white">
        <div className="sticky top-0 z-10 flex gap-1 border-b border-ink/10 bg-white px-2 py-1">
          <span className="w-8 shrink-0" />
          {LETTERS.map((l) => (
            <span key={l} className="flex-1 text-center text-xs font-semibold text-ink/50">{l}</span>
          ))}
        </div>
        {rows.length === 0 && (
          <p className="p-4 text-sm text-ink/50">Бұл пәнде күмәнді жол жоқ.</p>
        )}
        {rows.map(([question, list]) => {
          const mine = picked.get(`${subject}|${question}`) ?? [];
          const isDoubt = doubt.has(`${subject}|${question}`);
          return (
            <div key={question}
                 className={`flex items-center gap-1 border-b border-ink/5 px-2 py-0.5 ${isDoubt ? "bg-pink-50" : ""}`}>
              <span className={`w-8 shrink-0 text-right text-xs ${
                mine.length > 1 ? "font-bold text-amber-600" : mine.length === 0 ? "font-bold text-red-600" : "text-ink/50"}`}>
                {question}
              </span>
              {list.map((one) => {
                const on = mine.includes(one.letter);
                const boxW = one.rx * 2 * ROOMY, boxH = one.ry * 2 * ROOMY;
                const posX = (100 * (one.x - boxW / 2)) / Math.max(1, width - boxW);
                const posY = (100 * (one.y - boxH / 2)) / Math.max(1, height - boxH);
                return (
                  <button key={one.letter} type="button" onClick={() => flip(question, one.letter)}
                          aria-label={`${question} ${LETTERS[one.letter]}`}
                          className={`relative flex-1 overflow-hidden rounded border ${on ? "border-green-600 ring-2 ring-green-600" : "border-ink/15"}`}
                          style={{ aspectRatio: `${boxW} / ${boxH}` }}>
                    <span className="absolute inset-0" style={{
                      backgroundImage: `url(${shot})`,
                      backgroundSize: `${(width / boxW) * 100}% ${(height / boxH) * 100}%`,
                      backgroundPosition: `${posX}% ${posY}%`,
                      backgroundRepeat: "no-repeat",
                    }} />
                    {on && (
                      <svg viewBox="0 0 20 20" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden>
                        <path d="M2 2 L18 18 M18 2 L2 18" fill="none" stroke="#16a34a" strokeWidth={2} strokeLinecap="round" opacity={0.85} />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
