import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Telegram хабарламалары (тек сервер жағында).
 *
 * TELEGRAM_BOT_TOKEN — Vercel-дегі баптау (BotFather берген токен).
 * Кімге жіберу — telegram_chats кестесі (065). Оны админкадағы
 * «Жарнама» бетінде «Қосу» түймесі толтырады.
 */

export async function getTelegramChats(admin: SupabaseClient): Promise<{ chat_id: string; name: string | null }[]> {
  const { data, error } = await admin.from("telegram_chats").select("chat_id, name").order("created_at");
  if (error) {
    console.error("telegram_chats read failed:", error);
    return [];
  }
  return (data ?? []) as any;
}

export async function getTelegramChatIds(admin: SupabaseClient): Promise<string[]> {
  return (await getTelegramChats(admin)).map((c) => c.chat_id);
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Бір чатқа жібереді. Қате болса — сипаттамасын қайтарады. */
export async function sendTelegramMessage(chatId: string, html: string): Promise<string | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return "TELEGRAM_BOT_TOKEN жоқ";
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: html,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) return json?.description ?? `HTTP ${res.status}`;
    return null;
  } catch (err: any) {
    return err?.message ?? "network error";
  }
}

/** Барлық сақталған чаттарға жібереді. Жіберілген санын қайтарады. */
export async function notifyTelegram(admin: SupabaseClient, html: string): Promise<number> {
  if (!process.env.TELEGRAM_BOT_TOKEN) return 0;
  const chatIds = await getTelegramChatIds(admin);
  let sent = 0;
  for (const id of chatIds) {
    const err = await sendTelegramMessage(id, html);
    if (err) console.error(`telegram send to ${id} failed:`, err);
    else sent++;
  }
  return sent;
}

/** Бір брондау туралы хабарламаға керек мәліметтер. */
export async function loadBookingInfo(admin: SupabaseClient, registrationId: string) {
  const { data: reg } = await admin
    .from("registrations")
    .select(
      "id, format, parent_id, students ( full_name ), test_sessions ( title_kk, session_date, price ), test_types ( code, name_kk )"
    )
    .eq("id", registrationId)
    .maybeSingle();
  if (!reg) return null;

  const { data: parent } = await admin
    .from("profiles")
    .select("full_name, phone, heard_from, utm_campaign, utm_source")
    .eq("id", (reg as any).parent_id)
    .maybeSingle();

  let adLinkName: string | null = null;
  const campaign = (parent as any)?.utm_campaign;
  if (campaign) {
    const { data: link } = await admin.from("ad_links").select("name").eq("campaign", campaign).maybeSingle();
    adLinkName = (link as any)?.name ?? null;
  }

  return { reg: reg as any, parent: parent as any, adLinkName };
}
