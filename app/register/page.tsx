"use client";

import { useState } from "react";
import { dict, type Lang } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import AuthForm from "@/components/AuthForm";

export default function RegisterPage() {
  const [lang] = useState<Lang>("kk");
  const t = dict[lang];
  const [registered, setRegistered] = useState(false);

  async function handleRegister(values: Record<string, string>) {
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/login` : undefined,
        data: {
          first_name: values.firstName,
          last_name: values.lastName,
          phone: values.phone,
        },
      },
    });
    if (error) throw error;
    // Email confirmation is required now — don't redirect to /dashboard,
    // the parent can only log in after clicking the link in their email.
    setRegistered(true);
  }

  if (registered) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-parchment px-6 text-center">
        <div className="w-full max-w-md rounded-3xl border border-ink/10 bg-white p-8 shadow-lg">
          <h1 className="font-display text-2xl font-bold text-ink">{t.checkEmailTitle}</h1>
          <p className="mt-4 text-sm text-ink/70">{t.checkEmailBody}</p>
        </div>
      </div>
    );
  }

  return (
    <AuthForm
      title={t.registerTitle}
      submitLabel={t.registerSubmit}
      errorText={t.authError}
      footerText={t.haveAccount}
      footerLinkHref="/login"
      footerLinkLabel={t.loginTitle}
      fields={[
        { name: "firstName", type: "text", label: t.firstName },
        { name: "lastName", type: "text", label: t.lastName },
        { name: "phone", type: "tel", label: t.phone },
        { name: "email", type: "email", label: t.email },
        { name: "password", type: "password", label: t.password },
      ]}
      onSubmit={handleRegister}
    />
  );
}
