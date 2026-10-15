import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

/**
 * Аудитория парақтары: бір аудиторияның әр оқушысына бір A4 бет, орын
 * бойынша реттелген. Бетті оқушы отырған партаға қояды, сондықтан
 * «Аудитория» мен «Орын» ең үлкен болып тұрады.
 *
 * НЕГЕ html2canvas ЕМЕС. Пропуск суретке түсіріліп, содан PDF-ке
 * салынатын — Firefox-та ондай сурет бос шығып жүр. Мұнда бет тікелей
 * PDF-ке сызылады (pdf-lib): браузерге тәуелсіз, мәтін таңдалады,
 * файл жеңіл, басып шығарғанда анық.
 *
 * Функция таза: қаріп, логотип және фото байттарын СЫРТТАН алады, өзі
 * ештеңе жүктемейді. Сондықтан оны Node-та да тексеруге болады.
 */

export type SeatPassStudent = {
  lastName: string;
  firstName: string;
  classroom: string;
  seat: string;
  /** Базадағы мәні: «2», «Нұсқа 2» және т.б. */
  variant: string;
  lang: "kk" | "ru" | null;
  format: "offline" | "online";
  paid: boolean;
  /** Тест түрінің коды: NIS / BIL / RFMS (немесе атауы). */
  testTypeCode: string;
  testTypeName: string;
  /** QR-дағы мәтін: қысқа код не тіркеу id. */
  qrText: string;
  /** 3:4 JPEG/PNG байттары; жоқ болса — бос орын салынады. */
  photo: { bytes: Uint8Array; kind: "jpg" | "png" } | null;
};

export type SeatPassAssets = {
  fontRegular: ArrayBuffer | Uint8Array;
  fontBold: ArrayBuffer | Uint8Array;
  logoPng: ArrayBuffer | Uint8Array;
};

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 42;

const NAVY = rgb(0x16 / 255, 0x23 / 255, 0x3f / 255);
const GOLD = rgb(0xa8 / 255, 0x7f / 255, 0x26 / 255);
const GOLD_LINE = rgb(0xc6 / 255, 0x9a / 255, 0x3a / 255);
const SOFT = rgb(0xf3 / 255, 0xf5 / 255, 0xf2 / 255);
const GRAY = rgb(0x6b / 255, 0x72 / 255, 0x80 / 255);
const LIGHT_GRAY = rgb(0xd9 / 255, 0xdc / 255, 0xd6 / 255);
const WHITE = rgb(1, 1, 1);
const RED = rgb(0xc6 / 255, 0x28 / 255, 0x28 / 255);

/** Орын бойынша реттеу: 2 < 10, «A-3» < «A-12». */
export function compareSeats(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true });
}

/** «НИШ» / «БИЛ» / «РФМШ» — кодтан, әйтпесе базадағы атаудан. */
export function schoolLabel(code: string, fallbackName: string): string {
  const c = (code ?? "").toUpperCase();
  if (c.startsWith("NIS") || c.startsWith("NISH")) return "НИШ";
  if (c.startsWith("BIL")) return "БИЛ";
  if (c.startsWith("RFM")) return "РФМШ";
  return fallbackName || code || "—";
}

/** «2026-10-18» → «18.10.2026». */
export function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso || "—";
}

/** «10:00:00» → «10:00». */
export function formatTime(t: string | null | undefined): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(t ?? "");
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : t || "—";
}

/** «Нұсқа 2» не «2» → «2». Цифр жоқ болса — мәннің өзі. */
function variantLabel(v: string): string {
  const d = String(v ?? "").replace(/\D/g, "");
  return d || String(v ?? "").trim() || "—";
}

/** Мәтін енін өлшеп, орынға сыйғанша қаріпті кішірейтеді. */
function fitSize(font: PDFFont, text: string, maxWidth: number, size: number, min = 8): number {
  let s = size;
  while (s > min && font.widthOfTextAtSize(text, s) > maxWidth) s -= 0.5;
  return s;
}

