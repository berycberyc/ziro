import type { QuestionItem } from "./parse";
import type { AnswerFormat } from "./profiles";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function paragraph(innerXml: string): string {
  return `<w:p>${innerXml}</w:p>`;
}

function textRun(text: string, bold = false): string {
  const rpr = bold ? "<w:rPr><w:b/></w:rPr>" : "";
  return `<w:r>${rpr}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

/** Injects a leading text run into an existing paragraph's XML, right after its
 * paragraph properties (or right after the opening tag if there are none),
 * so the rest of the paragraph's original content/formatting is untouched. */
function withLeadingRun(paragraphXml: string, prefixText: string, bold = false): string {
  const run = textRun(prefixText, bold);
  if (paragraphXml.includes("</w:pPr>")) {
    return paragraphXml.replace("</w:pPr>", "</w:pPr>" + run);
  }
  return paragraphXml.replace(/(<w:p\b[^>]*>)/, `$1${run}`);
}

export function buildVariantBody(
  items: QuestionItem[],
  opts: {
    nameWord: string;
    variantNumber: number;
    lang: "kk" | "ru";
    answerFormat: AnswerFormat;
  }
): { bodyXml: string; answerKey: string[] } {
  const { nameWord, variantNumber, lang, answerFormat } = opts;
  const parts: string[] = [];
  const answerKey: string[] = [];

  const variantWord = lang === "kk" ? "Нұсқа" : "Вариант";
  const digitLine = String(variantNumber).repeat(12);
  parts.push(
    paragraph(textRun(`${nameWord} — ${variantWord} ${variantNumber}    ${digitLine}`, true))
  );
  parts.push(paragraph(""));

  items.forEach((item, index) => {
    const qNum = index + 1;

    // Question text — every language version present, one after another.
    item.questionParas.forEach((q, qi) => {
      q.paras.forEach((xml, pi) => {
        if (qi === 0 && pi === 0) {
          parts.push(withLeadingRun(xml, `${qNum}. `, true));
        } else {
          parts.push(xml);
        }
      });
    });

    if (answerFormat === "numeric") {
      // Open numeric answer — just a blank line for the student to fill in.
      parts.push(paragraph(textRun("Жауабы / Ответ: _______________")));
      const correctText = item.answerParas[0]
        ? item.answerParas[0].xml.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)?.map((t) =>
            t.replace(/<w:t[^>]*>/, "").replace(/<\/w:t>/, "")
          ).join("") ?? ""
        : "";
      answerKey.push(`${qNum}-${correctText.trim()}`);
    } else {
      item.answerParas.forEach((ans, ai) => {
        const letter = LETTERS[ai] ?? "?";
        parts.push(withLeadingRun(ans.xml, `${letter}) `));
        if (ans.correct) {
          answerKey.push(`${qNum}-${letter}`);
        }
      });
    }

    parts.push(paragraph(""));
  });

  return { bodyXml: parts.join(""), answerKey };
}

export function buildAnswerKeySection(lang: "kk" | "ru", variantNumber: number, keys: string[]): string {
  const title = lang === "kk" ? `Нұсқа ${variantNumber} — жауаптар кілті` : `Вариант ${variantNumber} — ключ ответов`;
  const parts: string[] = [];
  parts.push(paragraph(""));
  parts.push(paragraph(textRun(title, true)));
  parts.push(paragraph(textRun(keys.join(", "))));
  return parts.join("");
}
