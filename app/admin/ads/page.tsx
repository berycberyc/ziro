"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fetchAll } from "@/lib/fetchAll";
import { AD_CHANNELS, HEARD_FROM_OPTIONS, channelLabel, heardFromLabel } from "@/lib/sources";

/**
 * «Жарнама» беті.
 *   1) Жарнама сілтемесін жасау: атауы + қайда тұрады → сілтеме және QR.
 *   2) Әр сілтеме бойынша: қанша ата-ана кабинет ашты, брондады, төледі.
 *   3) «Бізді қайдан білдіңіз?» жауаптары бойынша сол сандар.
 *   4) Telegram хабарламаларын баптау.
 *
 * Сандар — АДАМ саны (ата-ана), брондау саны емес: бір ата-ана екі баласын
 * жазса да, «Брондады» бағанында бір рет саналады.
 */

type AdLink = { id: string; name: string; channel: string; campaign: string; created_at: string };
type ParentRow = { id: string; utm_source: string | null; utm_campaign: string | null; heard_from: string | null };
type RegRow = { id: string; parent_id: string; payment_status: string };
type Funnel = { registered: number; booked: number; paid: number };

const TRANSLIT: Record<string, string> = {
  а: "a", ә: "a", б: "b", в: "v", г: "g", ғ: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "i",
  к: "k", қ: "k", л: "l", м: "m", н: "n", ң: "n", о: "o", ө: "o", п: "p", р: "r", с: "s", т: "t", у: "u",
  ұ: "u", ү: "u", ф: "f", х: "h", һ: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "y", і: "i", ь: "",
  э: "e", ю: "yu", я: "ya",
};

