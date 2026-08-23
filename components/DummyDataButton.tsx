"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { REGIONS } from "@/lib/kzRegions";

const FIRST_NAMES = ["Айбек", "Динара", "Ерлан", "Жанна", "Мадина", "Нурлан", "Сая", "Тимур", "Аружан", "Бекзат"];
const LAST_NAMES = ["Ахметов", "Бекова", "Ермеков", "Жаксыбекова", "Касымов", "Молдабекова", "Нурланов", "Сериков"];
const SCHOOLS = ["№1 мектеп", "№5 мектеп", "№12 мектеп", "Дарын гимназиясы"];

export default function DummyDataButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleCreate() {
    setLoading(true);
    setError("");
    setMessage("");

    // A separate, isolated client with its own storage key — signUp()
    // never touches the admin's own session in localStorage this way.
    const isolatedClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { storageKey: "ziro-dummy-test-session", persistSession: false } }
    );

    const fakeEmail = `test-parent-${Date.now()}@example.invalid`;
    const fakePassword = Math.random().toString(36).slice(2) + "Aa1!";

    const { data: signUpData, error: signUpError } = await isolatedClient.auth.signUp({
      email: fakeEmail,
      password: fakePassword,
      options: { data: { first_name: "Тест", last_name: "Ата-ана", phone: "+77000000000" } },
    });

    if (signUpError || !signUpData.user) {
      setError("Тест ата-анасын құру мүмкін болмады: " + (signUpError?.message ?? "белгісіз қате"));
      setLoading(false);
      return;
    }

    const parentId = signUpData.user.id;
    const region = REGIONS[Math.floor(Math.random() * REGIONS.length)];

    const students = Array.from({ length: 100 }, (_, i) => {
      const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
      const lastName = LAST_NAMES[i % LAST_NAMES.length];
      const city = region.cities[i % region.cities.length];
      return {
        parent_id: parentId,
        first_name: firstName,
        last_name: `${lastName} ${i + 1}`,
        full_name: `${firstName} ${lastName} ${i + 1}`,
        gender: i % 2 === 0 ? "male" : "female",
        grade: i % 2 === 0 ? "5" : "6",
        region: region.name_kk,
        city: city.kk,
        school: SCHOOLS[i % SCHOOLS.length],
        language: i % 3 === 0 ? "ru" : "kk",
      };
    });

    // Uses the admin's own (real) supabase client to insert — this table
    // write doesn't depend on being logged in as the fake parent.
    const { error: insertError } = await supabase.from("students").insert(students);

    setLoading(false);
    if (insertError) {
      setError("Оқушыларды құру кезінде қате: " + insertError.message);
      return;
    }

    setMessage(`Дайын: тест ата-анасы (${fakeEmail}) және 100 оқушы құрылды.`);
  }

  return (
    <div className="rounded-2xl border border-dashed border-ink/20 bg-ink/5 p-5">
      <p className="text-sm font-semibold text-ink/70">Тест деректері (әзірлеу үшін)</p>
      <p className="mt-1 text-xs text-ink/50">
        Толық тіркеу→тест→нәтиже ағынын тексеру үшін бір тест ата-анасы мен 100 тест оқушысын құрады.
      </p>
      <button
        onClick={handleCreate}
        disabled={loading}
        className="focus-ring mt-3 rounded-full border border-ink/20 bg-white px-5 py-2 text-sm font-semibold text-ink/70 hover:bg-ink/5 disabled:opacity-50"
      >
        {loading ? "Құрылуда..." : "100 тест оқушысын құру"}
      </button>
      {message && <p className="mt-2 text-sm text-parent">{message}</p>}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
