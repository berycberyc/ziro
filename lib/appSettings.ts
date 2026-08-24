import { supabase } from "@/lib/supabase";

/**
 * Сайттың шағын баптаулары (app_settings кестесі).
 * Қазір тек Kaspi QR суреті мен төлем сілтемесі бар — кодта қатырылған
 * файл мен URL-дің орнына. Админ панельден өзгертіледі, деплой қажет емес.
 */

export const KASPI_QR_URL = "kaspi_qr_url";
export const KASPI_PAY_LINK = "kaspi_pay_link";
export const CONTACT_PHONE = "contact_phone";

/** Бірнеше баптауды бір сұраныспен оқиды. Табылмаған кілт — null. */
export async function getSettings(keys: string[]): Promise<Record<string, string | null>> {
  const result: Record<string, string | null> = {};
  keys.forEach((k) => {
    result[k] = null;
  });

  const { data, error } = await supabase.from("app_settings").select("key, value").in("key", keys);
  if (error) {
    console.error("Failed to load app settings:", error);
    return result;
  }

  (data ?? []).forEach((row: any) => {
    result[row.key] = row.value ?? null;
  });
  return result;
}

/** Баптауды сақтайды (жоқ болса — жасайды). value=null → мәнді тазалау. */
export async function setSetting(key: string, value: string | null): Promise<void> {
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw error;
}
