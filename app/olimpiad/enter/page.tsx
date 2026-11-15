"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { primaryBtn } from "@/components/olympiad/ui";

/**
 * Олимпиадаға кіру (/olimpiad/enter). /kiru сияқты: Оқушы ID + олимпиада
 * коды. Оқушының тілі әлі белгісіз, сондықтан екі тіл қатар.
 */
export default function OlympiadEnterPage() {
  const router = useRouter();
  const [zipgradeId, setZipgradeId] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(false);
    const { data, error: rpcError } = await supabase.rpc("olympiad_enter", {
      p_zipgrade_id: zipgradeId.trim(),
      p_code: code.trim(),
    });
    setLoading(false);
    if (rpcError || !data) {
      setError(true);
      return;
    }
    router.push(`/olimpiad/test/${data}`);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-parchment px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl border border-ink/10 bg-white p-8 shadow-lg">
        <h1 className="font-display text-xl font-bold text-ink">Олимпиадаға кіру</h1>
        <p className="font-display text-lg font-bold text-ink/70">Вход на олимпиаду</p>
        <p className="mt-3 text-sm text-ink/60">Оқушы ID мен олимпиада кодын енгізіңіз.</p>
        <p className="mt-1 text-sm text-ink/50">Введите ID ученика и код олимпиады.</p>

        <div className="mt-6 flex flex-col gap-3">
          <input
            required
            autoFocus
            inputMode="numeric"
            placeholder="Оқушы ID / ID ученика"
            aria-label="Оқушы ID / ID ученика"
            value={zipgradeId}
            onChange={(e) => setZipgradeId(e.target.value.replace(/[^\d]/g, ""))}
            className="focus-ring rounded-xl border border-ink/15 px-4 py-2.5 font-mono text-sm"
          />
          <input
            required
            inputMode="numeric"
            placeholder="Олимпиада коды / Код олимпиады"
            aria-label="Олимпиада коды / Код олимпиады"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, ""))}
            className="focus-ring rounded-xl border border-ink/15 px-4 py-2.5 font-mono text-sm"
          />
        </div>

        {error && (
          <div className="mt-3 text-sm text-clay">
            <p>Оқушы ID немесе код дұрыс емес.</p>
            <p className="mt-1">Неверный ID ученика или код.</p>
          </div>
        )}

        <button type="submit" disabled={loading} className={`${primaryBtn} mt-5 w-full py-3`}>
          {loading ? "Тексерілуде... / Проверяем..." : "Кіру / Войти"}
        </button>
      </form>
    </div>
  );
}
