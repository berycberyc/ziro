"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const SUBJECTS = [
  { key: "math", label: "Математика" },
  { key: "sandyq", label: "Сандық сипаттама" },
  { key: "zharatylystanu", label: "Жаратылыстану" },
  { key: "tilder_kk", label: "Тілдер (қазақ)" },
  { key: "tilder_ru", label: "Тілдер (орыс)" },
  { key: "tilder_en", label: "Тілдер (ағылшын)" },
  { key: "bil_math", label: "БИЛ — математика" },
  { key: "bil_reading", label: "БИЛ — оқылым" },
  { key: "rfmsh", label: "РФМШ" },
];

type Topic = { id: string; subject: string; name_kk: string; name_ru: string };

export default function TopicsAdminPage() {
  const [subject, setSubject] = useState(SUBJECTS[0].key);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [newKk, setNewKk] = useState("");
  const [newRu, setNewRu] = useState("");
  const [sameLang, setSameLang] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editKk, setEditKk] = useState("");
  const [editRu, setEditRu] = useState("");
  const [editSame, setEditSame] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("topics")
      .select("id, subject, name_kk, name_ru")
      .eq("subject", subject)
      .order("name_kk");
    setTopics(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject]);

  async function handleAdd() {
    const kk = newKk.trim();
    const ru = sameLang ? kk : newRu.trim();
    if (!kk || (!sameLang && !ru)) return;
    setError("");
    const { error: err } = await supabase.from("topics").insert({ subject, name_kk: kk, name_ru: ru });
    if (err) {
      setError(err.message.includes("duplicate") ? "Бұл тема бұрын қосылған." : err.message);
      return;
    }
    setNewKk("");
    setNewRu("");
    load();
  }

  function startEdit(t: Topic) {
    setEditingId(t.id);
    setEditKk(t.name_kk);
    setEditRu(t.name_ru);
    setEditSame(t.name_kk === t.name_ru);
  }

  async function handleSaveEdit(id: string) {
    const kk = editKk.trim();
    const ru = editSame ? kk : editRu.trim();
    if (!kk || (!editSame && !ru)) return;
    await supabase.from("topics").update({ name_kk: kk, name_ru: ru }).eq("id", id);
    setEditingId(null);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Бұл теманы өшіру керек пе?")) return;
    await supabase.from("topics").delete().eq("id", id);
    load();
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-admin">Тақырыптар (тегтер)</h1>
      <p className="mt-2 text-sm text-ink/60">
        Сұрақ енгізу кезінде тек осы тізімнен таңдауға болады.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {SUBJECTS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSubject(s.key)}
            className={`focus-ring rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              subject === s.key ? "bg-admin text-white" : "bg-admin-soft text-admin hover:opacity-80"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-ink/10 bg-white p-4">
        <label className="flex items-center gap-2 text-sm text-ink/70">
          <input type="checkbox" checked={sameLang} onChange={(e) => setSameLang(e.target.checked)} />
          Бірдей атау екі тілде
        </label>
        <div className={`mt-3 grid gap-2 ${sameLang ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>
          <input
            value={newKk}
            onChange={(e) => setNewKk(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder={sameLang ? "Тема атауы" : "қазақша"}
            className="focus-ring rounded-xl border border-ink/15 px-4 py-2.5 text-sm"
          />
          {!sameLang && (
            <input
              value={newRu}
              onChange={(e) => setNewRu(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="русский"
              className="focus-ring rounded-xl border border-ink/15 px-4 py-2.5 text-sm"
            />
          )}
        </div>
        <button
          onClick={handleAdd}
          className="focus-ring mt-3 rounded-full bg-admin px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          Қосу
        </button>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      {loading && <p className="mt-6 text-sm text-ink/50">Жүктелуде...</p>}

      <div className="mt-4 flex flex-col gap-2">
        {topics.map((t) => (
          <div key={t.id} className="rounded-xl border border-ink/10 bg-white px-4 py-2.5">
            {editingId === t.id ? (
              <div>
                <label className="flex items-center gap-2 text-xs text-ink/60">
                  <input type="checkbox" checked={editSame} onChange={(e) => setEditSame(e.target.checked)} />
                  Бірдей атау екі тілде
                </label>
                <div className={`mt-2 grid gap-2 ${editSame ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>
                  <input
                    value={editKk}
                    onChange={(e) => setEditKk(e.target.value)}
                    autoFocus
                    className="focus-ring rounded-lg border border-ink/15 px-2 py-1 text-sm"
                  />
                  {!editSame && (
                    <input
                      value={editRu}
                      onChange={(e) => setEditRu(e.target.value)}
                      className="focus-ring rounded-lg border border-ink/15 px-2 py-1 text-sm"
                    />
                  )}
                </div>
                <div className="mt-2 flex gap-3">
                  <button onClick={() => handleSaveEdit(t.id)} className="focus-ring text-sm font-semibold text-parent">
                    Сақтау
                  </button>
                  <button onClick={() => setEditingId(null)} className="focus-ring text-sm text-ink/50">
                    Бас тарту
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink">
                  {t.name_kk === t.name_ru ? t.name_kk : `${t.name_kk} / ${t.name_ru}`}
                </span>
                <div className="flex gap-2">
                  <button onClick={() => startEdit(t)} className="focus-ring text-sm text-ink/50 hover:text-ink">
                    Өзгерту
                  </button>
                  <button onClick={() => handleDelete(t.id)} className="focus-ring text-sm text-red-500 hover:text-red-700">
                    Өшіру
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {!loading && topics.length === 0 && (
          <p className="text-sm text-ink/40">Бұл пән бойынша әлі тема қосылмаған.</p>
        )}
      </div>
    </div>
  );
}
