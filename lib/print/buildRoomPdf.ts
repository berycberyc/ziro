import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { SUBJECT_LABELS, type SubjectKey } from "@/lib/questions/subjects";

/**
 * Бір аудиторияға арналған басып шығару файлын құрастыру.
 *
 * Кіріс: оқушылар (орны бойынша реттелген) және нұсқа бойынша дайын PDF-тер.
 * Шығыс: бір PDF — әр оқушының әр пәні алдында титул беті, содан кейін сол
 * оқушының нұсқасының беттері.
 *
 * Титул беттерін жүйе өзі салады: онда түзететін ештеңе жоқ, ал деректер
 * базадан алынады. Сұрақ беттері пайдаланушының PDF-інен өзгеріссіз
 * көшіріледі — беттің қалай бөлінгені сол күйінде қалады.
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

const A4 = { width: 595.28, height: 841.89 };

export async function buildRoomPdf(opts: {
  sessionTitle: string;
  sessionDate: string;
  classroom: string;
  students: RoomStudent[];
  /** key -> сол нұсқаның PDF байттары */
  files: Map<PrintFileKey, ArrayBuffer>;
  /** Прогресс: қанша оқушы дайын болды */
  onProgress?: (done: number, total: number) => void;
}): Promise<Blob> {
  const { sessionTitle, sessionDate, classroom, students, files, onProgress } = opts;

  const out = await PDFDocument.create();
  out.registerFontkit(fontkit);

  const fontBytes = await fetch("/fonts/print-sans.ttf").then((r) => r.arrayBuffer());
  const font = await out.embedFont(fontBytes, { subset: true });

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

  for (let i = 0; i < students.length; i++) {
    const st = students[i];

    for (const subject of st.subjects) {
      // Тілдер бір тілде — файл әрқашан 'kk' болып сақталады.
      const key = printFileKey(subject, st.variant, st.lang);
      const doc = (await getDoc(key)) ?? (await getDoc(printFileKey(subject, st.variant, "kk")));
      if (!doc) continue; // тексеру бұған дейін өтеді, бұл сақтық шарасы

      drawCover(out, font, {
        sessionTitle,
        sessionDate,
        classroom,
        subject,
        student: st,
      });

      const pages = await out.copyPages(doc, doc.getPageIndices());
      pages.forEach((p) => out.addPage(p));
    }

    onProgress?.(i + 1, students.length);
  }

  const bytes = await out.save();
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}

function drawCover(
  doc: PDFDocument,
  font: PDFFont,
  data: {
    sessionTitle: string;
    sessionDate: string;
    classroom: string;
    subject: SubjectKey;
    student: RoomStudent;
  }
) {
  const page = doc.addPage([A4.width, A4.height]);
  const { student: st } = data;
  const left = 70;
  let y = A4.height - 120;

  const line = (text: string, size: number, gap: number, color = rgb(0.09, 0.14, 0.25)) => {
    page.drawText(text, { x: left, y, size, font, color });
    y -= gap;
  };

  line(data.sessionTitle, 13, 22, rgb(0.45, 0.45, 0.5));
  line(data.sessionDate, 11, 46, rgb(0.55, 0.55, 0.6));

  // Ең ірі — пән мен оқушының аты: таратушы алыстан көреді.
  line(SUBJECT_LABELS[data.subject], 26, 40);
  line(st.fullName, 20, 50);

  const rows: [string, string][] = [
    ["Тіл / Язык", st.lang === "kk" ? "Қазақша" : "Орысша"],
    ["Нұсқа / Вариант", String(st.variant)],
    ["Аудитория", st.classroom],
    ["Орын / Место", st.seat],
    ["ZipGrade ID", st.zipgradeId],
    ["Брондау / Бронь", st.shortCode],
  ];

  for (const [label, value] of rows) {
    page.drawText(label, { x: left, y, size: 11, font, color: rgb(0.5, 0.5, 0.55) });
    page.drawText(value, { x: left + 170, y, size: 13, font, color: rgb(0.09, 0.14, 0.25) });
    y -= 26;
  }

  page.drawLine({
    start: { x: left, y: y - 10 },
    end: { x: A4.width - left, y: y - 10 },
    thickness: 0.7,
    color: rgb(0.85, 0.85, 0.88),
  });
}
