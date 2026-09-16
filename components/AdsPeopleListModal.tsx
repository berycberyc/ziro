"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { fetchAllByIds } from "@/lib/fetchAll";
import { channelLabel, heardFromLabel } from "@/lib/sources";

/**
 * «Жарнама» бетінде санды басқанда ашылатын тізім.
 *
 * Бір жол — бір брондау: екі баласын жазған ата-ана екі жол алады.
 * Брондауы жоқ ата-ана («Кабинет ашты» тізімінде) — бос брондау
 * бағандарымен бір жол.
 * «Төледі» тізімінде тек төленген брондаулар шығады.
 *
 * ЖСН әдейі шығарылмайды: Excel файлы жіберіліп, көшіріліп жүреді.
 */

export type PeopleListRequest = {
  title: string;
  parentIds: string[];
  onlyPaid: boolean;
};

type AdLinkLite = { name: string; campaign: string; channel: string };

type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  created_at: string;
  utm_source: string | null;
  utm_campaign: string | null;
  heard_from: string | null;
};

type Registration = {
  id: string;
  parent_id: string;
  created_at: string;
  format: string;
  payment_status: string;
  short_code: string | null;
  test_session_id: string;
  test_type_id: string;
  students: {
    full_name: string | null;
    zipgrade_id: string | null;
    grade: string | null;
    school: string | null;
    city: string | null;
    region: string | null;
    language: string | null;
  } | null;
  test_sessions: { title_kk: string | null; session_date: string | null; price: number | null } | null;
  test_types: { code: string | null } | null;
};

type Row = Record<(typeof COLUMNS)[number]["key"], string | number>;

const COLUMNS = [
  { key: "parent", label: "Ата-ана" },
  { key: "phone", label: "Телефон" },
  { key: "email", label: "Email" },
  { key: "signedUp", label: "Кабинет ашқан күні" },
  { key: "link", label: "Сілтеме" },
  { key: "heard", label: "Өз жауабы" },
  { key: "student", label: "Оқушы" },
  { key: "studentId", label: "Оқушы ID" },
  { key: "grade", label: "Сынып" },
  { key: "school", label: "Мектеп" },
  { key: "city", label: "Қала / облыс" },
  { key: "language", label: "Тіл" },
  { key: "test", label: "Тест" },
  { key: "format", label: "Формат" },
  { key: "session", label: "Сессия" },
  { key: "sessionDate", label: "Сессия күні" },
  { key: "bookingCode", label: "Брондау нөмірі" },
  { key: "bookedAt", label: "Брондау күні" },
  { key: "amount", label: "Сомасы, теңге" },
  { key: "payment", label: "Төлем" },
] as const;

/** Астана уақыты (+05:00) бойынша «дд.мм.жжжж». */
function astanaDate(ts: string | null | undefined): string {
  if (!ts) return "";
  const ms = Date.parse(ts);
  if (Number.isNaN(ms)) return "";
  const iso = new Date(ms + 5 * 60 * 60 * 1000).toISOString();
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
}

