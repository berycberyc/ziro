"use client";

import { useState } from "react";
import { PROFILES } from "@/lib/docxTest/profiles";

export default function OnlineTestPage() {
  const [nameWord, setNameWord] = useState("");
  const [profileId, setProfileId] = useState(PROFILES[0].id);
  const [lang, setLang] = useState<"kk" | "ru">("kk");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedProfile = PROFILES.find((p) => p.id === profileId);
  const isDisabledProfile = selectedProfile?.answerFormat === "quantity";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Файлды таңдаңыз.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name_word", nameWord);
      formData.append("profile_id", profileId);
      formData.append("lang", lang);

      const res = await fetch("/api/admin/generate-test-variants", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Қате шықты.");
        setLoading(false);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${nameWord || "variants"}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message ?? "Қате шықты.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-admin">Онлайн тест</h1>
      <p className="mt-2 text-sm text-ink/60">
        .docx файлын жүктеңіз — жүйе 4 нұсқаны (сұрақтар мен жауаптар аралас) автоматты түрде
        жасайды, әр файлдың соңында жауаптар кілті болады.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex max-w-lg flex-col gap-4 rounded-2xl border border-ink/10 bg-white p-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink/70">Атауы (NAME_WORD)</label>
          <input
            required
            placeholder="Мысалы: Математика"
            value={nameWord}
            onChange={(e) => setNameWord(e.target.value)}
            className="focus-ring w-full rounded-xl border border-ink/15 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink/70">Профиль</label>
          <select
            value={profileId}
            onChange={(e) => setProfileId(e.target.value)}
            className="focus-ring w-full rounded-xl border border-ink/15 px-3 py-2 text-sm"
          >
            {PROFILES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          {isDisabledProfile && (
            <p className="mt-1 text-xs font-medium text-red-600">
              Бұл профиль әзірге қолжетімсіз — жақын арада қосылады.
            </p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink/70">
            Колонтитул тілі (Нұсқа / Вариант)
          </label>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as "kk" | "ru")}
            className="focus-ring w-full rounded-xl border border-ink/15 px-3 py-2 text-sm"
          >
            <option value="kk">Қазақша (Нұсқа)</option>
            <option value="ru">Русский (Вариант)</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink/70">.docx файлы</label>
          <input
            type="file"
            accept=".docx"
            required
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="focus-ring block w-full rounded-xl border border-ink/15 px-3 py-2 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-admin-soft file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-admin"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading || isDisabledProfile}
          className="focus-ring self-start rounded-full bg-admin px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Жасалуда..." : "4 нұсқа жасау"}
        </button>
      </form>
    </div>
  );
}
