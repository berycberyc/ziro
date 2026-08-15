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
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
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
          className="focus-ring mt-2 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-parchment transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitLabel}
        </button>
      </form>
      <p className="mt-6 text-sm text-ink/60">
        {footerText}{" "}
        <Link href={footerLinkHref} className="font-semibold text-ink underline">
          {footerLinkLabel}
        </Link>
      </p>
    </div>
  );
}
