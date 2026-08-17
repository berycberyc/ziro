"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useLang } from "@/lib/LangContext";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB

export default function AddStudentForm({
  parentId,
  onAdded,
}: {
  parentId: string;
  onAdded: () => void;
}) {
  const { t } = useLang();
  const [fullName, setFullName] = useState("");
  const [grade, setGrade] = useState("");
  const [school, setSchool] = useState("");
  const [iin, setIin] = useState("");
  const [language, setLanguage] = useState("kk");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setError("");
    if (!file) {
      setPhotoFile(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError(t.photoInvalidType);
      e.target.value = "";
      setPhotoFile(null);
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError(t.photoTooLarge);
      e.target.value = "";
      setPhotoFile(null);
      return;
    }
    setPhotoFile(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    let photoUrl: string | null = null;

    if (photoFile) {
      const ext = photoFile.name.split(".").pop();
      const path = `${parentId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("student-photos")
        .upload(path, photoFile, { upsert: false });

      if (uploadError) {
        setError(t.errorGeneric);
        setLoading(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("student-photos")
        .getPublicUrl(path);
      photoUrl = publicUrlData.publicUrl;
    }

    const { error: insertError } = await supabase.from("students").insert({
      parent_id: parentId,
      full_name: fullName,
      grade,
      school,
      iin,
      language,
      photo_url: photoUrl,
    });

    setLoading(false);
    if (insertError) {
      setError(t.errorGeneric);
      return;
    }
    setFullName("");
    setGrade("");
    setSchool("");
    setIin("");
    setPhotoFile(null);
    onAdded();
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 rounded-2xl border border-ink/10 bg-white p-5 sm:grid-cols-2">
      <input
        required
        placeholder={t.fullName}
        className="focus-ring rounded-xl border border-ink/15 px-3 py-2 text-sm"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
      />
      <input
        placeholder={t.gradePlaceholder}
        className="focus-ring rounded-xl border border-ink/15 px-3 py-2 text-sm"
        value={grade}
        onChange={(e) => setGrade(e.target.value)}
      />
      <input
        placeholder={t.schoolPlaceholder}
        className="focus-ring rounded-xl border border-ink/15 px-3 py-2 text-sm"
        value={school}
        onChange={(e) => setSchool(e.target.value)}
      />
      <input
        placeholder={t.iinPlaceholder}
        className="focus-ring rounded-xl border border-ink/15 px-3 py-2 text-sm"
        value={iin}
        onChange={(e) => setIin(e.target.value)}
      />
      <select
        className="focus-ring rounded-xl border border-ink/15 px-3 py-2 text-sm"
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
      >
        <option value="kk">{t.langKk}</option>
        <option value="ru">{t.langRu}</option>
      </select>

      <div className="sm:col-span-2">
        <label className="mb-1 block text-sm font-medium text-ink/70">{t.photoLabel}</label>
        <input
          type="file"
          accept="image/*"
          onChange={handlePhotoChange}
          className="focus-ring block w-full rounded-xl border border-ink/15 px-3 py-2 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-parent-soft file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-parent"
        />
        <p className="mt-1 text-xs text-ink/50">{t.photoNote}</p>
      </div>

      <div className="sm:col-span-2">
        {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="focus-ring rounded-full bg-parent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {t.add}
        </button>
      </div>
    </form>
  );
}
