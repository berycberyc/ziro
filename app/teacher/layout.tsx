"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useLang } from "@/lib/LangContext";
import TeacherSidebar from "@/components/TeacherSidebar";

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { t } = useLang();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    async function check() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.push("/login");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userData.user.id)
        .single();

      setAllowed(profile?.role === "teacher");
    }
    check();
  }, [router]);

  if (allowed === null) {
    return <main className="p-10 text-ink/50">{t.loading}</main>;
  }

  if (allowed === false) {
    return <main className="p-10 text-ink/70">{t.teacherNoAccess}</main>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-parchment sm:flex-row">
      <TeacherSidebar />
      <div className="flex-1 px-4 py-6 sm:px-8 sm:py-10">{children}</div>
    </div>
  );
}
