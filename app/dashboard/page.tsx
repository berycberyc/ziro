"use client";

import Link from "next/link";
import { useLang } from "@/lib/LangContext";

const STEPS = [
  { key: "1", titleKey: "guideStep1Title", descKey: "guideStep1Desc", icon: "👤" },
  { key: "2", titleKey: "guideStep2Title", descKey: "guideStep2Desc", icon: "📋" },
  { key: "3", titleKey: "guideStep3Title", descKey: "guideStep3Desc", icon: "📄" },
  { key: "4", titleKey: "guideStep4Title", descKey: "guideStep4Desc", icon: "🏆" },
] as const;

export default function DashboardHomePage() {
  const { t } = useLang();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="font-display text-2xl font-bold text-ink">{(t as any).guideTitle}</h1>
      <p className="mt-2 text-sm text-ink/60">{(t as any).guideSubtitle}</p>

      <div className="mt-8 flex flex-col gap-4">
        {STEPS.map((step, i) => (
          <div key={step.key} className="flex gap-4 rounded-2xl border border-ink/10 bg-white px-5 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-parent/10 text-lg">
              {step.icon}
            </div>
            <div>
              <p className="font-semibold text-ink">
                {i + 1}. {(t as any)[step.titleKey]}
              </p>
              <p className="mt-0.5 text-sm text-ink/60">{(t as any)[step.descKey]}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex justify-center">
        <Link
          href="/dashboard/tests"
          className="focus-ring rounded-full bg-parent px-8 py-3 text-sm font-semibold text-white hover:opacity-90"
        >
          {(t as any).guideButton}
        </Link>
      </div>
    </div>
  );
}
