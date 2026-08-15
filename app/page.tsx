"use client";

import { useState } from "react";
import { dict, type Lang } from "@/lib/i18n";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import RoleCard from "@/components/RoleCard";
import TestTypeCard from "@/components/TestTypeCard";

export default function Home() {
  const [lang, setLang] = useState<Lang>("kk");
  const t = dict[lang];

  return (
    <main className="min-h-screen bg-parchment">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-display text-2xl font-extrabold tracking-tight text-ink">
          Ziro
        </span>
        <LanguageSwitcher lang={lang} onChange={setLang} />
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-20 pt-10 sm:pt-16">
        <p className="text-sm font-semibold uppercase tracking-widest text-gold">
          {t.tagline}
        </p>
        <h1 className="mt-4 max-w-3xl font-display text-4xl font-extrabold leading-tight text-ink sm:text-5xl">
          {t.heroTitle}
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-ink/70">
          {t.heroBody}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button className="focus-ring rounded-full bg-ink px-6 py-3 text-sm font-semibold text-parchment transition-opacity hover:opacity-90">
            {t.ctaPrimary}
          </button>
          <button className="focus-ring rounded-full border border-ink/15 bg-white px-6 py-3 text-sm font-semibold text-ink transition-colors hover:bg-ink/5">
            {t.ctaSecondary}
          </button>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <h2 className="font-display text-2xl font-bold text-ink">{t.rolesTitle}</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-3">
          <RoleCard tone="parent" index="01" title={t.parentTitle} body={t.parentBody} />
          <RoleCard tone="teacher" index="02" title={t.teacherTitle} body={t.teacherBody} />
          <RoleCard tone="admin" index="03" title={t.adminTitle} body={t.adminBody} />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <h2 className="font-display text-2xl font-bold text-ink">{t.testsTitle}</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-3">
          <TestTypeCard
            name="НИШ"
            stages="Математика · Сандық сипаттама · Естествознание · Тілдер"
            format="ABCD"
          />
          <TestTypeCard
            name="БИЛ"
            stages="Математика · Грамотность чтения"
            format="ABCD"
          />
          <TestTypeCard name="РФМШ" stages="Математика" format="Сандық жауап" />
        </div>
      </section>

      <footer className="border-t border-ink/10 py-8">
        <p className="mx-auto max-w-6xl px-6 text-xs text-ink/50">{t.footerNote}</p>
      </footer>
    </main>
  );
}
