"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { dict, type Lang } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import AuthForm from "@/components/AuthForm";

export default function LoginPage() {
  const [lang] = useState<Lang>("kk");
  const t = dict[lang];
  const router = useRouter();

  async function handleLogin(values: Record<string, string>) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    if (error) throw error;

    const userId = data.user?.id;
    if (userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

      if (profile?.role === "admin") {
        router.push("/admin");
        return;
      }
      if (profile?.role === "teacher") {
        router.push("/teacher");
        return;
      }
    }

    router.push("/dashboard");
  }

  return (
    <AuthForm
      title={t.loginTitle}
      submitLabel={t.loginSubmit}
      errorText={t.authError}
      footerText={t.noAccount}
      footerLinkHref="/register"
      footerLinkLabel={t.registerTitle}
      fields={[
        { name: "email", type: "email", label: t.email },
        { name: "password", type: "password", label: t.password },
      ]}
      onSubmit={handleLogin}
    />
  );
}
