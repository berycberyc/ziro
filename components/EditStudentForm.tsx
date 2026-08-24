"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useLang } from "@/lib/LangContext";
import { REGIONS } from "@/lib/kzRegions";
import PhotoPicker from "@/components/PhotoPicker";

type Student = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string;
  gender: string | null;
  grade: string | null;
  region: string | null;
  city: string | null;
  school: string | null;
  iin: string | null;
  language: string | null;
  photo_url: string | null;
};

export default function EditStudentForm({
  student,
  parentId,
  onSaved,
  onCancel,
}: {
  student: Student;
  parentId: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { t, lang } = useLang();
  const [firstName, setFirstName] = useState(student.first_name ?? "");
  const [lastName, setLastName] = useState(student.last_name ?? "");
  const [gender, setGender] = useState(student.gender ?? "");
  const [grade, setGrade] = useState(student.grade ?? "");
  const [region, setRegion] = useState(
    REGIONS.find((r) => r.name_kk === student.region || r.name_ru === student.region)?.key ?? ""
  );
  const [city, setCity] = useState(student.city ?? "");
  const [school, setSchool] = useState(student.school ?? "");
  const [iin, setIin] = useState(student.iin ?? "");
  const [language, setLanguage] = useState(student.language ?? "kk");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!photoFile && !student.photo_url) {
      setError("Суретті жүктеу міндетті.");
      return;
    }

    setLoading(true);

    let photoUrl = student.photo_url;

    if (photoFile) {
      // PhotoPicker әрқашан 3:4 JPEG қайтарады.
      const path = `${parentId}/${Date.now()}.jpg`;
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

    const selectedRegion = REGIONS.find((r) => r.key === region);
    const regionName = selectedRegion ? (lang === "kk" ? selectedRegion.name_kk : selectedRegion.name_ru) : "";

    const { error: updateError } = await supabase
      .from("students")
      .update({
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`.trim(),
        gender: gender || null,
        grade,
        region: regionName || null,
        city,
        school,
        iin,
        language,
        photo_url: photoUrl,
      })
      .eq("id", student.id);

    setLoading(false);
    if (updateError) {
      setError(t.errorGeneric);
      return;
    }
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 rounded-2xl border border-parent/30 bg-parent-soft/20 p-5 sm:grid-cols-2">
      <input
        required
        placeholder={t.firstName}
        className="focus-ring rounded-xl border border-ink/15 px-3 py-2 text-sm"
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
      />
      <input
        required
        placeholder={t.lastName}
        className="focus-ring rounded-xl border border-ink/15 px-3 py-2 text-sm"
        value={lastName}
        onChange={(e) => setLastName(e.target.value)}
      />
      <select
        required
        className="focus-ring rounded-xl border border-ink/15 px-3 py-2 text-sm"
        value={gender}
        onChange={(e) => setGender(e.target.value)}
      >
        <option value="">{t.genderPlaceholder}</option>
        <option value="male">{t.genderMale}</option>
        <option value="female">{t.genderFemale}</option>
      </select>
      <select
        required
        className="focus-ring rounded-xl border border-ink/15 px-3 py-2 text-sm"
        value={grade}
        onChange={(e) => setGrade(e.target.value)}
      >
        <option value="">{t.gradePlaceholder}</option>
        <option value="5">5</option>
        <option value="6">6</option>
      </select>
      <select
        required
        className="focus-ring rounded-xl border border-ink/15 px-3 py-2 text-sm"
        value={region}
        onChange={(e) => {
          setRegion(e.target.value);
          setCity("");
        }}
      >
        <option value="">{t.regionPlaceholder}</option>
        {REGIONS.map((r) => (
          <option key={r.key} value={r.key}>
            {lang === "kk" ? r.name_kk : r.name_ru}
          </option>
        ))}
      </select>
      <select
        required
        disabled={!region}
        className="focus-ring rounded-xl border border-ink/15 px-3 py-2 text-sm disabled:opacity-50"
        value={city}
        onChange={(e) => setCity(e.target.value)}
      >
        <option value="">{t.cityPlaceholder}</option>
        {REGIONS.find((r) => r.key === region)?.cities.map((c) => (
          <option key={c.kk} value={lang === "kk" ? c.kk : c.ru}>
            {lang === "kk" ? c.kk : c.ru}
          </option>
        ))}
      </select>
      <input
        required
        placeholder={t.schoolPlaceholder}
        className="focus-ring rounded-xl border border-ink/15 px-3 py-2 text-sm"
        value={school}
        onChange={(e) => setSchool(e.target.value)}
      />
      <input
        required
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
        <PhotoPicker existingUrl={student.photo_url} onChange={setPhotoFile} />
      </div>

      <div className="flex gap-3 sm:col-span-2">
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="focus-ring rounded-full bg-parent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {t.saveChanges}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="focus-ring rounded-full border border-ink/15 px-5 py-2.5 text-sm font-semibold text-ink/60 hover:bg-ink/5"
        >
          {t.cancel}
        </button>
      </div>
    </form>
  );
}
