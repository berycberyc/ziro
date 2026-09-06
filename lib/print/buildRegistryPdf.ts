import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { SUBJECT_LABELS, type SubjectKey } from "@/lib/questions/subjects";
import type { RegistryRow } from "@/lib/print/buildRoomPdf";

/**
 * Реестр раздачи — PDF с таблицей страниц по каждому ученику.
 *
 * Зачем. Основной PDF большой. Если нужно распечатать только одного
 * ученика или один предмет, открывать весь файл и считать страницы
 * вручную неудобно. Реестр даёт сразу: орын 1 — математика стр. 3–6,
 * сандық стр. 7–8, и т.д.
 *
 * Печатается отдельно и кладётся рядом с пачкой листов.
 */

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 40;
const ROW_H = 20;
const HEAD_H = 26;
const LOGO_URL = "/logo-wide.png";

export async function buildRegistryPdf(opts: {
  sessionTitle: string;
  sessionDate: string;
  classroom: string;
  rows: RegistryRow[];
  subjects: SubjectKey[];
}): Promise<Blob> {
  const { sessionTitle, sessionDate, classroom, rows, subjects } = opts;

  const out = await PDFDocument.create();
  out.registerFontkit(fontkit);
  const fontBytes = await fetch("/fonts/print-sans.ttf").then((r) => r.arrayBuffer());
  const font = await out.embedFont(fontBytes, { subset: true });
  const logo = await out.embedPng(await fetch(LOGO_URL).then((r) => r.arrayBuffer()));

  const usableW = A4.width - MARGIN * 2;
  const seatW = 38;
  const nameW = 140;
  const subjectW = Math.floor((usableW - seatW - nameW) / subjects.length);

  const rowsPerPage = Math.floor((A4.height - 120 - HEAD_H) / ROW_H);

  const chunks: RegistryRow[][] = [];
  for (let i = 0; i < rows.length; i += rowsPerPage) {
    chunks.push(rows.slice(i, i + rowsPerPage));
  }
  if (chunks.length === 0) chunks.push([]);

  for (let ci = 0; ci < chunks.length; ci++) {
    const page = out.addPage([A4.width, A4.height]);
    const chunk = chunks[ci];

    // шапка
    const logoH = 20;
    page.drawImage(logo, {
      x: MARGIN,
      y: A4.height - 36,
      width: (logoH * logo.width) / logo.height,
      height: logoH,
    });

    const put = (text: string, x: number, y: number, size = 9, bold = false, color = rgb(0.09, 0.14, 0.25)) =>
      page.drawText(text, { x, y, size, font, color });

    put(`${sessionTitle} · ${sessionDate}`, MARGIN, A4.height - 50, 9, false, rgb(0.5, 0.5, 0.55));
    put(`Аудитория ${classroom} — раздаточный реестр`, MARGIN, A4.height - 64, 11, true);
    if (chunks.length > 1) {
      put(`${ci + 1} / ${chunks.length}`, A4.width - MARGIN - 30, A4.height - 64, 9, false, rgb(0.5, 0.5, 0.55));
    }

    // заголовок таблицы
    let tableTop = A4.height - 88;
    const fillRect = (x: number, y: number, w: number, h: number, fillColor = rgb(0.94, 0.94, 0.96)) =>
      page.drawRectangle({ x, y, width: w, height: h, color: fillColor });

    fillRect(MARGIN, tableTop - HEAD_H, usableW, HEAD_H);

    // рамка заголовка
    page.drawRectangle({ x: MARGIN, y: tableTop - HEAD_H, width: usableW, height: HEAD_H, borderColor: rgb(0.75, 0.75, 0.78), borderWidth: 0.5 });

    const headY = tableTop - HEAD_H + 7;
    put("Орын", MARGIN + 4, headY, 8, true);
    put("Аты-жөні", MARGIN + seatW + 4, headY, 8, true);
    subjects.forEach((subj, si) => {
      const label = SUBJECT_LABELS[subj] ?? subj;
      const short = label.length > 10 ? label.slice(0, 10) + "…" : label;
      put(short, MARGIN + seatW + nameW + si * subjectW + 4, headY, 7, true);
    });

    // строки
    chunk.forEach((row, ri) => {
      const rowY = tableTop - HEAD_H - (ri + 1) * ROW_H;
      if (ri % 2 === 0) fillRect(MARGIN, rowY, usableW, ROW_H, rgb(0.98, 0.98, 0.99));
      page.drawRectangle({ x: MARGIN, y: rowY, width: usableW, height: ROW_H, borderColor: rgb(0.82, 0.82, 0.85), borderWidth: 0.3 });

      const textY = rowY + 5;
      put(row.seat, MARGIN + 4, textY, 8);
      const name = row.fullName.length > 22 ? row.fullName.slice(0, 22) + "…" : row.fullName;
      put(name, MARGIN + seatW + 4, textY, 8);

      subjects.forEach((subj, si) => {
        const entry = row.subjects.find((s) => s.subject === subj);
        const cell = entry ? `${entry.from}–${entry.to}` : "—";
        put(cell, MARGIN + seatW + nameW + si * subjectW + 4, textY, 8);
      });
    });

    // вертикальные разделители
    const tableBottom = tableTop - HEAD_H - chunk.length * ROW_H;
    const tableH = tableTop - tableBottom;
    [seatW, seatW + nameW, ...subjects.map((_, i) => seatW + nameW + (i + 1) * subjectW)].forEach((xOff) => {
      if (xOff >= usableW) return;
      page.drawLine({
        start: { x: MARGIN + xOff, y: tableTop },
        end: { x: MARGIN + xOff, y: tableBottom },
        thickness: 0.3,
        color: rgb(0.82, 0.82, 0.85),
      });
    });

    put(`Жалпы: ${rows.length} оқушы`, MARGIN, tableBottom - 14, 8, false, rgb(0.5, 0.5, 0.55));
  }

  const bytes = await out.save();
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}
