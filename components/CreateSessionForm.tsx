"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

type TestType = { id: string; code: string; name_kk: string; name_ru: string };

export default function CreateSessionForm({
  testTypes,
  onCreated,
}: {
  testTypes: TestType[];
  onCreated: () => void;
}) {
  const [titleKk, setTitleKk] = useState("");
  const [titleRu, setTitleRu] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [address, setAddress] = useState("");
  const [price, setPrice] = useState("");
  const [registrationOpensAt, setRegistrationOpensAt] = useState("");
  const [registrationClosesAt, setRegistrationClosesAt] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  function toggleType(id: string) {
    setSelectedTypes((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(false);

    const { data: session, error: sessionError } = await supabase
      .from("test_sessions")
      .insert({
        title_kk: titleKk,
        title_ru: titleRu,
        session_date: sessionDate,
        start_time: startTime || null,
        address: address || null,
        price: Number(price),
        registration_opens_at: registrationOpensAt || null,
        registration_closes_at: registrationClosesAt || null,
        is_active: true,
      })
      .select()
      .single();

    if (sessionError || !session) {
      setError(true);
      setLoading(false);
      return;
    }

    const links = selectedTypes.map((typeId) => ({
      test_session_id: session.id,
      test_type_id: typeId,
    }));

    const { error: linkError } = await supabase
      .from("session_test_types")
      .insert(links);

    setLoading(false);
    if (linkError) {
      setError(true);
      return;
    }

    setTitleKk("");
    setTitleRu("");
    setSessionDate("");
    setStartTime("");
    setAddress("");
    setPrice("");
    setRegistrationOpensAt("");
    setRegistrationClosesAt("");
    setSelectedTypes([]);
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-white p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          required
          placeholder="Атауы (қазақша) — Қазан айы байқау тесті"
          className="focus-ring rounded-xl border border-ink/15 px-3 py-2 text-sm"
          value={titleKk}
          onChange={(e) => setTitleKk(e.target.value)}
        />
        <input
          required
          placeholder="Название (русский) — Пробный тест октября"
          className="focus-ring rounded-xl border border-ink/15 px-3 py-2 text-sm"
          value={titleRu}
          onChange={(e) => setTitleRu(e.target.value)}
        />
        <input
          required
          type="date"
          className="focus-ring rounded-xl border border-ink/15 px-3 py-2 text-sm"
          value={sessionDate}
          onChange={(e) => setSessionDate(e.target.value)}
        />
        <input
          type="time"
          placeholder="Басталу уақыты"
          className="focus-ring rounded-xl border border-ink/15 px-3 py-2 text-sm"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
        />
        <input
          placeholder="Мекенжайы / Адрес"
          className="focus-ring rounded-xl border border-ink/15 px-3 py-2 text-sm sm:col-span-2"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
        <input
          required
          type="number"
          placeholder="Баға / Цена (₸)"
          className="focus-ring rounded-xl border border-ink/15 px-3 py-2 text-sm"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink/50">
            Тіркеу басталады
          </label>
          <input
            type="datetime-local"
            className="focus-ring w-full rounded-xl border border-ink/15 px-3 py-2 text-sm"
            value={registrationOpensAt}
            onChange={(e) => setRegistrationOpensAt(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink/50">
            Тіркеу аяқталады
          </label>
          <input
            type="datetime-local"
            className="focus-ring w-full rounded-xl border border-ink/15 px-3 py-2 text-sm"
            value={registrationClosesAt}
            onChange={(e) => setRegistrationClosesAt(e.target.value)}
          />
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-ink/70">
          Экзамен түрлері / Виды экзаменов
        </p>
        <div className="flex flex-wrap gap-2">
          {testTypes.length === 0 && (
            <p className="text-xs text-ink/50">
              Әзірге тест түрі жоқ. Оны қосу үшін Android қолданбасын пайдаланыңыз.
            </p>
          )}
          {testTypes.map((tt) => (
            <button
              type="button"
              key={tt.id}
              onClick={() => toggleType(tt.id)}
              className={`focus-ring rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                selectedTypes.includes(tt.id)
                  ? "border-admin bg-admin text-white"
                  : "border-ink/15 bg-white text-ink/70"
              }`}
            >
              {tt.name_kk} / {tt.name_ru}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">Қате шықты, қайта көріңіз.</p>}

      <button
        type="submit"
        disabled={loading}
        className="focus-ring mt-2 self-start rounded-full bg-admin px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        Сессия құру
      </button>
    </form>
  );
}
