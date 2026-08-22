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
  { key: "bil_math", label: "БІЛ — математика" },
  { key: "bil_reading", label: "БІЛ — оқылым" },
  { key: "rfmsh", label: "РФМШ" },
];

type Topic = { id: string; subject: string; name: string };

export default function TopicsAdminPage() {
  const [subject, setSubject] = useState(SUBJECTS[0].key);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("topics")
      .select("id, subject, name")
      .eq("subject", subject)
      .order("name");
    setTopics(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject]);

  async function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    setError("");
    const { error: err } = await supabase.from("topics").insert({ subject, name });
    if (err) {
      setError(err.message.includes("duplicate") ? "Бұл тема бұрын қосылған." : err.message);
      return;
    }
    setNewName("");
    load();
  }

  async function handleSaveEdit(id: string) {
    const name = editingName.trim();
    if (!name) return;
    await supabase.from("topics").update({ name }).eq("id", id);
    setEditingId(null);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Бұл теманы өшіру керек пе? Осы темамен байланысты сұрақтар зақымдалмайды, бірақ тема жойылады.")) return;
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

      <div className="mt-6 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Жаңа тема атауы"
          className="focus-ring flex-1 rounded-xl border border-ink/15 px-4 py-2.5 text-sm"
        />
        <button
          onClick={handleAdd}
          className="focus-ring rounded-full bg-admin px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          Қосу
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {loading && <p className="mt-6 text-sm text-ink/50">Жүктелуде...</p>}

      <div className="mt-4 flex flex-col gap-2">
        {topics.map((t) => (
          <div key={t.id} className="flex items-center justify-between rounded-xl border border-ink/10 bg-white px-4 py-2.5">
            {editingId === t.id ? (
              <input
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveEdit(t.id)}
                autoFocus
                className="focus-ring flex-1 rounded-lg border border-ink/15 px-2 py-1 text-sm"
              />
            ) : (
              <span className="text-sm text-ink">{t.name}</span>
            )}
            <div className="flex gap-2">
              {editingId === t.id ? (
                <button onClick={() => handleSaveEdit(t.id)} className="focus-ring text-sm font-semibold text-parent">
                  Сақтау
                </button>
              ) : (
                <button
                  onClick={() => { setEditingId(t.id); setEditingName(t.name); }}
                  className="focus-ring text-sm text-ink/50 hover:text-ink"
                >
                  Өзгерту
                </button>
              )}
              <button onClick={() => handleDelete(t.id)} className="focus-ring text-sm text-red-500 hover:text-red-700">
                Өшіру
              </button>
            </div>
          </div>
        ))}
        {!loading && topics.length === 0 && (
          <p className="text-sm text-ink/40">Бұл пән бойынша әлі тема қосылмаған.</p>
        )}
      </div>
    </div>
  );
}
