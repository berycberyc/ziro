"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/**
 * Тестке кіру беті. Мұнда оқушының тілі ӘЛІ БЕЛГІСІЗ — ол брондау нөмірі
 * енгізілгеннен кейін ғана табылады. Сондықтан бұл бетте екі тіл қатар
 * тұрады: балаға ештеңе баспай-ақ өз тілін табу оңай болсын.
 *
 * Тесттің өзінде (/test/...) бәрі бір тілде — оқушының карточкасындағы
 * тілде.
 */
export default function KiruPage() {
  const router = useRouter();
  const [shortCode, setShortCode] = useState("");
  const [zipgradeId, setZipgradeId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(false);

    const { data, error: rpcError } = await supabase.rpc("lookup_online_entry", {
      p_short_code: shortCode.trim().toUpperCase(),
      p_zipgrade_id: zipgradeId.trim(),
    });

    setLoading(false);

    if (rpcError || !data) {
      setError(true);
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
        <p className="font-display text-lg font-bold text-ink/70">Вход в тест</p>

        <p className="mt-3 text-sm text-ink/60">
          Рұқсат қағазыңыздағы брондау нөмірін және оқушы кодын енгізіңіз.
        </p>
        <p className="mt-1 text-sm text-ink/50">
          Введите номер брони и код ученика — они указаны в пропуске.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <input
            required
            placeholder="Брондау нөмірі / Номер брони"
            value={shortCode}
            onChange={(e) => setShortCode(e.target.value)}
            className="focus-ring rounded-xl border border-ink/15 px-4 py-2.5 font-mono text-sm uppercase"
          />
          <input
            required
            placeholder="Оқушы коды / Код ученика (5)"
            value={zipgradeId}
            onChange={(e) => setZipgradeId(e.target.value.replace(/[^\d]/g, ""))}
            inputMode="numeric"
            className="focus-ring rounded-xl border border-ink/15 px-4 py-2.5 font-mono text-sm"
          />
        </div>

        {error && (
          <div className="mt-3 text-sm text-red-600">
            <p>Брондау нөмірі немесе оқушы коды дұрыс емес. Қайта тексеріп көріңіз.</p>
            <p className="mt-1">Номер брони или код ученика неверный. Проверьте ещё раз.</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="focus-ring mt-5 w-full rounded-full bg-gold px-5 py-3 text-sm font-bold text-ink shadow-[0_6px_16px_rgba(198,154,58,0.28)] transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
        >
          {loading ? "Тексерілуде... / Проверяем..." : "Кіру / Войти"}
        </button>
      </form>
    </div>
  );
}
