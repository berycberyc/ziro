"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function DashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push("/login");
      } else {
        setEmail(data.user.email ?? null);
      }
    });
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-2xl font-bold text-ink">
        Жеке кабинет
      </h1>
      {email && <p className="mt-2 text-sm text-ink/60">{email}</p>}
      <p className="mt-6 text-ink/70">
        Бұл бөлім әлі құрылу үстінде — жақын арада балаларыңызды қосу және
        байқауларға тіркелу мүмкіндігі осында пайда болады.
      </p>
      <button
        onClick={handleLogout}
        className="focus-ring mt-8 rounded-full border border-ink/15 bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:bg-ink/5"
      >
        Шығу
      </button>
    </main>
  );
}
