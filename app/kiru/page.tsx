"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function KiruPage() {
  const router = useRouter();
  const [shortCode, setShortCode] = useState("");
  const [zipgradeId, setZipgradeId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data, error: rpcError } = await supabase.rpc("lookup_online_entry", {
      p_short_code: shortCode.trim().toUpperCase(),
      p_zipgrade_id: zipgradeId.trim(),
    });

    setLoading(false);

    if (rpcError || !data) {
      setError("Брондау нөмірі немесе оқушы коды дұрыс емес. Қайта тексеріп көріңіз.");
      return;
    }

    router.push(`/test/${data}`);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-parchment px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-3xl border border-ink/10 bg-white p-8 shadow-lg"
      >
        <h1 className="font-display text-xl font-bold text-ink">Тестке кіру</h1>
        <p className="mt-2 text-sm text-ink/60">
          Рұқсат қағазыңыздағы брондау нөмірін және оқушы кодын енгізіңіз.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <input
            required
            placeholder="Брондау нөмірі"
            value={shortCode}
            onChange={(e) => setShortCode(e.target.value)}
            className="focus-ring rounded-xl border border-ink/15 px-4 py-2.5 font-mono text-sm uppercase"
          />
          <input
            required
            placeholder="Оқушы коды (5 сан)"
            value={zipgradeId}
            onChange={(e) => setZipgradeId(e.target.value.replace(/[^\d]/g, ""))}
            inputMode="numeric"
            className="focus-ring rounded-xl border border-ink/15 px-4 py-2.5 font-mono text-sm"
          />
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="focus-ring mt-5 w-full rounded-full bg-gold px-5 py-3 text-sm font-bold text-ink shadow-[0_6px_16px_rgba(198,154,58,0.28)] transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
        >
          {loading ? "Тексерілуде..." : "Кіру"}
        </button>
      </form>
    </div>
  );
}
