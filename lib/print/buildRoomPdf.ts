import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { SUBJECT_LABELS, MONOLINGUAL_SUBJECTS, type SubjectKey } from "@/lib/questions/subjects";
import { FILL_RADIUS_K, type SheetPageIndex } from "@/lib/print/answerSheetPack";

/**
 * Бір аудиторияға арналған басып шығару файлын құрастыру.
 *
 * Кіріс: оқушылар (орны бойынша реттелген), нұсқа бойынша дайын PDF-тер
 * және ZipGrade пачкалары.
 * Шығыс: бір PDF — әр оқушының әр пәні алдында сол оқушының жауап парағы,
 * содан кейін сол оқушының нұсқасының беттері.
 *
 * НЕГЕ ТИТУЛ БЕТІ ЖОҚ. Бұрын әр пәннің алдында жүйе салған титул тұратын,
 * ал жауап парағын бөлек таратуға тура келетін. Енді титулдағы бәрі жауап
 * парағының өз бос алаңына басылады: бір парақ азаяды, әрі парақ иесіз
 * қалмайды. «Нұсқа» шеңбері де алдын ала боялады — бала қате шеңберді
 * бояса, жұмыс басқа кілтпен тексерілер еді, ал мұны ешкім байқамайды.
 *
 * НЕГЕ БОС БЕТ ҚОСЫЛАДЫ. Тест екі жақты басылады. Егер жауап парағының
 * артына сұрақ түссе, қағаз ішінен көрініп, телефон парақты нашар оқиды.
 * Сондықтан парақтан кейін бос бет қойылады — сол парақ жеке қағазда
 * қалады. Сұрақ беттерінің саны да жұпқа толтырылады, әйтпесе келесі
 * пәннің парағы соңғы сұрақтың артына түседі. Қағаз артық кетпейді:
 * екі жақты басқанда бос бет — сол қағаздың таза сырты.
 *
 * ЛЕТТЕР ЖӘНЕ A4. ZipGrade парағы — Letter (612×792), ал біздің файл A4.
 * Аралас өлшемді PDF-ті принтер өзінше жимақтайды, сонда пропорция бұзылады
 * да, ZipGrade парақты оқи алмай қалады. Сондықтан парақ кодта бір рет,
 * екі өсі бойынша БІРДЕЙ коэффициентпен кішірейтіледі: пропорция сақталады,
 * ал принтерде «100%» қойылады.
 *
 * Қаріп туралы: pdf-lib-тің стандартты қаріптері кирилл әрпін білмейді,
 * сондықтан қазақша мәтін үшін бөлек қаріп қосылады (public/fonts).
 */

export type RoomStudent = {
  fullName: string;
  zipgradeId: string;
  shortCode: string;
  classroom: string;
  seat: string;
  variant: number;
  lang: "kk" | "ru";
  testTypeCode: string;
  subjects: SubjectKey[];
};

export type PrintFileKey = string; // `${subject}|${variant}|${lang}`

export function printFileKey(subject: string, variant: number, lang: string): PrintFileKey {
  return `${subject}|${variant}|${lang}`;
}

/** Бір пәннің пачкасы: файлдың өзі және жүктеу кезінде жасалған көрсеткіш. */
export type SheetPack = { bytes: ArrayBuffer; pages: SheetPageIndex[] };

const A4 = { width: 595.28, height: 841.89 };

/** Шеттен қалдырылатын алаң. */
const MARGIN = 45;
/** Шапканың астындағы сызық — беттің жоғарғы шетінен. */
const HEADER_BOTTOM = 150;

/** РФМШ парағының суреті. ZipGrade оны оқи алмайды, қолмен тексеріледі. */
const RFMSH_SHEET_URL = "/rfmsh-sheet.png";
const LOGO_URL = "/logo-wide.png";

