import { ImageRun, TextRun, type ParagraphChild } from "docx";
import katex from "katex";

/**
 * Word құжатын құрудағы ортақ көмекшілер.
 *
 * Формулалар суретке айналдырылады: Word-тың өз теңдеу форматына (OMML)
 * сенімді түрде айналдыру тексерілмеген, ал KaTeX + html2canvas жұп бұл
 * жобада бұрыннан сынақтан өткен. Word ішінде формуланы түзету мүмкін
 * болмайды, бірақ ол көрінетініне кепілдік бар.
 *
 * Бұл код lib/questionBank/buildVariantDocx.ts ішінен бөлініп алынды —
 * енді басып шығару модулі де осыны қолданады.
 */

export async function latexToInlinePng(
  latex: string,
  fontSizePx = 20
): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-3000px";
  container.style.top = "0";
  container.style.background = "#ffffff";
  container.style.padding = "2px 4px";
  container.style.fontSize = `${fontSizePx}px`;
  container.innerHTML = katex.renderToString(latex, { throwOnError: false, displayMode: false });
  document.body.appendChild(container);

  try {
    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(container, { backgroundColor: "#ffffff", scale: 3 });
    const pngBlob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b: Blob | null) => (b ? resolve(b) : reject(new Error("canvas.toBlob failed"))),
        "image/png"
      );
    });
    const arrayBuffer = await pngBlob.arrayBuffer();
    return {
      bytes: new Uint8Array(arrayBuffer),
      width: Math.max(1, Math.round(canvas.width / 3)),
      height: Math.max(1, Math.round(canvas.height / 3)),
    };
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Мәтінді $...$ және $$...$$ бөліктеріне бөліп, формулаларды суретке
 * айналдырады. Формуласыз мәтін өзгеріссіз қалады.
 */
export async function textToParagraphChildren(
  text: string,
  opts?: { prefix?: string; boldPrefix?: boolean; bold?: boolean }
): Promise<ParagraphChild[]> {
  const children: ParagraphChild[] = [];
  if (opts?.prefix) children.push(new TextRun({ text: opts.prefix, bold: opts.boldPrefix }));

  // $$...$$ те, $...$ те бір ережемен өңделеді.
  const parts = (text ?? "").split(/(\$\$[^$]+\$\$|\$[^$]+\$)/g);
  for (const part of parts) {
    if (!part) continue;
    const isDisplay = part.startsWith("$$") && part.endsWith("$$") && part.length > 4;
    const isInline = !isDisplay && part.startsWith("$") && part.endsWith("$") && part.length > 2;

    if (isDisplay || isInline) {
      const latex = isDisplay ? part.slice(2, -2) : part.slice(1, -1);
      try {
        const { bytes, width, height } = await latexToInlinePng(latex, isDisplay ? 24 : 20);
        children.push(new ImageRun({ type: "png", data: bytes, transformation: { width, height } }));
      } catch {
        children.push(new TextRun({ text: part, bold: opts?.bold }));
      }
    } else {
      children.push(new TextRun({ text: part, bold: opts?.bold }));
    }
  }
  return children;
}

/** Суреттің URL-ін docx-ке жарайтын PNG-ге айналдырады. */
export async function imageUrlToPng(
  url: string
): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  const res = await fetch(url);
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);

  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas is not available");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0);

  const pngBlob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b: Blob | null) => (b ? resolve(b) : reject(new Error("canvas.toBlob failed"))),
      "image/png"
    );
  });

  // Суреттер базадағы қалпында қойылады — өлшемін пайдаланушы өзі түзетеді.
  return {
    bytes: new Uint8Array(await pngBlob.arrayBuffer()),
    width: bitmap.width,
    height: bitmap.height,
  };
}
