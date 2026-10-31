import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { encodeSheetCode } from "./code";
import { STRIP, type SheetKind } from "./layout";

/**
 * Әр оқушыға жеке жауап парағын басу.
 *
 * Бос парақтар public/sheets ішінде жатыр (түпнұсқадан тазартылған НИШ пен
 * Тілдер, біз салған БИЛ мен РФМШ). Үстіне тек оқушыға қатысты нәрсе басылады:
 * аты, сессия, аудитория мен орын, тіл, нұсқа, күні және жоғарғы жолақтағы
 * код. Парақтың өз сызықтарына қол тигізілмейді.
 *
 * Барлық орындар — миллиметрмен, парақтың сол жақ жоғарғы бұрышынан;
 * мәтіннің «y»-і — жолдың табаны.
 */

export interface SheetStudent {
  fullName: string;
  zipgradeId: string;
  variant: number;
  lang: "kk" | "ru";
  classroom: string;
  seat: string;
  sessionTitle: string;
  /** «15.11.2026» */
  sessionDate: string;
}

const PT = 72 / 25.4;
const BLANK_URL: Record<SheetKind, string> = {
  nis: "/sheets/nis.pdf",
  tilder: "/sheets/tilder.pdf",
  bil: "/sheets/bil.pdf",
  rfmsh: "/sheets/rfmsh.pdf",
};

type Fonts = { regular: PDFFont; bold: PDFFont };

class Painter {
  constructor(private page: PDFPage, private fonts: Fonts) {}
  private get h() { return this.page.getHeight(); }

  /** Мәтін: x, y — мм; align — сол, орта, оң. Сыймаса — әріп кішірейеді. */
  text(x: number, y: number, s: string, size: number,
       opt: { bold?: boolean; align?: "l" | "c" | "r"; maxMm?: number; grey?: boolean } = {}) {
    const font = opt.bold ? this.fonts.bold : this.fonts.regular;
    let sz = size;
    if (opt.maxMm) {
      while (sz > 5 && font.widthOfTextAtSize(s, sz) > opt.maxMm * PT) sz -= 0.5;
    }
    const w = font.widthOfTextAtSize(s, sz);
    const left = opt.align === "c" ? x * PT - w / 2 : opt.align === "r" ? x * PT - w : x * PT;
    this.page.drawText(s, {
      x: left, y: this.h - y * PT, size: sz, font,
      color: opt.grey ? rgb(0.4, 0.4, 0.4) : rgb(0, 0, 0),
    });
  }

  strip(bits: boolean[]) {
    bits.forEach((on, i) => {
      if (!on) return;
      this.page.drawRectangle({
        x: (STRIP.left + i * STRIP.step) * PT,
        y: this.h - (STRIP.top + STRIP.h) * PT,
        width: STRIP.w * PT, height: STRIP.h * PT,
        color: rgb(0, 0, 0),
      });
    });
  }
}

const langLabel = (lang: "kk" | "ru") => (lang === "ru" ? "Русский язык" : "Қазақ тілі");

