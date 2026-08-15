"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { dict, type Lang } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import AuthForm from "@/components/AuthForm";

export default function RegisterPage() {
  const [lang] = useState<Lang>("kk");
  const t = dict[lang];
  const router = useRouter();

  async function handleRegister(values: Record<string, string>) {
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: {
          full_name: values.fullName,
          phone: values.phone,
        },
      },
    });
    if (error) throw error;
    router.push("/dashboard");
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
        { name: "fullName", type: "text", label: t.fullName },
        { name: "phone", type: "tel", label: t.phone },
        { name: "email", type: "email", label: t.email },
        { name: "password", type: "password", label: t.password },
      ]}
      onSubmit={handleRegister}
    />
  );
}
