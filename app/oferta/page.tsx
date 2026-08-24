"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/lib/LangContext";
import { supabase } from "@/lib/supabase";

export default function OfertaPage() {
  const { lang } = useLang();
  const [textKk, setTextKk] = useState("");
  const [textRu, setTextRu] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("legal_documents")
      .select("text_kk, text_ru")
      .eq("key", "oferta")
      .single()
      .then(({ data }) => {
        setTextKk(data?.text_kk ?? "");
        setTextRu(data?.text_ru ?? "");
        setLoading(false);
      });
  }, []);

  const text = lang === "kk" ? textKk : textRu;
  const title = lang === "kk" ? "Жария оферта" : "Публичная оферта";

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="font-display text-2xl font-bold text-ink">{title}</h1>
      {loading ? (
        <p className="mt-6 text-sm text-ink/50">Жүктелуде...</p>
      ) : (
        <div className="mt-6 whitespace-pre-line text-sm leading-relaxed text-ink/80">{text}</div>
      )}
    </div>
  );
}