/** Дөңгеленген төртбұрыш. yTop — төртбұрыштың ЖОҒАРҒЫ шеті (PDF координатасы). */
function roundedRect(
  page: PDFPage,
  x: number,
  yTop: number,
  w: number,
  h: number,
  r: number,
  opts: { fill?: ReturnType<typeof rgb>; stroke?: ReturnType<typeof rgb>; strokeWidth?: number }
) {
  const path =
    `M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} ` +
    `H ${r} A ${r} ${r} 0 0 1 0 ${h - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
  page.drawSvgPath(path, {
    x,
    y: yTop,
    color: opts.fill,
    borderColor: opts.stroke,
    borderWidth: opts.stroke ? opts.strokeWidth ?? 1 : 0,
  });
}

function centerText(
  page: PDFPage,
  font: PDFFont,
  text: string,
  cx: number,
  y: number,
  size: number,
  color: ReturnType<typeof rgb>
) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: cx - w / 2, y, size, font, color });
}

export async function buildSeatPassesPdf(opts: {
  sessionTitle: string;
  sessionDate: string;
  sessionTime: string | null;
  students: SeatPassStudent[];
  assets: SeatPassAssets;
  onProgress?: (done: number, total: number) => void;
}): Promise<Uint8Array> {
  const { sessionTitle, sessionDate, sessionTime, assets, onProgress } = opts;

  const students = [...opts.students].sort((a, b) => compareSeats(a.seat, b.seat));

  const out = await PDFDocument.create();
  out.registerFontkit(fontkit);
  out.setTitle("Аудитория парақтары");
  out.setCreator("zirotest.com");

  const regular = await out.embedFont(assets.fontRegular, { subset: true });
  const bold = await out.embedFont(assets.fontBold, { subset: true });
  const logo = await out.embedPng(assets.logoPng);

  const QRCode = (await import("qrcode")).default;

  const dateText = formatDate(sessionDate);
  const timeText = formatTime(sessionTime);

  for (let i = 0; i < students.length; i++) {
    const st = students[i];
    const page = out.addPage([A4.width, A4.height]);
    const W = A4.width;
    const cx = W / 2;
    const innerW = W - MARGIN * 2;

    // ---------- шапка: логотип + zirotest.com ----------
    const logoH = 46;
    const logoW = (logo.width / logo.height) * logoH;
    page.drawImage(logo, { x: cx - logoW / 2, y: A4.height - MARGIN - logoH, width: logoW, height: logoH });
    centerText(page, bold, "zirotest.com", cx, A4.height - MARGIN - logoH - 17, 13, GOLD);
    const lineY = A4.height - MARGIN - logoH - 30;
    page.drawLine({
      start: { x: MARGIN, y: lineY },
      end: { x: W - MARGIN, y: lineY },
      thickness: 1,
      color: GOLD_LINE,
    });

    // ---------- екі үлкен карточка: аудитория және орын ----------
    const cardTop = lineY - 20;
    const cardH = 150;
    const gap = 16;
    const cardW = (innerW - gap) / 2;
    const cards: { label: string; value: string }[] = [
      { label: "АУДИТОРИЯ", value: st.classroom || "—" },
      { label: "ОРЫН", value: st.seat || "—" },
    ];
    cards.forEach((c, idx) => {
      const x = MARGIN + idx * (cardW + gap);
      roundedRect(page, x, cardTop, cardW, cardH, 18, { fill: NAVY });
      centerText(page, bold, c.label, x + cardW / 2, cardTop - 36, 14, rgb(0.78, 0.82, 0.9));
      const size = fitSize(bold, c.value, cardW - 28, 96, 28);
      // Мәнді карточканың төменгі бөлігінде тігінен ортаға қоямыз.
      const baseY = cardTop - 46 - (cardH - 46) / 2 - size * 0.36;
      centerText(page, bold, c.value, x + cardW / 2, baseY, size, WHITE);
    });

    // ---------- фото + аты-жөні ----------
    const rowTop = cardTop - cardH - 22;
    const photoW = 153;
    const photoH = 204; // 3:4
    const photoX = MARGIN;
    if (st.photo) {
      const img: PDFImage =
        st.photo.kind === "png"
          ? await out.embedPng(st.photo.bytes)
          : await out.embedJpg(st.photo.bytes);
      // Фото әдетте 3:4 болып келеді (сайтта кесіледі). Пропорциясы басқа
      // болса — созбай, рамкаға сыйғызып ортасына қоямыз.
      if (Math.abs(img.width / img.height - photoW / photoH) < 0.02) {
        page.drawImage(img, { x: photoX, y: rowTop - photoH, width: photoW, height: photoH });
      } else {
        const fit = Math.min(photoW / img.width, photoH / img.height);
        const fw = img.width * fit;
        const fh = img.height * fit;
        page.drawRectangle({ x: photoX, y: rowTop - photoH, width: photoW, height: photoH, color: SOFT });
        page.drawImage(img, {
          x: photoX + (photoW - fw) / 2,
          y: rowTop - photoH + (photoH - fh) / 2,
          width: fw,
          height: fh,
        });
      }
    } else {
      page.drawRectangle({ x: photoX, y: rowTop - photoH, width: photoW, height: photoH, color: SOFT });
      centerText(page, regular, "Фото жоқ", photoX + photoW / 2, rowTop - photoH / 2 - 5, 13, GRAY);
    }
    page.drawRectangle({
      x: photoX,
      y: rowTop - photoH,
      width: photoW,
      height: photoH,
      borderColor: GOLD_LINE,
      borderWidth: 2,
    });

    const nameX = photoX + photoW + 24;
    const nameW = W - MARGIN - nameX;
    let ny = rowTop - 14;

    const drawField = (label: string, value: string) => {
      page.drawText(label, { x: nameX, y: ny, size: 11, font: regular, color: GRAY });
      const text = value || "—";
      const size = fitSize(bold, text, nameW, 30, 12);
      ny -= size + 8;
      page.drawText(text, { x: nameX, y: ny, size, font: bold, color: NAVY });
      ny -= 26;
    };
    drawField("Тегі", st.lastName);
    drawField("Аты", st.firstName);

    // Нұсқа — аты-жөнінің астында ірі белгі.
    const vLabel = "НҰСҚА";
    page.drawText(vLabel, { x: nameX, y: ny, size: 11, font: regular, color: GRAY });
    const vBoxY = ny - 8;
    roundedRect(page, nameX, vBoxY, 96, 62, 12, { fill: SOFT, stroke: GOLD_LINE, strokeWidth: 1.5 });
    const vVal = variantLabel(st.variant);
    const vSize = fitSize(bold, vVal, 80, 42, 16);
    centerText(page, bold, vVal, nameX + 48, vBoxY - 31 - vSize * 0.36, vSize, NAVY);

    // ---------- төменгі бөлік: мәліметтер + QR ----------
    const infoTop = rowTop - photoH - 26;
    const qrSize = 150;
    const qrX = W - MARGIN - qrSize;
    const infoW = qrX - MARGIN - 24;

    const rows: [string, string][] = [
      ["Тест түрі", schoolLabel(st.testTypeCode, st.testTypeName)],
      ["Тіл", st.lang === "ru" ? "Орыс тілі" : st.lang === "kk" ? "Қазақ тілі" : "—"],
      ["Формат", st.format === "online" ? "Онлайн" : "Офлайн"],
      ["Сессия", sessionTitle],
      ["Күні", dateText],
      ["Уақыты", timeText],
    ];
    let ry = infoTop;
    const rowH = 28;
    page.drawLine({ start: { x: MARGIN, y: ry + 8 }, end: { x: MARGIN + infoW, y: ry + 8 }, thickness: 0.6, color: LIGHT_GRAY });
    rows.forEach(([k, v]) => {
      page.drawText(k, { x: MARGIN, y: ry - 14, size: 12, font: regular, color: GRAY });
      const valMaxW = infoW - 90;
      const size = fitSize(bold, v, valMaxW, 15, 9);
      const vw = bold.widthOfTextAtSize(v, size);
      page.drawText(v, { x: MARGIN + infoW - vw, y: ry - 14, size, font: bold, color: NAVY });
      ry -= rowH;
      page.drawLine({ start: { x: MARGIN, y: ry + 8 }, end: { x: MARGIN + infoW, y: ry + 8 }, thickness: 0.6, color: LIGHT_GRAY });
    });

    const qrDataUrl = await QRCode.toDataURL(st.qrText, { width: 480, margin: 1 });
    const qrImg = await out.embedPng(qrDataUrl);
    roundedRect(page, qrX - 8, infoTop + 8, qrSize + 16, qrSize + 16, 14, { fill: WHITE, stroke: LIGHT_GRAY, strokeWidth: 1 });
    page.drawImage(qrImg, { x: qrX, y: infoTop + 8 - 8 - qrSize, width: qrSize, height: qrSize });
    centerText(page, regular, st.qrText, qrX + qrSize / 2, infoTop - qrSize - 28, 11, GRAY);

    // ---------- төлем жоқ белгісі ----------
    if (!st.paid) {
      const bh = 54;
      const by = MARGIN + 8;
      roundedRect(page, MARGIN, by + bh, innerW, bh, 12, { fill: RED });
      const text = "ТӨЛЕМ ЖОҚ / НЕ ОПЛАЧЕНО";
      const size = fitSize(bold, text, innerW - 30, 26, 12);
      centerText(page, bold, text, cx, by + bh / 2 - size * 0.36, size, WHITE);
    } else {
      centerText(page, regular, "zirotest.com", cx, MARGIN - 6, 10, GRAY);
    }

    onProgress?.(i + 1, students.length);
  }

  return out.save();
}

/**
 * БРАУЗЕР ҒАНА. Фото URL-ін байтқа айналдырады. JPEG/PNG болса — өз күйінде,
 * басқа форматты (webp, прозрачность) ақ фонға canvas арқылы JPEG-ке
 * түрлендіреді: фонсыз түрлендірсе, мөлдір аймақ қара болып шығады.
 * Алып болмаса — null (беттің өзі «Фото жоқ» салады).
 */
export async function loadPhotoForPdf(
  url: string | null | undefined
): Promise<{ bytes: Uint8Array; kind: "jpg" | "png" } | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    const isJpg = buf[0] === 0xff && buf[1] === 0xd8;
    if (isJpg) return { bytes: buf, kind: "jpg" };

    const blob = new Blob([buf], { type: res.headers.get("content-type") ?? "image/png" });
    const bmp = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0);
    const jpg: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.9));
    if (!jpg) return null;
    return { bytes: new Uint8Array(await jpg.arrayBuffer()), kind: "jpg" };
  } catch {
    return null;
  }
}