function plainDate(d: string | null | undefined): string {
  if (!d) return "";
  return `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
}

export default function AdsPeopleListModal({
  request,
  links,
  onClose,
}: {
  request: PeopleListRequest;
  links: AdLinkLite[];
  onClose: () => void;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const profiles = await fetchAllByIds<Profile>(request.parentIds, (chunk) =>
          supabase
            .from("profiles")
            .select("id, full_name, phone, email, created_at, utm_source, utm_campaign, heard_from")
            .in("id", chunk)
        );
        const regs = (await fetchAllByIds<any>(request.parentIds, (chunk) =>
          supabase
            .from("registrations")
            .select(
              "id, parent_id, created_at, format, payment_status, short_code, test_session_id, test_type_id, students ( full_name, zipgrade_id, grade, school, city, region, language ), test_sessions ( title_kk, session_date, price ), test_types ( code )"
            )
            .in("parent_id", chunk)
        )) as Registration[];
        // Тест түріне бөлек баға қойылған болса — сол баға (Оплата бетіндегідей).
        const sessionIds = [...new Set(regs.map((r) => r.test_session_id))];
        const overrides = await fetchAllByIds<{ test_session_id: string; test_type_id: string; price: number | null }>(
          sessionIds,
          (chunk) =>
            supabase
              .from("session_test_types")
              .select("test_session_id, test_type_id, price")
              .in("test_session_id", chunk)
        );
        const priceOf = (r: Registration): number | "" => {
          const o = overrides.find((x) => x.test_session_id === r.test_session_id && x.test_type_id === r.test_type_id);
          const p = o?.price ?? r.test_sessions?.price;
          return p == null ? "" : Math.round(Number(p));
        };

        const linkName = (p: Profile) => {
          const l = links.find((x) => x.campaign === p.utm_campaign);
          if (l) return `${l.name} (${channelLabel(l.channel)})`;
          return [p.utm_source, p.utm_campaign].filter(Boolean).join(" / ");
        };

        const regsByParent = new Map<string, Registration[]>();
        for (const r of regs) {
          if (request.onlyPaid && r.payment_status !== "paid") continue;
          const list = regsByParent.get(r.parent_id) ?? [];
          list.push(r);
          regsByParent.set(r.parent_id, list);
        }

        const sortedProfiles = [...profiles].sort((a, b) => b.created_at.localeCompare(a.created_at));
        const out: Row[] = [];
        for (const p of sortedProfiles) {
          const base = {
            parent: p.full_name ?? "",
            phone: p.phone ?? "",
            email: p.email ?? "",
            signedUp: astanaDate(p.created_at),
            link: linkName(p),
            heard: p.heard_from ? heardFromLabel(p.heard_from) : "",
          };
          const empty = {
            student: "", studentId: "", grade: "", school: "", city: "", language: "",
            test: "", format: "", session: "", sessionDate: "", bookingCode: "", bookedAt: "", amount: "", payment: "",
          };
          const parentRegs = (regsByParent.get(p.id) ?? []).sort((a, b) => a.created_at.localeCompare(b.created_at));
          if (parentRegs.length === 0) {
            out.push({ ...base, ...empty });
            continue;
          }
          for (const r of parentRegs) {
            const st = r.students;
            out.push({
              ...base,
              student: st?.full_name ?? "",
              studentId: st?.zipgrade_id ?? "",
              grade: st?.grade ?? "",
              school: st?.school ?? "",
              city: [st?.city, st?.region].filter(Boolean).join(", "),
              language: st?.language === "kk" ? "қазақ" : st?.language === "ru" ? "орыс" : "",
              test: r.test_types?.code ?? "",
              format: r.format === "online" ? "Онлайн" : r.format === "offline" ? "Офлайн" : r.format,
              session: r.test_sessions?.title_kk ?? "",
              sessionDate: plainDate(r.test_sessions?.session_date),
              bookingCode: r.short_code ?? "",
              bookedAt: astanaDate(r.created_at),
              amount: priceOf(r),
              payment: r.payment_status === "paid" ? "Төленді" : "Күтілуде",
            });
          }
        }
        if (!cancelled) setRows(out);
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? "Жүктелмеді");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [request, links]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const bookingCount = useMemo(() => (rows ?? []).filter((r) => r.student !== "").length, [rows]);

  function downloadExcel() {
    if (!rows) return;
    const header = COLUMNS.map((c) => c.label);
    const body = rows.map((r) => COLUMNS.map((c) => r[c.key]));
    const sheet = XLSX.utils.aoa_to_sheet([header, ...body]);
    // Телефон, ID, брондау нөмірі — мәтін ретінде: Excel нөлдерді жоймасын.
    const textCols = ["phone", "studentId", "bookingCode"];
    for (let i = 0; i < body.length; i++) {
      COLUMNS.forEach((c, j) => {
        if (!textCols.includes(c.key)) return;
        const ref = XLSX.utils.encode_cell({ r: i + 1, c: j });
        if (sheet[ref]) sheet[ref].t = "s";
      });
    }
    sheet["!cols"] = COLUMNS.map((c) => ({
      wch: Math.min(40, Math.max(c.label.length + 2, ...rows.map((r) => String(r[c.key]).length + 1))),
    }));
    sheet["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: body.length, c: COLUMNS.length - 1 } }) };
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Тізім");
    const today = astanaDate(new Date().toISOString()).split(".").reverse().join("-");
    const safeTitle = request.title.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
    XLSX.writeFile(book, `ziro ${safeTitle} ${today}.xlsx`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-6" onClick={onClose}>
      <div
        className="flex max-h-full w-full max-w-6xl flex-col rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={request.title}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 px-5 py-4">
          <div>
            <p className="font-display text-lg font-bold text-ink">{request.title}</p>
            <p className="text-sm text-ink/55">
              {request.parentIds.length} ата-ана
              {rows && ` · ${bookingCount} брондау`}
              {request.onlyPaid && " (тек төленгендері)"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={downloadExcel}
              disabled={!rows || rows.length === 0}
              className="focus-ring inline-flex items-center gap-2 rounded-full bg-mint px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Excel-ге жүктеу
            </button>
            <button
              onClick={onClose}
              aria-label="Жабу"
              className="focus-ring flex h-9 w-9 items-center justify-center rounded-full border border-ink/15 text-ink/60 hover:bg-ink/5"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="overflow-auto">
          {error && <p className="px-5 py-4 text-sm text-red-600">{error}</p>}
          {!error && !rows && <p className="px-5 py-4 text-sm text-ink/50">Жүктелуде...</p>}
          {rows && (
            <table className="w-full min-w-[1400px] text-sm text-ink/80">
              <thead className="sticky top-0 bg-parchment">
                <tr className="text-left text-xs text-ink/55">
                  {COLUMNS.map((c) => (
                    <th key={c.key} className="whitespace-nowrap px-3 py-2 font-medium">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-ink/5 align-top">
                    {COLUMNS.map((c) => (
                      <td
                        key={c.key}
                        className={`whitespace-nowrap px-3 py-2 ${
                          c.key === "payment"
                            ? r.payment === "Төленді"
                              ? "font-semibold text-mint"
                              : "text-gold-deep"
                            : ""
                        }`}
                      >
                        {c.key === "amount" && r.amount !== "" ? Number(r.amount).toLocaleString("ru-RU") : r[c.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
