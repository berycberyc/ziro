"use client";

import { useState } from "react";
import Link from "next/link";
import { useLang } from "@/lib/LangContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export type AuthField = {
  name: string;
  type: string;
  label: string;
};

/**
 * Кіру / тіркелу формасы.
 *
 * Тіл ауыстырғыш осында тұр: бұл беттерге адам әлі жүйеге кірмей келеді,
 * сондықтан оның тілін біз білмейміз. Әдепкісі — қазақша (LangProvider),
 * таңдағаны localStorage-та сақталады да, кабинетте де сол тіл болады.
 */
export default function AuthForm({
  title,
  fields,
  submitLabel,
  onSubmit,
  errorText,
  footerText,
  footerLinkHref,
  footerLinkLabel,
  belowFormLink,
}: {
  title: string;
  fields: AuthField[];
  submitLabel: string;
  onSubmit: (values: Record<string, string>) => Promise<void>;
  errorText: string;
  footerText: string;
  footerLinkHref: string;
  footerLinkLabel: string;
  /** Форманың астындағы қосымша сілтеме — «Құпия сөзді ұмыттыңыз ба?». */
  belowFormLink?: { href: string; label: string };
}) {
  const { lang, setLang } = useLang();
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(false);
    try {
      await onSubmit(values);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
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
        <h1 className="font-display text-2xl font-bold text-ink">{title}</h1>
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          {fields.map((f) => (
            <div key={f.name}>
              <label className="mb-1 block text-sm font-medium text-ink/70">{f.label}</label>
              <input
                type={f.type}
                required
                className="focus-ring w-full rounded-xl border border-ink/15 bg-white px-4 py-2.5 text-sm"
                value={values[f.name] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
              />
            </div>
          ))}
          {error && <p className="text-sm text-red-600">{errorText}</p>}
          <button
            type="submit"
            disabled={loading}
            className="focus-ring mt-2 rounded-full bg-gold px-6 py-3 text-sm font-bold text-ink shadow-[0_6px_16px_rgba(198,154,58,0.28)] transition-transform hover:-translate-y-0.5 disabled:opacity-50"
          >
            {submitLabel}
          </button>
        </form>

        {belowFormLink && (
          <p className="mt-4 text-center text-sm">
            <Link href={belowFormLink.href} className="text-ink/60 underline hover:text-ink">
              {belowFormLink.label}
            </Link>
          </p>
        )}
      </div>

      <p className="mt-6 text-sm text-ink/60">
        {footerText}{" "}
        <Link href={footerLinkHref} className="font-semibold text-ink underline">
          {footerLinkLabel}
        </Link>
      </p>
    </div>
  );
}
