"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useLang } from "@/lib/LangContext";
import AppShell from "@/components/AppShell";
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

  const navItems = [
    { href: "/dashboard/profile", label: t.navProfile },
    { href: "/dashboard/students", label: t.navStudents },
    { href: "/dashboard/tests", label: t.navTests },
    { href: "/dashboard/bookings", label: t.navBookings },
  ];

  return (
    <AppShell
      navItems={navItems}
      accent="parent"
      topRight={
        <>
          <span className="font-mono text-xs text-ink/50">{email}</span>
          <LanguageSwitcher lang={lang} onChange={setLang} />
          <button
            onClick={handleLogout}
            className="focus-ring rounded-full border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-ink/5"
          >
            {t.logout}
          </button>
        </>
      }
    >
      {children}
    </AppShell>
  );
}