function makeCampaign(name: string): string {
  const base = name
    .toLowerCase()
    .split("")
    .map((ch) => (ch in TRANSLIT ? TRANSLIT[ch] : ch))
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base || "link"}-${suffix}`;
}

function linkUrl(l: AdLink): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://zirotest.com";
  const params = new URLSearchParams({ utm_source: l.channel, utm_medium: "ziro", utm_campaign: l.campaign });
  return `${origin}/?${params.toString()}`;
}

function StatCells({ f }: { f: Funnel }) {
  return (
    <>
      <td className="px-3 py-2.5 text-right font-mono">{f.registered}</td>
      <td className="px-3 py-2.5 text-right font-mono">{f.booked}</td>
      <td className="px-3 py-2.5 text-right font-mono font-semibold text-ink">{f.paid}</td>
    </>
  );
}

function StatHead({ first }: { first: string }) {
  return (
    <thead>
      <tr className="border-b border-ink/10 text-left text-xs text-ink/50">
        <th className="px-3 py-2 font-medium">{first}</th>
        <th className="px-3 py-2 text-right font-medium">Кабинет ашты</th>
        <th className="px-3 py-2 text-right font-medium">Брондады</th>
        <th className="px-3 py-2 text-right font-medium">Төледі</th>
      </tr>
    </thead>
  );
}

export default function AdsPage() {
  const [links, setLinks] = useState<AdLink[]>([]);
  const [parents, setParents] = useState<ParentRow[]>([]);
  const [regs, setRegs] = useState<RegRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [channel, setChannel] = useState<string>(AD_CHANNELS[0].value);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [qrFor, setQrFor] = useState<{ link: AdLink; dataUrl: string } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const { data: linkData, error: linkErr } = await supabase
        .from("ad_links")
        .select("id, name, channel, campaign, created_at")
        .order("created_at", { ascending: false });
      if (linkErr) throw linkErr;

      const parentRows = await fetchAll<ParentRow>((from, to) =>
        supabase
          .from("profiles")
          .select("id, utm_source, utm_campaign, heard_from")
          .eq("role", "parent")
          .order("id")
          .range(from, to)
      );
      const regRows = await fetchAll<RegRow>((from, to) =>
        supabase.from("registrations").select("id, parent_id, payment_status").order("id").range(from, to)
      );

      setLinks((linkData ?? []) as AdLink[]);
      setParents(parentRows);
      setRegs(regRows);
    } catch (err: any) {
      setLoadError(err?.message ?? "Жүктелмеді");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const bookedParents = new Set<string>();
    const paidParents = new Set<string>();
    for (const r of regs) {
      bookedParents.add(r.parent_id);
      if (r.payment_status === "paid") paidParents.add(r.parent_id);
    }
    const empty = (): Funnel => ({ registered: 0, booked: 0, paid: 0 });
    const add = (f: Funnel, p: ParentRow) => {
      f.registered++;
      if (bookedParents.has(p.id)) f.booked++;
      if (paidParents.has(p.id)) f.paid++;
    };

    const knownCampaigns = new Set(links.map((l) => l.campaign));
    const byCampaign: Record<string, Funnel> = {};
    const otherLinks: Record<string, Funnel> = {};
    const noLink = empty();
    const byHeard: Record<string, Funnel> = {};
    const total = empty();

    for (const p of parents) {
      add(total, p);
      if (p.utm_campaign && knownCampaigns.has(p.utm_campaign)) {
        add((byCampaign[p.utm_campaign] ??= empty()), p);
      } else if (p.utm_source || p.utm_campaign) {
        const key = [p.utm_source, p.utm_campaign].filter(Boolean).join(" / ");
        add((otherLinks[key] ??= empty()), p);
      } else {
        add(noLink, p);
      }
      add((byHeard[p.heard_from ?? ""] ??= empty()), p);
    }
    return { byCampaign, otherLinks, noLink, byHeard, total };
  }, [parents, regs, links]);

  async function createLink(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setCreateError("Атауын жазыңыз");
      return;
    }
    setCreating(true);
    setCreateError(null);
    const { error } = await supabase
      .from("ad_links")
      .insert({ name: trimmed, channel, campaign: makeCampaign(trimmed) });
    setCreating(false);
    if (error) {
      setCreateError(error.message);
      return;
    }
    setName("");
    load();
  }

  async function copyLink(l: AdLink) {
    try {
      await navigator.clipboard.writeText(linkUrl(l));
      setCopiedId(l.id);
      setTimeout(() => setCopiedId((c) => (c === l.id ? null : c)), 2000);
    } catch {
      window.prompt("Сілтемені көшіріңіз:", linkUrl(l));
    }
  }

  async function showQr(l: AdLink) {
    const QRCode = (await import("qrcode")).default;
    // Баспаға жарайтындай үлкен: 1200 px.
    const dataUrl = await QRCode.toDataURL(linkUrl(l), { width: 1200, margin: 2, errorCorrectionLevel: "M" });
    setQrFor({ link: l, dataUrl });
  }

  async function deleteLink(id: string) {
    const { error } = await supabase.from("ad_links").delete().eq("id", id);
    setDeleteId(null);
    if (error) {
      setLoadError(error.message);
      return;
    }
    load();
  }

  const otherLinkKeys = Object.keys(stats.otherLinks).sort();
  const heardKeys = [...HEARD_FROM_OPTIONS.map((o) => o.value as string), ""];

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="font-display text-2xl font-bold text-admin">Жарнама</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink/60">
          Әр жарнамаға бөлек сілтеме жасаңыз. Ата-ана сол сілтемемен кіріп, 30 күн ішінде кабинет ашса, ол осы
          кестеде көрінеді. Сандар — ата-ана саны.
        </p>
      </div>

      {loadError && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</p>}

      {/* 1. Жаңа сілтеме */}
      <section className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm">
        <h2 className="font-display text-lg font-bold text-ink">Жаңа сілтеме</h2>
        <form onSubmit={createLink} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-ink/70">Атауы</label>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setCreateError(null);
              }}
              placeholder="Шымкент баннер"
              className="focus-ring w-full rounded-xl border border-ink/15 px-4 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink/70">Қайда тұрады</label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="focus-ring w-full rounded-xl border border-ink/15 px-3 py-2.5 text-sm sm:w-48"
            >
              {AD_CHANNELS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={creating}
            className="focus-ring rounded-full bg-admin px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {creating ? "Жасалуда..." : "Сілтеме жасау"}
          </button>
        </form>
        {createError && <p className="mt-2 text-sm text-red-600">{createError}</p>}
      </section>

      {/* 2. Сілтемелер бойынша */}
      <section>
        <h2 className="font-display text-lg font-bold text-ink">Сілтемелер бойынша</h2>
        {loading ? (
          <p className="mt-3 text-sm text-ink/50">Жүктелуде...</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-2xl border border-ink/10 bg-white">
            <table className="w-full min-w-[640px] text-sm text-ink/80">
              <StatHead first="Сілтеме" />
              <tbody>
                {links.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-ink/50">
                      Әзірге сілтеме жоқ. Жоғарыдағы формадан алғашқысын жасаңыз.
                    </td>
                  </tr>
                )}
                {links.map((l) => (
                  <tr key={l.id} className="border-b border-ink/5 align-top">
                    <td className="px-3 py-2.5">
                      <p className="font-semibold text-ink">{l.name}</p>
                      <p className="text-xs text-ink/50">{channelLabel(l.channel)}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          onClick={() => copyLink(l)}
                          className="focus-ring rounded-full border border-ink/15 px-3 py-1 text-xs font-semibold hover:bg-ink/5"
                        >
                          {copiedId === l.id ? "Көшірілді ✓" : "Сілтемені көшіру"}
                        </button>
                        <button
                          onClick={() => showQr(l)}
                          className="focus-ring rounded-full border border-ink/15 px-3 py-1 text-xs font-semibold hover:bg-ink/5"
                        >
                          QR-код
                        </button>
                        {deleteId === l.id ? (
                          <span className="flex items-center gap-2 text-xs">
                            Өшіру керек пе?
                            <button
                              onClick={() => deleteLink(l.id)}
                              className="focus-ring rounded-full bg-red-600 px-3 py-1 font-semibold text-white"
                            >
                              Иә
                            </button>
                            <button
                              onClick={() => setDeleteId(null)}
                              className="focus-ring rounded-full border border-ink/15 px-3 py-1 font-semibold"
                            >
                              Жоқ
                            </button>
                          </span>
                        ) : (
                          <button
                            onClick={() => setDeleteId(l.id)}
                            className="focus-ring rounded-full px-3 py-1 text-xs font-semibold text-ink/45 hover:text-red-600"
                          >
                            Өшіру
                          </button>
                        )}
                      </div>
                    </td>
                    <StatCells f={stats.byCampaign[l.campaign] ?? { registered: 0, booked: 0, paid: 0 }} />
                  </tr>
                ))}
                {otherLinkKeys.map((k) => (
                  <tr key={k} className="border-b border-ink/5">
                    <td className="px-3 py-2.5">
                      <p className="text-ink">{k}</p>
                      <p className="text-xs text-ink/50">Мұнда жасалмаған сілтеме</p>
                    </td>
                    <StatCells f={stats.otherLinks[k]} />
                  </tr>
                ))}
                <tr className="border-b border-ink/5">
                  <td className="px-3 py-2.5 text-ink/60">Сілтемесіз келгендер</td>
                  <StatCells f={stats.noLink} />
                </tr>
                <tr className="bg-parchment/60">
                  <td className="px-3 py-2.5 font-semibold text-ink">Барлығы</td>
                  <StatCells f={stats.total} />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 3. Өз жауабы */}
      <section>
        <h2 className="font-display text-lg font-bold text-ink">«Бізді қайдан білдіңіз?» жауаптары</h2>
        <p className="mt-1 text-sm text-ink/55">Тіркелгенде ата-ана өзі таңдайды. Бұрын тіркелгендерде жауап жоқ.</p>
        {!loading && (
          <div className="mt-3 overflow-x-auto rounded-2xl border border-ink/10 bg-white">
            <table className="w-full min-w-[520px] text-sm text-ink/80">
              <StatHead first="Жауап" />
              <tbody>
                {heardKeys.map((k) => (
                  <tr key={k || "none"} className="border-b border-ink/5">
                    <td className={`px-3 py-2.5 ${k ? "text-ink" : "text-ink/50"}`}>{heardFromLabel(k)}</td>
                    <StatCells f={stats.byHeard[k] ?? { registered: 0, booked: 0, paid: 0 }} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 4. Telegram */}
      <TelegramSettings />

      {qrFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setQrFor(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <p className="font-display text-lg font-bold text-ink">{qrFor.link.name}</p>
            <img src={qrFor.dataUrl} alt={`QR: ${qrFor.link.name}`} className="mx-auto mt-4 w-64 max-w-full" />
            <p className="mt-2 text-xs text-ink/50">Баннерге немесе парақшаға басып шығаруға жарайды.</p>
            <div className="mt-4 flex justify-center gap-2">
              <a
                href={qrFor.dataUrl}
                download={`ziro-qr-${qrFor.link.campaign}.png`}
                className="focus-ring rounded-full bg-admin px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
              >
                Жүктеп алу
              </a>
              <button
                onClick={() => setQrFor(null)}
                className="focus-ring rounded-full border border-ink/15 px-5 py-2.5 text-sm font-semibold"
              >
                Жабу
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

type FoundChat = { id: string; name: string; added: boolean };

function TelegramSettings() {
  const [status, setStatus] = useState<{
    hasToken: boolean;
    botName: string | null;
    chats: { chat_id: string; name: string | null }[];
  } | null>(null);
  const [found, setFound] = useState<FoundChat[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function call(action: string, extra: Record<string, unknown> = {}) {
    const { data } = await supabase.auth.getSession();
    const res = await fetch("/api/telegram/setup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.session?.access_token ?? ""}`,
      },
      body: JSON.stringify({ action, ...extra }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error ?? `Қате ${res.status}`);
    return json;
  }

  async function refresh() {
    try {
      setStatus(await call("status"));
    } catch (err: any) {
      setMessage({ ok: false, text: err.message });
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
    } catch (err: any) {
      setMessage({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm">
      <h2 className="font-display text-lg font-bold text-ink">Telegram хабарламалары</h2>
      <p className="mt-1 text-sm text-ink/60">
        Жаңа брондау жасалғанда және ата-ана түбіртек жібергенде қосылған чаттарға хабарлама келеді.
      </p>

      {!status ? (
        <p className="mt-3 text-sm text-ink/50">Тексерілуде...</p>
      ) : !status.hasToken ? (
        <p className="mt-3 rounded-xl bg-gold/10 px-4 py-3 text-sm text-ink/80">
          Бот әлі қосылмаған: Vercel баптауларында TELEGRAM_BOT_TOKEN жоқ. Токенді қосып, сайтты қайта
          жариялағаннан кейін осы бетті жаңартыңыз.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          <p className="text-sm text-ink/70">
            Бот: {status.botName ? <b>@{status.botName}</b> : <span className="text-red-600">токен дұрыс емес</span>}
          </p>

          <div>
            <p className="text-sm font-semibold text-ink">Қосылған чаттар</p>
            {status.chats.length === 0 ? (
              <p className="mt-1 text-sm text-ink/50">Әзірге жоқ.</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {status.chats.map((c) => (
                  <li key={c.chat_id} className="flex items-center justify-between rounded-xl bg-parchment px-3 py-2 text-sm">
                    <span>{c.name || c.chat_id}</span>
                    <button
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          await call("remove", { chatId: c.chat_id });
                          await refresh();
                        })
                      }
                      className="focus-ring rounded-full px-3 py-1 text-xs font-semibold text-ink/50 hover:text-red-600"
                    >
                      Өшіру
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-dashed border-ink/15 p-4">
            <p className="text-sm text-ink/70">
              Жаңа чат қосу: Telegram-да ботқа {status.botName ? <b>@{status.botName}</b> : "ботқа"} кез келген
              хабарлама жазыңыз, сосын мына түймені басыңыз.
            </p>
            <button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const json = await call("find");
                  setFound(json.chats ?? []);
                })
              }
              className="focus-ring mt-3 rounded-full border border-admin px-4 py-2 text-sm font-semibold text-admin hover:bg-admin-soft disabled:opacity-50"
            >
              Ботқа жазған чаттарды табу
            </button>
            {found && found.length === 0 && (
              <p className="mt-2 text-sm text-ink/50">Табылмады. Ботқа хабарлама жазып, қайта басыңыз.</p>
            )}
            {found && found.length > 0 && (
              <ul className="mt-3 flex flex-col gap-2">
                {found.map((c) => {
                  const added = status.chats.some((x) => x.chat_id === c.id);
                  return (
                    <li key={c.id} className="flex items-center justify-between rounded-xl bg-parchment px-3 py-2 text-sm">
                      <span>{c.name}</span>
                      {added ? (
                        <span className="text-xs font-semibold text-mint">Қосылған ✓</span>
                      ) : (
                        <button
                          disabled={busy}
                          onClick={() =>
                            run(async () => {
                              await call("add", { chatId: c.id, name: c.name });
                              await refresh();
                              setMessage({ ok: true, text: `«${c.name}» қосылды, чатқа сынақ хабарлама кетті.` });
                            })
                          }
                          className="focus-ring rounded-full bg-admin px-3 py-1 text-xs font-semibold text-white hover:opacity-90"
                        >
                          Қосу
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {status.chats.length > 0 && (
            <button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await call("test");
                  setMessage({ ok: true, text: "Сынақ хабарлама жіберілді." });
                })
              }
              className="focus-ring self-start rounded-full border border-ink/15 px-4 py-2 text-sm font-semibold hover:bg-ink/5 disabled:opacity-50"
            >
              Сынақ хабарлама жіберу
            </button>
          )}
        </div>
      )}

      {message && (
        <p className={`mt-3 text-sm ${message.ok ? "text-mint" : "text-red-600"}`}>{message.text}</p>
      )}
    </section>
  );
}
