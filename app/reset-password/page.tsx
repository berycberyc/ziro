"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLang } from "@/lib/LangContext";
import { supabase } from "@/lib/supabase";
import LanguageSwitcher from "@/components/LanguageSwitcher";

/**
 * Хаттағы сілтемеден келетін бет: жаңа құпия сөзді енгізу.
 *
 * Сілтеме екі түрлі келуі мүмкін — Supabase баптауына байланысты:
 *   1) ?code=... — оны сессияға айырбастау керек;
 *   2) #access_token=... — кітапхана өзі ұстап алады, тек күту керек.
 * Сондықтан екеуін де қарастырамыз, әйтпесе баптау ауысса бет сынар еді.
 */
export default function ResetPasswordPage() {
  const { lang, setLang, t } = useLang();
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [linkOk, setLinkOk] = useState(true);
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function prepare() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!cancelled) {
          setLinkOk(!error);
          setReady(true);
        }
        return;
      }

      // Хэш арқылы келген жағдай: кітапхана сессияны өзі орнатады.
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        if (!cancelled) {
          setLinkOk(true);
          setReady(true);
        }
        return;
      }

      // Сессия әлі жоқ болуы мүмкін — оқиғаны күтеміз.
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session && !cancelled) {
          setLinkOk(true);
          setReady(true);
        }
      });

      // Екі секундтан кейін де сессия жоқ болса — сілтеме жарамсыз.
      setTimeout(() => {
        if (!cancelled) {
          setReady((r) => {
            if (!r) setLinkOk(false);
            return true;
          });
        }
        sub.subscription.unsubscribe();
      }, 2500);
    }

    prepare();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setProblem("");

    if (password.length < 6) {
      setProblem(t.resetTooShort);
      return;
    }
    if (password !== repeat) {
      setProblem(t.resetMismatch);
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);

    if (error) {
      setProblem(t.authError);
      return;
    }
    setDone(true);
  }

  const shell = (children: React.ReactNode) => (
    <div className="flex min-h-screen flex-col items-center justify-center bg-parchment px-6">
      <Link href="/" className="mb-6 flex items-center gap-2">
        <img src="/logo.jpg" alt="Ziro" className="h-10 w-10 rounded-xl object-cover" />
        <span className="font-display text-2xl font-bold tracking-tight text-ink">
          zi<span className="text-gold-deep">ro</span>
        </span>
      </Link>
      <div className="mb-4">
        <LanguageSwitcher lang={lang} onChange={setLang} />
      </div>
      <div className="w-full max-w-md rounded-3xl border border-ink/10 bg-white p-8 shadow-lg">
        {children}
      </div>
    </div>
  );

  if (!ready) {
    return shell(<p className="text-center text-sm text-ink/50">...</p>);
  }

  if (!linkOk) {
    return shell(
      <div className="text-center">
        <h1 className="font-display text-xl font-bold text-clay">{t.resetTitle}</h1>
        <p className="mt-4 text-sm leading-relaxed text-ink/70">{t.resetNoLink}</p>
        <Link
          href="/forgot-password"
          className="focus-ring mt-6 inline-block rounded-full bg-gold px-6 py-3 text-sm font-bold text-ink"
        >
          {t.forgotTitle}
        </Link>
      </div>
    );
  }

  if (done) {
    return shell(
      <div className="text-center">
        <h1 className="font-display text-xl font-bold text-parent">{t.resetDoneTitle}</h1>
        <p className="mt-4 text-sm text-ink/70">{t.resetDoneBody}</p>
        <button
          onClick={() => router.push("/dashboard")}
          className="focus-ring mt-6 rounded-full bg-gold px-6 py-3 text-sm font-bold text-ink"
        >
          {t.backToLogin}
        </button>
      </div>
    );
  }

  return shell(
    <>
      <h1 className="font-display text-2xl font-bold text-ink">{t.resetTitle}</h1>
      <p className="mt-2 text-sm text-ink/60">{t.resetBody}</p>

      <form onSubmit={handleSave} className="mt-6 flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink/70">{t.resetPassword}</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="focus-ring w-full rounded-xl border border-ink/15 bg-white px-4 py-2.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink/70">
            {t.resetPasswordAgain}
          </label>
          <input
            type="password"
            required
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
            className="focus-ring w-full rounded-xl border border-ink/15 bg-white px-4 py-2.5 text-sm"
          />
        </div>

        {problem && <p className="text-sm text-red-600">{problem}</p>}

        <button
          type="submit"
          disabled={busy}
          className="focus-ring mt-2 rounded-full bg-gold px-6 py-3 text-sm font-bold text-ink shadow-[0_6px_16px_rgba(198,154,58,0.28)] disabled:opacity-50"
        >
          {t.resetSubmit}
        </button>
      </form>
    </>
  );
}
