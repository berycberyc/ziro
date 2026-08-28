import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
} from "docx";
import {
  SUBJECT_LABELS,
  SUBJECT_MINUTES,
  QUANTITY_SUBJECTS,
  NUMERIC_SUBJECTS,
  MONOLINGUAL_SUBJECTS,
  type SubjectKey,
} from "@/lib/questions/subjects";
import { textToParagraphChildren, imageUrlToPng } from "@/lib/print/docxHelpers";

/**
 * Басып шығаруға арналған Word файлы — бір пән, бір нұсқа, бір тіл.
 *
 * Неге нұсқа бойынша, оқушы бойынша емес: бір аудиторияда бір нұсқа
 * оннан аса рет қайталанады, ал беттің қалай бөлінгенін пайдаланушы
 * қолмен түзетеді. Нұсқа бойынша бөлсек — бір рет түзетеді, оқушы
 * бойынша бөлсек — ондаған рет.
 *
 * Дұрыс жауаптар БАСЫЛМАЙДЫ: бұл оқушының қолына тиетін файл.
 */

export type PrintQuestion = {
  question_number: number;
  text_kk: string | null;
  text_ru: string | null;
  image_url: string | null;
  answer_format: "abcd" | "numeric" | "quantity";
  choices: { text_kk: string; text_ru: string }[] | null;
  column_a_kk: string | null;
  column_a_ru: string | null;
  column_b_kk: string | null;
  column_b_ru: string | null;
  passage_id: string | null;
};

export type PrintPassage = { id: string; text_kk: string; text_ru: string; order_number: number };

const LETTERS = ["A", "B", "C", "D"] as const;

export async function buildPrintDocx(opts: {
  sessionTitle: string;
  subject: SubjectKey;
  variant: number;
  lang: "kk" | "ru";
  questions: PrintQuestion[];
  passages: PrintPassage[];
}): Promise<Blob> {
  const { sessionTitle, subject, variant, lang, questions, passages } = opts;
  const mono = MONOLINGUAL_SUBJECTS.includes(subject);
  const pick = (kk: string | null, ru: string | null) =>
    (mono ? kk || ru : lang === "kk" ? kk : ru) ?? "";

  const children: (Paragraph | Table)[] = [];

  // ---- шапка ----
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [
        new TextRun({
          text: `${SUBJECT_LABELS[subject]} — ${lang === "kk" ? "Нұсқа" : "Вариант"} ${variant}`,
          bold: true,
        }),
      ],
    })
  );
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `${sessionTitle} · ${SUBJECT_MINUTES[subject]} ${lang === "kk" ? "минут" : "минут"} · ${questions.length} ${lang === "kk" ? "сұрақ" : "вопросов"}`,
          size: 20,
        }),
      ],
    })
  );
  children.push(new Paragraph({ text: "" }));

  const sorted = [...questions].sort((a, b) => a.question_number - b.question_number);
  const passageById = new Map(passages.map((p) => [p.id, p]));

  // ---- Сандық: үш бағанды кесте ----
  if (QUANTITY_SUBJECTS.includes(subject)) {
    const rows: TableRow[] = [
      new TableRow({
        tableHeader: true,
        children: [
          headerCell(lang === "kk" ? "№" : "№", 8),
          headerCell(lang === "kk" ? "А бағаны" : "Колонка А", 46),
          headerCell(lang === "kk" ? "В бағаны" : "Колонка В", 46),
        ],
      }),
    ];

    for (const q of sorted) {
      const condition = pick(q.text_kk, q.text_ru).trim();

      // Жалпы шарт болса — нөмірден кейін бүкіл ені бойынша бөлек жол.
      if (condition) {
        rows.push(
          new TableRow({
            children: [
              new TableCell({
                width: { size: 8, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: String(q.question_number), bold: true })],
                  }),
                ],
              }),
              new TableCell({
                columnSpan: 2,
                width: { size: 92, type: WidthType.PERCENTAGE },
                children: [new Paragraph({ children: await textToParagraphChildren(condition) })],
              }),
            ],
          })
        );
      }

      rows.push(
        new TableRow({
          children: [
            new TableCell({
              width: { size: 8, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({ text: condition ? "" : String(q.question_number), bold: true }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 46, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: await textToParagraphChildren(pick(q.column_a_kk, q.column_a_ru)),
                }),
              ],
            }),
            new TableCell({
              width: { size: 46, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: await textToParagraphChildren(pick(q.column_b_kk, q.column_b_ru)),
                }),
              ],
            }),
          ],
        })
      );
    }

    children.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
    return Packer.toBlob(new Document({ sections: [{ children }] }));
  }

  // ---- Қалған пәндер ----
  let lastPassageId: string | null = null;

  for (const q of sorted) {
    // Оқылым мәтіні — тобының алдында бір рет.
    if (q.passage_id && q.passage_id !== lastPassageId) {
      const p = passageById.get(q.passage_id);
      if (p) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: lang === "kk" ? "Мәтінді оқыңыз:" : "Прочитайте текст:",
                bold: true,
                italics: true,
              }),
            ],
          })
        );
        for (const line of pick(p.text_kk, p.text_ru).split("\n")) {
          children.push(new Paragraph({ children: await textToParagraphChildren(line) }));
        }
        children.push(new Paragraph({ text: "" }));
      }
      lastPassageId = q.passage_id;
    }
    if (!q.passage_id) lastPassageId = null;

    children.push(
      new Paragraph({
        children: await textToParagraphChildren(pick(q.text_kk, q.text_ru), {
          prefix: `${q.question_number}. `,
          boldPrefix: true,
        }),
      })
    );

    if (q.image_url) {
      try {
        const { bytes, width, height } = await imageUrlToPng(q.image_url);
        children.push(
          new Paragraph({
            children: [new ImageRun({ type: "png", data: bytes, transformation: { width, height } })],
          })
        );
      } catch {
        // Сурет жүктелмесе — сұрақтың мәтіні бәрібір қалады.
      }
    }

    if (NUMERIC_SUBJECTS.includes(subject)) {
      // Есептеу үшін орын. Қажет болса пайдаланушы өзі кеңейтеді.
      children.push(new Paragraph({ text: "" }));
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: lang === "kk" ? "Жауабы: ____________" : "Ответ: ____________" }),
          ],
        })
      );
    } else {
      const choices = q.choices ?? [];
      for (let i = 0; i < choices.length; i++) {
        children.push(
          new Paragraph({
            children: await textToParagraphChildren(
              pick(choices[i]?.text_kk ?? "", choices[i]?.text_ru ?? ""),
              { prefix: `${LETTERS[i]}) ` }
            ),
          })
        );
      }
    }

    children.push(new Paragraph({ text: "" }));
  }

  return Packer.toBlob(new Document({ sections: [{ children }] }));
}

function headerCell(text: string, widthPercent: number) {
  return new TableCell({
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text, bold: true })],
      }),
    ],
  });
}
