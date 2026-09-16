import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { escapeHtml, loadBookingInfo, notifyTelegram } from "@/lib/telegram";

/**
 * Ата-ана төлем түбіртегін жібергенде шақырылады (041, pg_net триггері).
 * Екі хабарлама жібереді: Telegram (065-тен бастап) және бұрынғы
 * телефондағы push. Біреуі бапталмаса, екіншісі бәрібір жүреді.
 */
export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("notify-receipt: missing supabase env vars");
      return NextResponse.json({ error: "server not configured" }, { status: 500 });
    }

    // Uses the service-role key since this route is called server-to-server
    // by a database trigger (pg_net), not by a logged-in user — there's no
    // session to authenticate against RLS with.
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { registrationId } = await req.json();
    if (!registrationId) {
      return NextResponse.json({ error: "registrationId required" }, { status: 400 });
    }

    const info = await loadBookingInfo(supabaseAdmin, registrationId);
    if (!info) return NextResponse.json({ sent: 0, telegram: 0 });

    const studentName = info.reg.students?.full_name ?? "Белгісіз оқушы";

    // --- Telegram ---
    const price = info.reg.test_sessions?.price;
    const format = info.reg.format === "online" ? "Онлайн" : "Офлайн";
    const telegramText = [
      "💳 <b>Түбіртек жіберілді — растау керек</b>",
      "",
      `Оқушы: <b>${escapeHtml(studentName)}</b>`,
      `Тест: ${escapeHtml(info.reg.test_types?.code ?? "—")} · ${format}`,
      `Сессия: ${escapeHtml(info.reg.test_sessions?.title_kk ?? "—")}`,
      price != null ? `Сомасы: ${Number(price).toLocaleString("ru-RU").replace(/,/g, " ")} теңге` : "",
      `Ата-ана: ${escapeHtml(info.parent?.full_name ?? "—")}${info.parent?.phone ? `, ${escapeHtml(info.parent.phone)}` : ""}`,
      "",
      "Растау: zirotest.com/admin/bookings",
    ]
      .filter((l, i, arr) => !(l === "" && arr[i - 1] === ""))
      .join("\n");
    const telegram = await notifyTelegram(supabaseAdmin, telegramText);

    // --- Push (телефондағы қосымша) ---
    const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
    if (!vapidPublic || !vapidPrivate) {
      return NextResponse.json({ sent: 0, telegram });
    }

    webpush.setVapidDetails("mailto:gulzhanmin1@gmail.com", vapidPublic, vapidPrivate);

    const { data: subscriptions } = await supabaseAdmin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth");

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ sent: 0, telegram });
    }

    const payload = JSON.stringify({
      title: "Жаңа түбіртек",
      body: `${studentName} төлем түбіртегін жіберді.`,
      url: "/admin/bookings",
    });

    let sent = 0;
    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        sent++;
      } catch (err: any) {
        // A 404/410 means the subscription is dead (uninstalled, expired) — clean it up.
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
      }
    }

    return NextResponse.json({ sent, telegram });
  } catch (err: any) {
    console.error("notify-receipt failed:", err);
    return NextResponse.json({ error: err?.message ?? "unknown error" }, { status: 500 });
  }
}
