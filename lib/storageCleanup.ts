/**
 * Қоймадан ескірген файлды өшіру.
 *
 * Неге керек: жүйе файлдарды әрқашан жаңа атпен жүктейді (атында уақыт
 * белгісі бар), ал ескісін ешкім өшірмейтін. Дерекқордағы сілтеме
 * ауысады да, ескі файл қоймада мәңгі жатып қалады. Бір нұсқаны бес рет
 * қайта жүктесе — суреттердің бес жинағы жиналады, оның төртеуі керексіз.
 *
 * Тәртібі маңызды: алдымен ЖАҢА файл жүктеледі, дерекқор жаңарады, содан
 * КЕЙІН ғана ескісі өшіріледі. Керісінше істесе, жаңа файл жүктелмей
 * қалған жағдайда ескісі де жоқ, жаңасы да жоқ болып қалар еді.
 *
 * Өшіру сәтсіз болса — үнсіз өтеді: артық файл қалғаны жаман, бірақ
 * пайдаланушының жұмысын тоқтатуға тұрарлық емес.
 */
import { supabase } from "@/lib/supabase";

/** Ашық сілтемеден қоймадағы жолды алады. */
export function pathFromPublicUrl(url: string | null, bucket: string): string | null {
  if (!url) return null;
  const marker = `/object/public/${bucket}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  return decodeURIComponent(url.slice(i + marker.length));
}

/** Бір файлды өшіреді. Сілтеме бос болса — ештеңе істемейді. */
export async function removeStoredFile(bucket: string, url: string | null): Promise<void> {
  const path = pathFromPublicUrl(url, bucket);
  if (!path) return;
  try {
    await supabase.storage.from(bucket).remove([path]);
  } catch (err) {
    console.warn(`Ескі файл өшірілмеді (${bucket}): `, err);
  }
}

/** Бірнеше файлды бір рет өшіреді. */
export async function removeStoredFiles(
  bucket: string,
  urls: (string | null | undefined)[]
): Promise<void> {
  const paths = urls
    .map((u) => pathFromPublicUrl(u ?? null, bucket))
    .filter((p): p is string => Boolean(p));
  if (paths.length === 0) return;
  try {
    await supabase.storage.from(bucket).remove(paths);
  } catch (err) {
    console.warn(`Ескі файлдар өшірілмеді (${bucket}): `, err);
  }
}
