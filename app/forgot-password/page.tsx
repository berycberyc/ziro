"use client";

import { useState } from "react";
import Link from "next/link";
import { useLang } from "@/lib/LangContext";
import { supabase } from "@/lib/supabase";
import AuthForm from "@/components/AuthForm";

/**
 * Құпия сөзді ұмытқанда — бірінші қадам: email сұраймыз.
 *
 * МАҢЫЗДЫ: email жүйеде бар-жоғын айтпаймыз. Нәтиже әрқашан бірдей:
 * «жіберілді». Әйтпесе бұл бет арқылы бөтен адам қай ата-ана тіркелгенін
 * тексере алар еді.
 */
export default function ForgotPasswordPage() {
  const { t } = useLang();
  const [sent, setSent] = useState(false);

  async function handleSubmit(values: Record<string, string>) {
    await supabase.auth.resetPasswordForEmail(values.email.trim(), {
      redirectTo:
        typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined,
    });
    // Қате болса да «жіберілді» дейміз — жоғарыдағы себеп бойынша.
    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-parchment px-6 text-center">
        <div className="w-full max-w-md rounded-3xl border border-ink/10 bg-white p-8 shadow-lg">
          <h1 className="font-display text-2xl font-bold text-ink">{t.forgotSentTitle}</h1>
          <p className="mt-4 text-sm leading-relaxed text-ink/70">{t.forgotSentBody}</p>
          <Link
            href="/login"
            className="focus-ring mt-6 inline-block rounded-full bg-gold px-6 py-3 text-sm font-bold text-ink"
          >
            {t.backToLogin}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <AuthForm
      title={t.forgotTitle}
      submitLabel={t.forgotSubmit}
      errorText={t.authError}
      footerText={t.forgotBody}
      footerLinkHref="/login"
      footerLinkLabel={t.backToLogin}
      fields={[{ name: "email", type: "email", label: t.email }]}
      onSubmit={handleSubmit}
    />
  );
}
