import { Document, Packer, Paragraph, TextRun, ImageRun } from "docx";

export type BankChoice = { text: string; correct: boolean };
export type BankItem = {
  id: string;
  question_number: number;
  text_kk: string | null;
  text_ru: string | null;
  answer_format: string;
  choices: BankChoice[];
  image_svg: string | null;
};

export type VariantSlot = { question_number: number; choice_order: number[] };

const LETTERS = "ABCDEF";

/** Converts an inline SVG string to a PNG fallback (via canvas) — runs in
 * the browser only. Reads width/height from the SVG's own viewBox so the
 * image keeps its original proportions in the generated docx. The SVG
 * itself is embedded natively too, with the PNG as Word's required
 * fallback for viewers that don't support the SVG extension. */
async function svgToDocxImageData(
  svgText: string
): Promise<{ svgBytes: Uint8Array; pngBytes: Uint8Array; width: number; height: number }> {
  const viewBoxMatch = svgText.match(/viewBox="[\d.]+\s+[\d.]+\s+([\d.]+)\s+([\d.]+)"/);
  const width = viewBoxMatch ? Math.round(parseFloat(viewBoxMatch[1])) : 260;
  const height = viewBoxMatch ? Math.round(parseFloat(viewBoxMatch[2])) : 220;

  const svgBytes = new TextEncoder().encode(svgText);
  const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = url;
    });

    const scale = 2; // render the fallback at 2x for reasonable quality too
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const pngBlob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas.toBlob failed"))), "image/png");
    });
    const arrayBuffer = await pngBlob.arrayBuffer();
    return { svgBytes, pngBytes: new Uint8Array(arrayBuffer), width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function buildVariantDocxBlob(opts: {
  nameWord: string;
  variantNumber: number;
  lang: "kk" | "ru";
  slots: VariantSlot[];
  itemsByNumber: Map<number, BankItem>;
}): Promise<Blob> {
  const { nameWord, variantNumber, lang, slots, itemsByNumber } = opts;

  const variantWord = lang === "kk" ? "Нұсқа" : "Вариант";
  const digitLine = String(variantNumber).repeat(12);

  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: `${nameWord} — ${variantWord} ${variantNumber}    ${digitLine}`, bold: true }),
      ],
    })
  );
  children.push(new Paragraph({ text: "" }));

  const answerKey: string[] = [];

  for (let index = 0; index < slots.length; index++) {
    const slot = slots[index];
    const qNum = index + 1;
    const item = itemsByNumber.get(slot.question_number);
    if (!item) continue;

    const questionText = (lang === "kk" ? item.text_kk : item.text_ru) ?? "";
    children.push(
      new Paragraph({
        children: [new TextRun({ text: `${qNum}. `, bold: true }), new TextRun({ text: questionText })],
      })
    );

    if (item.image_svg) {
      try {
        const { svgBytes, pngBytes, width, height } = await svgToDocxImageData(item.image_svg);
        children.push(
          new Paragraph({
            children: [
              new ImageRun({
                type: "svg",
                data: svgBytes,
                transformation: { width, height },
                fallback: { type: "png", data: pngBytes },
              }),
            ],
          })
        );
      } catch {
        // If conversion fails for any reason, skip the image rather than
        // breaking the whole document — the question text still shows.
      }
    }

    if (item.answer_format === "numeric") {
      children.push(new Paragraph({ text: `${lang === "kk" ? "Жауабы" : "Ответ"}: _______________` }));
      const correctText = item.choices?.[0]?.text ?? "";
      answerKey.push(`${qNum}-${correctText}`);
    } else {
      slot.choice_order.forEach((origIdx, ci) => {
        const choice = item.choices[origIdx];
        const letter = LETTERS[ci] ?? "?";
        children.push(new Paragraph({ text: `${letter}) ${choice?.text ?? ""}` }));
        if (choice?.correct) answerKey.push(`${qNum}-${letter}`);
      });
    }

    children.push(new Paragraph({ text: "" }));
  }

  children.push(new Paragraph({ text: "" }));
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: lang === "kk" ? `Нұсқа ${variantNumber} — жауаптар кілті` : `Вариант ${variantNumber} — ключ ответов`,
          bold: true,
        }),
      ],
    })
  );
  children.push(new Paragraph({ text: answerKey.join(", ") }));

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBlob(doc);
}
