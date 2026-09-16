import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getTelegramChats, sendTelegramMessage } from "@/lib/telegram";

/**
 * Админкадағы Telegram баптауы. Тек әкімші шақыра алады:
 * браузер өз сессиясының токенін жібереді, біз оны тексереміз.
 *
 * action:
 *   "status" — токен бар ма, қай чаттар қосылған
 *   "find"   — ботқа жазған чаттарды табу (getUpdates)
 *   "add"    — чатты тізімге қосу + сынақ хабарлама
 *   "remove" — чатты тізімнен алып тастау
 *   "test"   — барлық чатқа сынақ хабарлама
 */
export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Сервер бапталмаған" }, { status: 500 });
  }
  const admin = createClient(supabaseUrl, serviceRoleKey);

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Кіру керек" }, { status: 401 });
  const { data: userData } = await admin.auth.getUser(token);
  if (!userData?.user) return NextResponse.json({ error: "Кіру керек" }, { status: 401 });
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();
  if ((profile as any)?.role !== "admin") {
    return NextResponse.json({ error: "Тек әкімші" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const action = body?.action as string;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chats = await getTelegramChats(admin);
  const chatIds = chats.map((c) => c.chat_id);

  if (action === "status") {
    let botName: string | null = null;
    if (botToken) {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`).catch(() => null);
      const json = res ? await res.json().catch(() => null) : null;
      botName = json?.ok ? json.result.username : null;
    }
    return NextResponse.json({ hasToken: !!botToken, botName, chats });
  }

  if (!botToken) {
    return NextResponse.json({ error: "Vercel-де TELEGRAM_BOT_TOKEN жоқ" }, { status: 400 });
  }

  if (action === "find") {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates`).catch(() => null);
    const json = res ? await res.json().catch(() => null) : null;
    if (!json?.ok) {
      return NextResponse.json({ error: json?.description ?? "Telegram жауап бермеді" }, { status: 400 });
    }
    const found = new Map<string, string>();
    for (const u of json.result ?? []) {
      const chat = u.message?.chat ?? u.my_chat_member?.chat ?? u.channel_post?.chat;
      if (!chat) continue;
      const name =
        chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(" ") || chat.username || "";
      found.set(String(chat.id), name || String(chat.id));
    }
    return NextResponse.json({
      chats: [...found.entries()].map(([id, name]) => ({ id, name, added: chatIds.includes(id) })),
    });
  }

  if (action === "add") {
    const id = String(body?.chatId ?? "").trim();
    const name = String(body?.name ?? "").slice(0, 100) || null;
    if (!id) return NextResponse.json({ error: "chatId керек" }, { status: 400 });
    const err = await sendTelegramMessage(id, "✅ Ziro хабарламалары осы чатқа келеді.");
    if (err) return NextResponse.json({ error: `Жіберілмеді: ${err}` }, { status: 400 });
    const { error } = await admin.from("telegram_chats").upsert({ chat_id: id, name }, { onConflict: "chat_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "remove") {
    const id = String(body?.chatId ?? "").trim();
    const { error } = await admin.from("telegram_chats").delete().eq("chat_id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "test") {
    if (chatIds.length === 0) return NextResponse.json({ error: "Бірде-бір чат қосылмаған" }, { status: 400 });
    const errors: string[] = [];
    for (const id of chatIds) {
      const err = await sendTelegramMessage(id, "🔔 Сынақ хабарлама: Ziro хабарламалары жұмыс істеп тұр.");
      if (err) errors.push(`${id}: ${err}`);
    }
    if (errors.length) return NextResponse.json({ error: errors.join("; ") }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Белгісіз әрекет" }, { status: 400 });
}
