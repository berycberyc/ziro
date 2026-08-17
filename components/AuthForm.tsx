"use client";

import { useState } from "react";
import Link from "next/link";

export type AuthField = {
  name: string;
  type: string;
  label: string;
};

export default function AuthForm({
  title,
  fields,
  submitLabel,
  onSubmit,
  errorText,
  footerText,
  footerLinkHref,
  footerLinkLabel,
}: {
  title: string;
  fields: AuthField[];
  submitLabel: string;
  onSubmit: (values: Record<string, string>) => Promise<void>;
  errorText: string;
  footerText: string;
  footerLinkHref: string;
  footerLinkLabel: string;
}) {
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
      <Link href="/" className="mb-8 flex items-center gap-2">
        <img
          src="/logo.jpg"
          alt="Ziro"
          className="h-10 w-10 rounded-xl object-cover shadow-sm ring-1 ring-ink/10"
        />
        <span className="font-display text-2xl font-extrabold tracking-tight text-ink">
          Ziro
        </span>
      </Link>

      <div className="w-full max-w-md rounded-3xl border border-ink/10 bg-white p-8 shadow-lg">
        <h1 className="font-display text-2xl font-bold text-ink">{title}</h1>
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          {fields.map((f) => (
            <div key={f.name}>
              <label className="mb-1 block text-sm font-medium text-ink/70">
                {f.label}
              </label>
              <input
                type={f.type}
                required
                className="focus-ring w-full rounded-xl border border-ink/15 bg-white px-4 py-2.5 text-sm"
                value={values[f.name] ?? ""}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [f.name]: e.target.value }))
                }
              />
            </div>
          ))}
          {error && <p className="text-sm text-red-600">{errorText}</p>}
          <button
            type="submit"
            disabled={loading}
            className="focus-ring mt-2 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-parchment shadow-sm transition-all hover:opacity-90 hover:shadow-md disabled:opacity-50"
          >
            {submitLabel}
          </button>
        </form>
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
