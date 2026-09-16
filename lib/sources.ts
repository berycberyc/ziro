/**
 * Ата-ана қайдан келгені: «Бізді қайдан білдіңіз?» жауаптары және
 * жарнама сілтемесінің арнасы (қайда орналастырылады).
 *
 * value — базаға жазылатын мән, оны өзгертпеңіз: ескі жазбалар
 * статистикадан түсіп қалады. Жазуын (kk / ru) еркін өзгертуге болады.
 */

export const HEARD_FROM_OPTIONS = [
  { value: "instagram", kk: "Instagram", ru: "Instagram" },
  { value: "whatsapp", kk: "WhatsApp", ru: "WhatsApp" },
  { value: "friends", kk: "Таныстар", ru: "Знакомые" },
  { value: "teacher", kk: "Мұғалім", ru: "Учитель" },
  { value: "ads", kk: "Баннер, жарнама", ru: "Баннер, реклама" },
  { value: "other", kk: "Басқа", ru: "Другое" },
] as const;

export function heardFromLabel(value: string | null | undefined, lang: "kk" | "ru" = "kk"): string {
  if (!value) return lang === "kk" ? "Жауап жоқ" : "Нет ответа";
  const opt = HEARD_FROM_OPTIONS.find((o) => o.value === value);
  return opt ? opt[lang] : value;
}

/** Жарнама сілтемесі қайда тұрады — utm_source осыдан алынады. */
export const AD_CHANNELS = [
  { value: "instagram", label: "Instagram" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "telegram", label: "Telegram" },
  { value: "2gis", label: "2ГИС" },
  { value: "banner", label: "Баннер (QR)" },
  { value: "leaflet", label: "Парақша (QR)" },
  { value: "other", label: "Басқа" },
] as const;

export function channelLabel(value: string | null | undefined): string {
  if (!value) return "—";
  const ch = AD_CHANNELS.find((c) => c.value === value);
  return ch ? ch.label : value;
}
