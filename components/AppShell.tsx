"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string };

const ACCENT_BG = {
  parent: "bg-parent",
  admin: "bg-admin",
  teacher: "bg-teacher",
} as const;

const ACCENT_SOFT = {
  parent: "bg-parent-soft/50",
  admin: "bg-admin-soft/50",
  teacher: "bg-teacher-soft/50",
} as const;

export default function AppShell({
  navItems,
  accent,
  topRight,
  children,
}: {
  navItems: NavItem[];
  accent: keyof typeof ACCENT_BG;
  topRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
    return (
      <>
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`focus-ring block rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? `${ACCENT_BG[accent]} text-white shadow-sm`
                  : "text-ink/70 hover:bg-white/70"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-parchment">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-ink/10 bg-parchment/90 px-4 py-3 backdrop-blur sm:hidden">
        <Link href="/" className="flex items-center gap-2">
          <img
            src="/logo.jpg"
            alt="Ziro"
            className="h-8 w-8 rounded-lg object-cover shadow-sm ring-1 ring-ink/10"
          />
          <span className="font-display text-lg font-extrabold tracking-tight text-ink">
            Ziro
          </span>
        </Link>
        <button
          onClick={() => setOpen(true)}
          aria-label="Меню"
          className="focus-ring rounded-lg p-2 text-ink hover:bg-ink/5"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div
            className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-0 flex h-full w-72 max-w-[80%] flex-col gap-1 bg-parchment p-4 shadow-2xl">
            <div className="mb-6 flex items-center justify-between px-1">
              <Link href="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
                <img
                  src="/logo.jpg"
                  alt="Ziro"
                  className="h-8 w-8 rounded-lg object-cover shadow-sm ring-1 ring-ink/10"
                />
                <span className="font-display text-lg font-extrabold tracking-tight text-ink">
                  Ziro
                </span>
              </Link>
              <button
                onClick={() => setOpen(false)}
                aria-label="Жабу"
                className="focus-ring rounded-lg p-2 text-ink hover:bg-ink/5"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <NavLinks onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex">
        {/* Desktop sidebar */}
        <nav
          className={`sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-1 border-r border-ink/10 ${ACCENT_SOFT[accent]} p-4 sm:flex`}
        >
          <Link href="/" className="mb-6 flex items-center gap-2 px-2 py-1">
            <img
              src="/logo.jpg"
              alt="Ziro"
              className="h-9 w-9 rounded-lg object-cover shadow-sm ring-1 ring-ink/10"
            />
            <span className="font-display text-xl font-extrabold tracking-tight text-ink">
              Ziro
            </span>
          </Link>
          <NavLinks />
        </nav>

        <div className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-10">
          {topRight && (
            <div className="mb-6 flex flex-wrap items-center justify-end gap-3">{topRight}</div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
