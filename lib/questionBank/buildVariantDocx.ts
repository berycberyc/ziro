import { Document, Packer, Paragraph, TextRun, ImageRun, type ParagraphChild } from "docx";
import katex from "katex";

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

const LETTERS = "ABCDEF";

/**
 * Renders a $...$ LaTeX formula to a small PNG image via KaTeX + html2canvas
 * — the same two libraries already proven to work reliably elsewhere in
 * this project (on-screen formula display and the pass PDF export). Native
 * Word equations (OMML) were tried first but couldn't be verified to
 * render reliably, so formulas are embedded as images instead — not
 * editable inside Word, but guaranteed to actually be visible.
 */
async function latexToInlinePng(latex: string): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-3000px";
  container.style.top = "0";
  container.style.background = "#ffffff";
  container.style.padding = "2px 4px";
  container.style.fontSize = "20px";
  container.innerHTML = katex.renderToString(latex, { throwOnError: false, displayMode: false });
  document.body.appendChild(container);

  try {
    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(container, { backgroundColor: "#ffffff", scale: 3 });
    const pngBlob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas.toBlob failed"))), "image/png");
    });
    const arrayBuffer = await pngBlob.arrayBuffer();
    // Scale back down to a reasonable on-page size (canvas is 3x for crispness).
    const width = Math.max(1, Math.round(canvas.width / 3));
    const height = Math.max(1, Math.round(canvas.height / 3));
    return { bytes: new Uint8Array(arrayBuffer), width, height };
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Splits text into plain TextRuns and inline formula images.
 *
 * Two delimiters come out of the Word import: `$…$` for a formula sitting
 * inside a sentence, and `$$…$$` for one the author put on a line of its
 * own. Only the single form used to be recognised here, so a `$$…$$` text
 * was split on its outermost dollars instead — leaving stray `$` fragments,
 * a formula that failed to render, and, worst of all, a question number
 * that never reached the page.
 *
 * That hit exactly the questions whose text is nothing but a formula
 * (`m/n = 3¾`, `15 < x < 39`), because those are the ones Word stores as a
 * standalone equation paragraph. Questions with words around the formula
 * were unaffected, which is why the loss looked random.
 *
 * Both forms are now rendered the same way: as an inline image, so the
 * number and the formula stay on one line. Text with no `$` at all still
 * comes back as a single unchanged TextRun.
 */
async function textToParagraphChildren(
  text: string,
  opts?: { prefix?: string; boldPrefix?: boolean }
): Promise<ParagraphChild[]> {
  const children: ParagraphChild[] = [];
  if (opts?.prefix) children.push(new TextRun({ text: opts.prefix, bold: opts.boldPrefix }));

  // $$…$$ is matched first; otherwise the $$ opener would be read as an
  // empty $…$ and the rest of the formula would leak out as plain text.
  const parts = text.split(/(\$\$[^$]+\$\$|\$[^$]+\$)/g);
  for (const part of parts) {
    const isBlock = part.startsWith("$$") && part.endsWith("$$") && part.length > 4;
    const isInline = !isBlock && part.startsWith("$") && part.endsWith("$") && part.length > 2;

    if (isBlock || isInline) {
      const latex = isBlock ? part.slice(2, -2) : part.slice(1, -1);
      try {
        const { bytes, width, height } = await latexToInlinePng(latex);
        children.push(new ImageRun({ type: "png", data: bytes, transformation: { width, height } }));
      } catch {
        children.push(new TextRun({ text: latex })); // fall back to the formula's own text
      }
    } else if (part.length > 0) {
      children.push(new TextRun({ text: part }));
    }
  }
  return children;
}

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

    const scale = 2;
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
  items: BankItem[];
}): Promise<Blob> {
  const { nameWord, variantNumber, lang, items } = opts;

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
  const sortedItems = [...items].sort((a, b) => a.question_number - b.question_number);

  for (let index = 0; index < sortedItems.length; index++) {
    const item = sortedItems[index];
    const qNum = index + 1;

    const questionText = (lang === "kk" ? item.text_kk : item.text_ru) ?? "";
    children.push(
      new Paragraph({
        children: await textToParagraphChildren(questionText, { prefix: `${qNum}. `, boldPrefix: true }),
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
      for (let ci = 0; ci < item.choices.length; ci++) {
        const choice = item.choices[ci];
        const letter = LETTERS[ci] ?? "?";
        children.push(
          new Paragraph({
            children: await textToParagraphChildren(choice?.text ?? "", { prefix: `${letter}) ` }),
          })
        );
        if (choice?.correct) answerKey.push(`${qNum}-${letter}`);
      }
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
