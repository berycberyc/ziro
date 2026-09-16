import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { escapeHtml, loadBookingInfo, notifyTelegram } from "@/lib/telegram";
import { heardFromLabel } from "@/lib/sources";

/**
 * Жаңа брондау туралы Telegram хабарламасы.
 * Базадағы триггер шақырады (065, pg_net) — кірген пайдаланушы жоқ,
 * сондықтан service-role кілті қолданылады. Тек id қабылдайды: бөтен
 * адам шақырса да, ол ешкімге белгісіз брондау id-ін таба алмайды.
 */
export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "server not configured" }, { status: 500 });
    }
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { registrationId } = await req.json();
    if (!registrationId) {
      return NextResponse.json({ error: "registrationId required" }, { status: 400 });
    }

    const info = await loadBookingInfo(admin, registrationId);
    if (!info) return NextResponse.json({ sent: 0 });

    const { reg, parent, adLinkName } = info;
    const format = reg.format === "online" ? "Онлайн" : "Офлайн";
    const session = reg.test_sessions;
    const date = session?.session_date ? formatDate(session.session_date) : "";

    const lines = [
      "🆕 <b>Жаңа брондау</b>",
      "",
      `Оқушы: <b>${escapeHtml(reg.students?.full_name ?? "—")}</b>`,
      `Тест: ${escapeHtml(reg.test_types?.code ?? "—")} · ${format}`,
      `Сессия: ${escapeHtml(session?.title_kk ?? "—")}${date ? ` (${date})` : ""}`,
      `Ата-ана: ${escapeHtml(parent?.full_name ?? "—")}${parent?.phone ? `, ${escapeHtml(parent.phone)}` : ""}`,
      `Қайдан: ${escapeHtml(sourceText(parent, adLinkName))}`,
      "",
      "Төлем әлі жоқ.",
    ];

    const sent = await notifyTelegram(admin, lines.join("\n"));
    return NextResponse.json({ sent });
  } catch (err: any) {
    console.error("notify booking failed:", err);
    return NextResponse.json({ error: err?.message ?? "unknown error" }, { status: 500 });
  }
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}

function sourceText(parent: any, adLinkName: string | null): string {
  const parts: string[] = [];
  if (adLinkName) parts.push(`сілтеме «${adLinkName}»`);
  else if (parent?.utm_source || parent?.utm_campaign)
    parts.push(`сілтеме ${[parent.utm_source, parent.utm_campaign].filter(Boolean).join(" / ")}`);
  if (parent?.heard_from) parts.push(`өзі: ${heardFromLabel(parent.heard_from)}`);
  return parts.length ? parts.join("; ") : "белгісіз";
}