/** Бір оқушының бір парағына оның деректерін басу. */
function stampOne(p: Painter, kind: SheetKind, st: SheetStudent) {
  const variant = String(st.variant);
  const session = `${st.sessionTitle} · ${st.sessionDate}`;
  const room = `Аудитория ${st.classroom || "—"} · Орын ${st.seat || "—"}`;
  p.strip(encodeSheetCode({ kind, variant: st.variant, zipgradeId: st.zipgradeId }));

  if (kind === "nis" || kind === "tilder") {
    const big = kind === "nis" ? { x0: 55.95, y0: 30.0, x1: 196.0 } : { x0: 55.6, y0: 27.35, x1: 196.9 };
    p.text(big.x0 + 4, big.y0 + 9.5, st.fullName, 15, { bold: true, maxMm: big.x1 - big.x0 - 38 });
    p.text(big.x0 + 4, big.y0 + 16, session, 9, { maxMm: big.x1 - big.x0 - 8 });
    p.text(big.x0 + 4, big.y0 + 21, room, 9);
    p.text(big.x1 - 4, big.y0 + 8.5, st.zipgradeId, 11, { bold: true, align: "r" });
    p.text(big.x1 - 4, big.y0 + 13, "Код", 7, { align: "r", grey: true });
    p.text(17, 80.5, langLabel(st.lang), 12, { bold: true });
    p.text(34, kind === "nis" ? 113 : 113.5, variant, 28, { bold: true, align: "c" });
    const top = kind === "nis" ? { x: 181.4, y: 17.23 } : { x: 184.2, y: 16.39 };
    p.text(top.x, top.y, variant, 14, { bold: true });
    p.text(kind === "nis" ? 57 : 56.5, 126.6, st.sessionDate, 11, { bold: true });
    return;
  }

  if (kind === "rfmsh") {
    p.text(60, 40.5, st.fullName, 15, { bold: true, maxMm: 100 });
    p.text(60, 47, session, 9, { maxMm: 128 });
    p.text(60, 52, room, 9);
    p.text(192, 39.5, st.zipgradeId, 11, { bold: true, align: "r" });
    p.text(192, 44, "Код", 7, { align: "r", grey: true });
    p.text(16.5, 75.5, langLabel(st.lang), 11, { bold: true });
    p.text(76, 77, variant, 20, { bold: true, align: "c" });
    p.text(100, 75.5, st.sessionDate, 11, { bold: true });
    p.text(178, 17.23, variant, 14, { bold: true });
    return;
  }

  // БИЛ: тегі мен аты төменгі өрістерге, ID — кірпіштерге, нұсқа — нұсқа
  // шеңберлерінің астына жазылады. Кружоктарды бала өзі бояйды (жаттығу).
  const space = st.fullName.trim().indexOf(" ");
  const surname = space > 0 ? st.fullName.trim().slice(0, space) : st.fullName.trim();
  const first = space > 0 ? st.fullName.trim().slice(space + 1) : "";
  p.text(52.6, 232.12, surname, 9, { bold: true, maxMm: 68 });
  p.text(52.6, 242.94, first, 9, { bold: true, maxMm: 68 });
  const id = st.zipgradeId.padStart(8, "0");
  for (let k = 0; k < 8; k++) p.text(13.4 + k * 4.4, 222.5, id[k], 8, { bold: true, align: "c" });
  p.text(181.725, 101, `Нұсқа / Вариант: ${variant}`, 6, { bold: true, align: "c" });
  p.text(90.6, 216.9, session, 6.5, { maxMm: 32 });
  p.text(90.6, 221.1, room, 6.5, { maxMm: 32 });
}

/**
 * Бірнеше оқушының парақтары бір PDF-ке. Тәртібі — берілген тәртіп.
 * Қате деректе (ZipGrade ID жоқ, нұсқа жоқ) қате лақтырады — ондай парақ
 * басылмауы керек, әйтпесе оны ешкім оқи алмайды.
 */
export async function buildSheetsPdf(items: { kind: SheetKind; student: SheetStudent }[]): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  out.registerFontkit(fontkit);
  const [regularBytes, boldBytes] = await Promise.all([
    fetch("/fonts/print-sans.ttf").then((r) => r.arrayBuffer()),
    fetch("/fonts/print-sans-bold.ttf").then((r) => r.arrayBuffer()),
  ]);
  const fonts: Fonts = {
    regular: await out.embedFont(regularBytes, { subset: true }),
    bold: await out.embedFont(boldBytes, { subset: true }),
  };

  const blanks = new Map<SheetKind, PDFDocument>();
  for (const { kind, student } of items) {
    let blank = blanks.get(kind);
    if (!blank) {
      blank = await PDFDocument.load(await fetch(BLANK_URL[kind]).then((r) => r.arrayBuffer()));
      blanks.set(kind, blank);
    }
    const [page] = await out.copyPages(blank, [0]);
    out.addPage(page);
    stampOne(new Painter(page, fonts), kind, student);
  }
  return out.save();
}
