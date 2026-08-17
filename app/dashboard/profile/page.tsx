"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useLang } from "@/lib/LangContext";

export default function ProfilePage() {
  const { t } = useLang();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user;
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", user.id)
        .single();
      setFullName(profile?.full_name ?? "");
      setPhone(profile?.phone ?? "");
    });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSavedMessage("");

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      setLoading(false);
      return;
    }

    await supabase
      .from("profiles")
      .update({ full_name: fullName, phone })
      .eq("id", user.id);

    if (newPassword.trim().length > 0) {
      await supabase.auth.updateUser({ password: newPassword });
      setNewPassword("");
    }

    setLoading(false);
    setSavedMessage(t.saved);
    setTimeout(() => setSavedMessage(""), 3000);
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink">{t.profileTitle}</h1>

      <form onSubmit={handleSave} className="mt-6 flex max-w-md flex-col gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink/70">{t.fullName}</label>
          <input
            className="focus-ring w-full rounded-xl border border-ink/15 bg-white px-4 py-2.5 text-sm"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink/70">{t.phone}</label>
          <input
            className="focus-ring w-full rounded-xl border border-ink/15 bg-white px-4 py-2.5 text-sm"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink/70">
            {t.newPasswordLabel}
          </label>
          <input
            type="password"
            className="focus-ring w-full rounded-xl border border-ink/15 bg-white px-4 py-2.5 text-sm"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>

        {savedMessage && <p className="text-sm text-parent">{savedMessage}</p>}

        <button
          type="submit"
          disabled={loading}
          className="focus-ring self-start rounded-full bg-parent px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {t.save}
        </button>
      </form>
    </div>
  );
}
