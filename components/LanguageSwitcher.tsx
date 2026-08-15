"use client";

import type { Lang } from "@/lib/i18n";

export default function LanguageSwitcher({
  lang,
  onChange,
}: {
  lang: Lang;
  onChange: (l: Lang) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-full border border-ink/10 bg-white p-1 text-sm">
      {(["kk", "ru"] as Lang[]).map((l) => (
        <button
          key={l}
          onClick={() => onChange(l)}
          className={`focus-ring rounded-full px-3 py-1 font-medium transition-colors ${
            lang === l ? "bg-ink text-parchment" : "text-ink/60 hover:text-ink"
          }`}
          aria-pressed={lang === l}
        >
          {l === "kk" ? "ҚАЗ" : "РУС"}
        </button>
      ))}
    </div>
  );
}
