"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AdminSidebar from "@/components/AdminSidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
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

      setAllowed(profile?.role === "admin");
    }
    check();
  }, [router]);

  if (allowed === null) {
    return <main className="p-10 text-ink/50">Жүктелуде...</main>;
  }

  if (allowed === false) {
    return (
      <main className="p-10 text-ink/70">
        Бұл бетке қол жеткізу құқығыңыз жоқ.
      </main>
    );
  }

  return (
    <div className="flex min-h-screen bg-parchment">
      <AdminSidebar />
      <div className="flex-1 px-8 py-10">{children}</div>
    </div>
  );
}
