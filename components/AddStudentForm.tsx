"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AddStudentForm({
  parentId,
  onAdded,
}: {
  parentId: string;
  onAdded: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [grade, setGrade] = useState("");
  const [school, setSchool] = useState("");
  const [iin, setIin] = useState("");
  const [language, setLanguage] = useState("kk");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(false);
    const { error } = await supabase.from("students").insert({
      parent_id: parentId,
      full_name: fullName,
      grade,
      school,
      iin,
      language,
    });
    setLoading(false);
    if (error) {
      setError(true);
      return;
    }
    setFullName("");
    setGrade("");
    setSchool("");
    setIin("");
    onAdded();
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 rounded-2xl border border-ink/10 bg-white p-5 sm:grid-cols-2">
      <input
        required
        placeholder="Аты-жөні"
        className="focus-ring rounded-xl border border-ink/15 px-3 py-2 text-sm"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
      />
      <input
        placeholder="Сынып"
        className="focus-ring rounded-xl border border-ink/15 px-3 py-2 text-sm"
        value={grade}
        onChange={(e) => setGrade(e.target.value)}
      />
      <input
        placeholder="Мектеп"
        className="focus-ring rounded-xl border border-ink/15 px-3 py-2 text-sm"
        value={school}
        onChange={(e) => setSchool(e.target.value)}
      />
      <input
        placeholder="ИИН"
        className="focus-ring rounded-xl border border-ink/15 px-3 py-2 text-sm"
        value={iin}
        onChange={(e) => setIin(e.target.value)}
      />
      <select
        className="focus-ring rounded-xl border border-ink/15 px-3 py-2 text-sm"
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
      >
        <option value="kk">Қазақша</option>
        <option value="ru">Орысша</option>
      </select>
      <div className="sm:col-span-2">
        {error && (
          <p className="mb-2 text-sm text-red-600">Қате шықты, қайта көріңіз.</p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="focus-ring rounded-full bg-parent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          Қосу
        </button>
      </div>
    </form>
  );
}
