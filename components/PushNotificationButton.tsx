"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export default function PushNotificationButton() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    setSupported(true);

    navigator.serviceWorker.ready.then(async (reg) => {
      const existing = await reg.pushManager.getSubscription();
      setSubscribed(!!existing);
    });
  }, []);

  async function handleEnable() {
    setLoading(true);
    setError("");

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError("Рұқсат берілмеді. Браузер баптауларынан қосуға болады.");
        setLoading(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      });

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("no user");

      const json = subscription.toJSON();
      const { error: dbError } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: userData.user.id,
          endpoint: json.endpoint!,
          p256dh: json.keys!.p256dh,
          auth: json.keys!.auth,
        },
        { onConflict: "endpoint" }
      );
      if (dbError) throw dbError;

      setSubscribed(true);
    } catch (err: any) {
      console.error("Push subscribe failed:", err);
      setError("Қате шықты: " + (err?.message ?? "белгісіз қате"));
    } finally {
      setLoading(false);
    }
  }

  if (!supported) return null;

  if (subscribed) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-parent-soft px-3 py-1.5 text-xs font-semibold text-parent">
        Хабарландырулар қосулы ✓
      </span>
    );
  }

  return (
    <div>
      <button
        onClick={handleEnable}
        disabled={loading}
        className="focus-ring rounded-full border border-admin px-4 py-1.5 text-xs font-semibold text-admin hover:bg-admin-soft disabled:opacity-50"
      >
        {loading ? "Қосылуда..." : "Хабарландыруларды қосу"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
