import { PDFDocument, rgb, type PDFFont, type PDFImage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { SUBJECT_LABELS, type SubjectKey } from "@/lib/questions/subjects";
import { FILL_RADIUS_K, LETTERS, type KeyTemplateIndex, type Letter } from "@/lib/print/answerSheetPack";

/**
 * Дұрыс жауаптары боялған парақ — ZipGrade-ке кілт беру үшін.
 *
 * Неге керек. Кілтті қолмен енгізу — бір пәнде 60 сұрақ, төрт нұсқа, бес
 * пән. Мыңнан аса түрту, оның ішінде бір қате жеткілікті: сол сұрақ
 * бойынша БҮКІЛ ағын қате тексеріледі, ал мұны нәтижелерден байқау мүмкін
 * емес. Жүйе жауаптарды базадан алады да, өзі бояп береді.
 *
 * Бір пәнге бір файл, ішінде әр нұсқаға бір бет. Әр бетте «Нұсқа»
 * шеңбері де боялған — ZipGrade кілттің қай нұсқаға тиесілі екенін
 * содан біледі.
 *
 * Бұл файл ОҚУШЫҒА берілмейді. Сондықтан беттің жоғарғы жағында ірі
 * ескерту тұрады: кездейсоқ таратып жіберу — байқаудың соңы.
 */

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 45;
const HEADER_BOTTOM = 150;
const LOGO_URL = "/logo-wide.png";

/** Бір нұсқаның жауаптары: сұрақтың нөмірі -> әріп. */
export type VariantAnswers = Map<number, Letter>;

export async function buildAnswerKeyPdf(opts: {
  sessionTitle: string;
  sessionDate: string;
  subject: SubjectKey;
  templateBytes: ArrayBuffer;
  index: KeyTemplateIndex;
  /** нұсқа -> жауаптар. Реті бойынша беттеледі. */
  answers: Map<number, VariantAnswers>;
}): Promise<Blob> {
  const { sessionTitle, sessionDate, subject, templateBytes, index, answers } = opts;

  const out = await PDFDocument.create();
  out.registerFontkit(fontkit);
  const fontBytes = await fetch("/fonts/print-sans.ttf").then((r) => r.arrayBuffer());
  const font = await out.embedFont(fontBytes, { subset: true });
  const logo = await out.embedPng(await fetch(LOGO_URL).then((r) => r.arrayBuffer()));

  const template = await PDFDocument.load(templateBytes);
  const rowByNumber = new Map(index.rows.map((r) => [r.n, r]));

  for (const variant of [...answers.keys()].sort((a, b) => a - b)) {
    const [embedded] = await out.embedPdf(template, [0]);
    const page = out.addPage([A4.width, A4.height]);

    // Оқушының парағымен бірдей орналастыру: бір коэффициент, төменгі
    // шетке тірелген. Сонда кілт пен парақ бір масштабта басылады.
    const scale = Math.min(A4.width / embedded.width, A4.height / embedded.height);
    const dx = (A4.width - embedded.width * scale) / 2;
    page.drawPage(embedded, { x: dx, y: 0, xScale: scale, yScale: scale });

    const dot = (xy: [number, number], r: number) =>
      page.drawCircle({
        x: xy[0] * scale + dx,
        y: xy[1] * scale,
        size: r * scale * FILL_RADIUS_K,
        color: rgb(0, 0, 0),
        borderWidth: 0,
      });

    const vb = index.variantBubbles[variant - 1];
    if (vb) dot(vb, index.variantR);

    const va = answers.get(variant)!;
    for (const [n, letter] of va) {
      const row = rowByNumber.get(n);
      if (!row) continue;
      const bubble = row.bubbles[LETTERS.indexOf(letter)];
      if (bubble) dot(bubble, index.r);
    }

    drawKeyHeader(page, font, logo, {
      sessionTitle,
      sessionDate,
      subject,
      variant,
      filled: va.size,
      total: index.questionCount,
    });
  }

  const bytes = await out.save();
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}

function drawKeyHeader(
  page: ReturnType<PDFDocument["addPage"]>,
  font: PDFFont,
  logo: PDFImage,
  data: {
    sessionTitle: string;
    sessionDate: string;
    subject: SubjectKey;
    variant: number;
    filled: number;
    total: number;
  }
) {
  const left = MARGIN;
  const right = A4.width - MARGIN;
  const ink = rgb(0.09, 0.14, 0.25);
  const grey = rgb(0.5, 0.5, 0.55);
  const alarm = rgb(0.72, 0.11, 0.11);

  const at = (fromTop: number) => A4.height - fromTop;
  const put = (text: string, x: number, fromTop: number, size: number, color = ink) =>
    page.drawText(text, { x, y: at(fromTop), size, font, color });
  const putRight = (text: string, fromTop: number, size: number, color = ink) =>
    put(text, right - font.widthOfTextAtSize(text, size), fromTop, size, color);

  const logoH = 24;
  page.drawImage(logo, {
    x: left,
    y: at(34 + logoH),
    width: (logoH * logo.width) / logo.height,
    height: logoH,
  });
  putRight(data.sessionDate, 52, 12, grey);

  put(data.sessionTitle, left, 78, 11, grey);
  put(`${SUBJECT_LABELS[data.subject]} · ${data.variant}-нұсқа`, left, 100, 16);
  put(`${data.filled} / ${data.total} сұрақ боялған`, left, 118, 10, grey);

  // Ескерту оң жақта, ірі әрі қызыл: бұл бетті оқушыға беруге болмайды.
  const warn = "ДҰРЫС ЖАУАПТАР";
  putRight(warn, 82, 15, alarm);
  putRight("Оқушыға берілмейді / Не выдавать ученику", 100, 9, alarm);

  page.drawLine({
    start: { x: left, y: at(HEADER_BOTTOM) },
    end: { x: right, y: at(HEADER_BOTTOM) },
    thickness: 0.8,
    color: rgb(0.78, 0.78, 0.82),
  });
}
