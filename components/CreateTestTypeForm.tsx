"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

type Stage = {
  subject: string;
  questions: string;
  minutes: string;
  format: "abcd" | "number";
};

const emptyStage: Stage = { subject: "", questions: "", minutes: "", format: "abcd" };

const scoringOptions = [
  { value: "simple", label: "Қарапайым (+1 дұрыс жауапқа) / Простая (+1 за верный)" },
  { value: "penalty", label: "Айыппұлмен (+4/-1/0) / Штрафная (+4/-1/0)" },
  { value: "difficulty", label: "Күрделілік бойынша / По сложности" },
  { value: "adaptive", label: "Бейімделген (сирек дұрыс — көбірек ұпай) / Адаптивная" },
];

export default function CreateTestTypeForm({ onCreated }: { onCreated: () => void }) {
  const [code, setCode] = useState("");
  const [nameKk, setNameKk] = useState("");
  const [nameRu, setNameRu] = useState("");
  const [scoringScheme, setScoringScheme] = useState("simple");
  const [stages, setStages] = useState<Stage[]>([{ ...emptyStage }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  function updateStage(index: number, patch: Partial<Stage>) {
    setStages((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s))
    );
  }

  function addStage() {
    setStages((prev) => [...prev, { ...emptyStage }]);
  }

  function removeStage(index: number) {
    setStages((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(false);

    const stagesJson = stages.map((s) => ({
      subject: s.subject,
      questions: Number(s.questions),
      minutes: Number(s.minutes),
      format: s.format,
    }));

    const { error } = await supabase.from("test_types").insert({
      code: code.toUpperCase(),
      name_kk: nameKk,
      name_ru: nameRu,
      stages: stagesJson,
      scoring_scheme: scoringScheme,
    });

    setLoading(false);
    if (error) {
      setError(true);
      return;
    }

    setCode("");
    setNameKk("");
    setNameRu("");
    setScoringScheme("simple");
    setStages([{ ...emptyStage }]);
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border border-ink/10 bg-white p-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <input
          required
          placeholder="Код (мыс. TEXSCHOOL)"
          className="focus-ring rounded-xl border border-ink/15 px-3 py-2 text-sm"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <input
          required
          placeholder="Атауы (қазақша)"
          className="focus-ring rounded-xl border border-ink/15 px-3 py-2 text-sm"
          value={nameKk}
          onChange={(e) => setNameKk(e.target.value)}
        />
        <input
          required
          placeholder="Название (русский)"
          className="focus-ring rounded-xl border border-ink/15 px-3 py-2 text-sm"
          value={nameRu}
          onChange={(e) => setNameRu(e.target.value)}
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-ink/70">Кезеңдер / Этапы</p>
        <div className="flex flex-col gap-2">
          {stages.map((stage, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 rounded-xl bg-parchment p-3 sm:grid-cols-5">
              <input
                required
                placeholder="Пән / Предмет"
                className="focus-ring rounded-lg border border-ink/15 px-2 py-1.5 text-sm sm:col-span-2"
                value={stage.subject}
                onChange={(e) => updateStage(i, { subject: e.target.value })}
              />
              <input
                required
                type="number"
                placeholder="Сұрақ саны"
                className="focus-ring rounded-lg border border-ink/15 px-2 py-1.5 text-sm"
                value={stage.questions}
                onChange={(e) => updateStage(i, { questions: e.target.value })}
              />
              <input
                required
                type="number"
                placeholder="Минут"
                className="focus-ring rounded-lg border border-ink/15 px-2 py-1.5 text-sm"
                value={stage.minutes}
                onChange={(e) => updateStage(i, { minutes: e.target.value })}
              />
              <div className="flex gap-1">
                <select
                  className="focus-ring w-full rounded-lg border border-ink/15 px-2 py-1.5 text-sm"
                  value={stage.format}
                  onChange={(e) =>
                    updateStage(i, { format: e.target.value as "abcd" | "number" })
                  }
                >
                  <option value="abcd">АВСД</option>
                  <option value="number">Сан / Число</option>
                </select>
                {stages.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeStage(i)}
                    className="focus-ring rounded-lg border border-ink/15 px-2 text-ink/50 hover:bg-white"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addStage}
          className="focus-ring mt-2 rounded-full border border-ink/15 px-4 py-1.5 text-sm font-medium text-ink/70 hover:bg-parchment"
        >
          + Кезең қосу
        </button>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-ink/70">
          Ұпай санау тәсілі / Схема подсчёта
        </p>
        <select
          className="focus-ring w-full rounded-xl border border-ink/15 px-3 py-2 text-sm"
          value={scoringScheme}
          onChange={(e) => setScoringScheme(e.target.value)}
        >
          {scoringOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-red-600">Қате шықты, қайта көріңіз.</p>}

      <button
        type="submit"
        disabled={loading}
        className="focus-ring self-start rounded-full bg-admin px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        Тест түрін құру
      </button>
    </form>
  );
}