export async function buildRoomPdf(opts: {
  sessionTitle: string;
  sessionDate: string;
  classroom: string;
  students: RoomStudent[];
  /** key -> сол нұсқаның PDF байттары */
  files: Map<PrintFileKey, ArrayBuffer>;
  /** пән -> ZipGrade пачкасы. РФМШ бұған кірмейді. */
  sheets: Map<SubjectKey, SheetPack>;
  /** Прогресс: қанша оқушы дайын болды */
  onProgress?: (done: number, total: number) => void;
}): Promise<Blob> {
  const { sessionTitle, sessionDate, students, files, sheets, onProgress } = opts;

  const out = await PDFDocument.create();
  out.registerFontkit(fontkit);

  const fontBytes = await fetch("/fonts/print-sans.ttf").then((r) => r.arrayBuffer());
  const font = await out.embedFont(fontBytes, { subset: true });
  const logo = await out.embedPng(await fetch(LOGO_URL).then((r) => r.arrayBuffer()));

  // РФМШ парағы тек керек болса ғана жүктеледі.
  let rfmshSheet: PDFImage | null = null;
  const getRfmshSheet = async () => {
    if (!rfmshSheet) {
      rfmshSheet = await out.embedPng(await fetch(RFMSH_SHEET_URL).then((r) => r.arrayBuffer()));
    }
    return rfmshSheet;
  };

  // Бір PDF-ті бірнеше оқушы қолданады — қайта-қайта оқымау үшін кэш.
  const loaded = new Map<PrintFileKey, PDFDocument>();
  const getDoc = async (key: PrintFileKey) => {
    const cached = loaded.get(key);
    if (cached) return cached;
    const bytes = files.get(key);
    if (!bytes) return null;
    const doc = await PDFDocument.load(bytes);
    loaded.set(key, doc);
    return doc;
  };

  const packDocs = new Map<SubjectKey, PDFDocument>();
  const getPackDoc = async (subject: SubjectKey) => {
    const cached = packDocs.get(subject);
    if (cached) return cached;
    const pack = sheets.get(subject);
    if (!pack) return null;
    const doc = await PDFDocument.load(pack.bytes);
    packDocs.set(subject, doc);
    return doc;
  };

  for (let i = 0; i < students.length; i++) {
    const st = students[i];

    for (const subject of st.subjects) {
      // ---- 1. жауап парағы ----
      if (subject === "rfmsh") {
        const page = out.addPage([A4.width, A4.height]);
        drawHeader(page, font, logo, { sessionTitle, sessionDate, subject, student: st });
        drawRfmshSheet(page, await getRfmshSheet());
      } else {
        const pack = sheets.get(subject);
        const packDoc = await getPackDoc(subject);
        const entry = pack?.pages.find((p) => p.id === st.zipgradeId);
        if (!pack || !packDoc || !entry) {
          throw new Error(
            `${SUBJECT_LABELS[subject]}: ${st.fullName} (ID ${st.zipgradeId}) үшін жауап парағы жоқ.`
          );
        }
        const [embedded] = await out.embedPdf(packDoc, [entry.page]);
        const page = out.addPage([A4.width, A4.height]);

        // Парақ бір коэффициентпен кішірейеді де, беттің ТӨМЕНГІ шетіне
        // тіреледі: бос орынның бәрі жоғарыда жиналады, шапка сонда
        // сыяды. Парақтың өз белгілері шеттен 5 см-ден жақын келмейді.
        const scale = Math.min(A4.width / embedded.width, A4.height / embedded.height);
        const dx = (A4.width - embedded.width * scale) / 2;
        page.drawPage(embedded, { x: dx, y: 0, xScale: scale, yScale: scale });

        // Керек шеңберді бояу. Координаталар парақтың өз кеңістігінде
        // сақталған, сондықтан сол өзгеріспен аударылады.
        const bubble = entry.bubbles[st.variant - 1];
        if (bubble) {
          page.drawCircle({
            x: bubble[0] * scale + dx,
            y: bubble[1] * scale,
            size: entry.r * scale * FILL_RADIUS_K,
            color: rgb(0, 0, 0),
            borderWidth: 0,
          });
        }

        drawHeader(page, font, logo, { sessionTitle, sessionDate, subject, student: st });
      }

      // ---- 2. парақтың сырты таза қалсын ----
      out.addPage([A4.width, A4.height]);

      // ---- 3. сұрақ беттері ----
      // Тілдер бір тілде — файл әрқашан 'kk' болып сақталады.
      const key = printFileKey(subject, st.variant, st.lang);
      const doc = (await getDoc(key)) ?? (await getDoc(printFileKey(subject, st.variant, "kk")));
      if (!doc) continue; // тексеру бұған дейін өтеді, бұл сақтық шарасы

      const pages = await out.copyPages(doc, doc.getPageIndices());
      pages.forEach((p) => out.addPage(p));

      // ---- 4. келесі пән жаңа қағаздан басталсын ----
      if (pages.length % 2 === 1) out.addPage([A4.width, A4.height]);
    }

    onProgress?.(i + 1, students.length);
  }

  const bytes = await out.save();
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}

/**
 * Шапка — парақтың бос маңдайшасында. Ол жерде ZipGrade ештеңе салмайды
 * (ең тығыз макетте де контент беттің жоғарғы шетінен 20 см-ге дейін
 * жақындамайды), сондықтан белгілерге тиіспейміз.
 */
function drawHeader(
  page: PDFPage,
  font: PDFFont,
  logo: PDFImage,
  data: {
    sessionTitle: string;
    sessionDate: string;
    subject: SubjectKey;
    student: RoomStudent;
  }
) {
  const st = data.student;
  const left = MARGIN;
  const right = A4.width - MARGIN;
  const ink = rgb(0.09, 0.14, 0.25);
  const grey = rgb(0.5, 0.5, 0.55);

  /** Беттің ЖОҒАРҒЫ шетінен санау — көзбен өлшеу оңай болсын деп. */
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
  put(st.fullName, left, 100, 16);
  put(
    `${SUBJECT_LABELS[data.subject]} · ${
      MONOLINGUAL_SUBJECTS.includes(data.subject)
        ? "—"
        : st.lang === "kk"
        ? "Қазақша"
        : "Орысша"
    }`,
    left,
    118,
    10,
    grey
  );

  const rows: [string, string][] = [
    ["Нұсқа / Вариант", String(st.variant)],
    ["Аудитория", st.classroom],
    ["Орын / Место", st.seat],
    ["ZipGrade ID", st.zipgradeId],
    ["Брондау / Бронь", st.shortCode],
  ];
  rows.forEach(([label, value], i) => {
    const y = 72 + i * 15;
    put(label, right - 190, y, 8.5, grey);
    putRight(value, y, 10);
  });

  page.drawLine({
    start: { x: left, y: at(HEADER_BOTTOM) },
    end: { x: right, y: at(HEADER_BOTTOM) },
    thickness: 0.8,
    color: rgb(0.78, 0.78, 0.82),
  });
}

/** РФМШ парағы — сурет, шапканың астына, енімен сыятындай. */
function drawRfmshSheet(page: PDFPage, sheet: PDFImage) {
  const top = HEADER_BOTTOM + 20;
  const maxW = A4.width - MARGIN * 2;
  const maxH = A4.height - top - 60;
  const scale = Math.min(maxW / sheet.width, maxH / sheet.height);
  const w = sheet.width * scale;
  const h = sheet.height * scale;
  page.drawImage(sheet, {
    x: (A4.width - w) / 2,
    y: A4.height - top - h,
    width: w,
    height: h,
  });
}
