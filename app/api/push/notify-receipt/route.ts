import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

webpush.setVapidDetails(
  "mailto:gulzhanmin1@gmail.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

// Uses the service-role key since this route is called server-to-server
// by a database trigger (pg_net), not by a logged-in user — there's no
// session to authenticate against RLS with.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { registrationId } = await req.json();
    if (!registrationId) {
      return NextResponse.json({ error: "registrationId required" }, { status: 400 });
    }

    const { data: registration } = await supabaseAdmin
      .from("registrations")
      .select("id, students ( full_name )")
      .eq("id", registrationId)
      .single();

    const studentName = (registration as any)?.students?.full_name ?? "Белгісіз оқушы";

    const { data: subscriptions } = await supabaseAdmin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth");

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ sent: 0 });
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

    return NextResponse.json({ sent });
  } catch (err: any) {
    console.error("notify-receipt failed:", err);
    return NextResponse.json({ error: err?.message ?? "unknown error" }, { status: 500 });
  }
}
