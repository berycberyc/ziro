/**
 * Түбіртекті жүктер алдында кішірейту.
 *
 * Неге керек: телефоннан түсірілген скриншот 1–3 МБ, экранның суреті 5 МБ-қа
 * дейін жетеді. Бір байқау тестке 200 адам келсе — 400 МБ. Ал түбіртектен
 * бізге керегі жалғыз нәрсе: сомасы мен күні оқылсын. 1600 пиксель мен JPEG
 * сапасы 0.72 ол үшін артығымен жетеді, көлемі 10 есеге дейін кемиді.
 *
 * PDF (Kaspi-дің «чекті сақтау» түрі) қысылмайды — ол онсыз да жеңіл.
 */

/** Одан үлкен файлды мүлдем қабылдамаймыз. */
export const MAX_RECEIPT_BYTES = 15 * 1024 * 1024;

const MAX_SIDE = 1600;
const QUALITY = 0.72;

export async function compressReceipt(file: File): Promise<File> {
  // Суретті емес нәрсені (PDF) қолданбаймыз — сол күйі жіберіледі.
  if (!file.type.startsWith("image/")) return file;

  // Кішкентай файлды қайта қысудың қажеті жоқ.
  if (file.size <= 400 * 1024) return file;

  const bitmap = await loadImage(file);

  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return file;

  // Ақ фон: мөлдір PNG-ді JPEG-ке айналдырғанда қара болып кетпеуі үшін.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", QUALITY)
  );

  // Бір жері сәтсіз болса — түпнұсқаны жібереміз, жүктеу тоқтап қалмасын.
  if (!blob || blob.size >= file.size) return file;

  return new File([blob], "receipt.jpg", { type: "image/jpeg" });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image_load_failed"));
    };
    img.src = url;
  });
}

/**
 * Жабық қоймадағы файлға уақытша сілтеме сұрау.
 *
 * receipt_url бұрын толық сілтеме сақтайтын, енді жол сақтайды. Ескі
 * жазбалар 057 миграциясында түзетілді, бірақ кенет "https://" қалып қойса
 * оны сол күйі қайтарамыз — админ бос экран көрмесін.
 */
export async function receiptSignedUrl(
  storage: {
    from: (bucket: string) => {
      createSignedUrl: (
        path: string,
        expiresIn: number
      ) => Promise<{ data: { signedUrl: string } | null; error: unknown }>;
    };
  },
  receiptPath: string
): Promise<string | null> {
  if (receiptPath.startsWith("http")) return receiptPath;

  const { data, error } = await storage
    .from("receipts")
    .createSignedUrl(receiptPath, 60 * 10);

  if (error || !data) return null;
  return data.signedUrl;
}
