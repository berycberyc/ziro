"use client";

import { useRouter } from "next/navigation";
import { useLang } from "@/lib/LangContext";
import { supabase } from "@/lib/supabase";
import AuthForm from "@/components/AuthForm";

export default function LoginPage() {
  // Бұрын мұнда тіл қатып қалған еді ("kk"), сондықтан орыс тілді ата-ана
  // кіру бетін қазақша ғана көретін. Енді ортақ тіл контекстінен алынады.
  const { t } = useLang();
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
      belowFormLink={{ href: "/forgot-password", label: t.forgotLink }}
      onSubmit={handleLogin}
    />
  );
}
