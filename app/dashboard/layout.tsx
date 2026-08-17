"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useLang } from "@/lib/LangContext";
import ParentSidebar from "@/components/ParentSidebar";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { t, lang, setLang } = useLang();
  const [checked, setChecked] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push("/login");
      } else {
        setEmail(data.user.email ?? null);
        setChecked(true);
      }
    });
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (!checked) {
    return <main className="p-10 text-ink/50">{t.loading}</main>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-parchment sm:flex-row">
      <ParentSidebar />
      <div className="flex-1 px-4 py-6 sm:px-8 sm:py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-ink/50">{email}</span>
          <div className="flex items-center gap-3">
            <LanguageSwitcher lang={lang} onChange={setLang} />
            <button
              onClick={handleLogout}
              className="focus-ring rounded-full border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-ink/5"
            >
              {t.logout}
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
