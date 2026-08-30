/**
 * Word файлын оқу: мәтін жолдары + формулалар LaTeX түрінде.
 *
 * Неге өз қолымызбен: Word теңдеулері OMML форматында сақталады, ал біздің
 * бетте KaTeX ($...$) қолданылады. Дайын кітапхананың бәрі не серверді,
 * не қосымша тәуелділікті талап етеді. Мұндағы код браузердің өз
 * құралдарымен жұмыс істейді: DecompressionStream (docx — бұл zip) және
 * DOMParser (document.xml — бұл xml).
 *
 * Нәтижесі pandoc шығаратын LaTeX-пен салыстырылып тексерілген.
 */

const M_NS = "http://schemas.openxmlformats.org/officeDocument/2006/math";

// ---------------------------------------------------------------
// 1. docx (zip) ішінен word/document.xml алу
// ---------------------------------------------------------------

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

/** docx ішіндегі барлық файлды атауы бойынша шығарып алады. */
async function readZip(file: File): Promise<Map<string, Uint8Array>> {
  const data = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(data.buffer);

  // ZIP-тің соңындағы каталогты іздейміз (End of Central Directory).
  let eocd = -1;
  for (let i = data.length - 22; i >= 0 && i > data.length - 66000; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Бұл docx файл емес сияқты.");

  const count = view.getUint16(eocd + 10, true);
  let ptr = view.getUint32(eocd + 16, true);
  const out = new Map<string, Uint8Array>();

  for (let i = 0; i < count; i++) {
    if (view.getUint32(ptr, true) !== 0x02014b50) break;
    const method = view.getUint16(ptr + 10, true);
    const compSize = view.getUint32(ptr + 20, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localOffset = view.getUint32(ptr + 42, true);
    const name = new TextDecoder().decode(data.subarray(ptr + 46, ptr + 46 + nameLen));

    // Бізге керегі: құжаттың өзі, суреттер және олардың байланыстары.
    if (name === "word/document.xml" || name === "word/_rels/document.xml.rels" || name.startsWith("word/media/")) {
      const lNameLen = view.getUint16(localOffset + 26, true);
      const lExtraLen = view.getUint16(localOffset + 28, true);
      const start = localOffset + 30 + lNameLen + lExtraLen;
      const raw = data.subarray(start, start + compSize);
      out.set(name, method === 0 ? raw : await inflateRaw(raw));
    }

    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

// ---------------------------------------------------------------
// 2. OMML -> LaTeX
// ---------------------------------------------------------------

const SKIP = new Set([
  "rPr", "ctrlPr", "argPr", "naryPr", "dPr", "fPr", "radPr",
  "funcPr", "barPr", "accPr", "sSupPr", "sSubPr", "sSubSupPr",
]);

function local(el: Element) {
  return el.localName;
}

function kids(el: Element | null, name: string): Element[] {
  if (!el) return [];
  return Array.from(el.children).filter((c) => local(c) === name);
}

function firstKid(el: Element | null, name: string): Element | null {
  return kids(el, name)[0] ?? null;
}

/** LaTeX-те бір таңбадан ұзын өрнек жақшаны талап етеді. */
/**
 * LaTeX аргументін жақшаға алады.
 *
 * Бір таңбалы аргументті жақшасыз қалдыруға тек ДӘРЕЖЕ мен ИНДЕКС үшін
 * болады: «x^2» дұрыс оқылады. Ал \frac, \overline, \sqrt сияқты
 * командаларда жақша әрқашан керек — әйтпесе «\frac» + «m» + «n» деген
 * «\fracmn» болып жабысып, KaTeX оны команда деп танымай, қызыл қатемен
 * шығарады. Дәл сол себепті алдын ала қарау экранында «\fracmn» көрінген.
 */
function wrap(s: string, alwaysBraces = false) {
  const t = s.trim();
  if (t.startsWith("{") && t.endsWith("}")) return t;
  if (!alwaysBraces && t.length === 1) return t;
  return `{${t}}`;
}

function convSeq(el: Element | null): string {
  if (!el) return "";
  return Array.from(el.children)
    .filter((c) => !SKIP.has(local(c)))
    .map(conv)
    .join("");
}

function conv(el: Element): string {
  switch (local(el)) {
    case "t":
      return el.textContent ?? "";
    case "r":
      return kids(el, "t").map((t) => t.textContent ?? "").join("");
    case "f":
      return (
        "\\frac" +
        wrap(convSeq(firstKid(el, "num")), true) +
        wrap(convSeq(firstKid(el, "den")), true)
      );
    case "sSup":
      return convSeq(firstKid(el, "e")) + "^" + wrap(convSeq(firstKid(el, "sup")));
    case "sSub":
      return convSeq(firstKid(el, "e")) + "_" + wrap(convSeq(firstKid(el, "sub")));
    case "sSubSup":
      return (
        convSeq(firstKid(el, "e")) +
        "_" + wrap(convSeq(firstKid(el, "sub"))) +
        "^" + wrap(convSeq(firstKid(el, "sup")))
      );
    case "rad": {
      const deg = convSeq(firstKid(el, "deg")).trim();
      const base = wrap(convSeq(firstKid(el, "e")), true);
      return (deg ? `\\sqrt[${deg}]` : "\\sqrt") + base;
    }
    case "d": {
      const pr = firstKid(el, "dPr");
      const beg = firstKid(pr, "begChr")?.getAttributeNS(M_NS, "val") ?? "(";
      const end = firstKid(pr, "endChr")?.getAttributeNS(M_NS, "val") ?? ")";
      const inner = kids(el, "e").map(convSeq).join("");
      return `\\left${beg || "."}${inner}\\right${end || "."}`;
    }
    case "nary": {
      const pr = firstKid(el, "naryPr");
      const chr = firstKid(pr, "chr")?.getAttributeNS(M_NS, "val") ?? "∑";
      const op =
        chr === "∏" ? "\\prod" : chr === "∫" ? "\\int" : chr === "⋃" ? "\\bigcup" : "\\sum";
      const sub = convSeq(firstKid(el, "sub")).trim();
      const sup = convSeq(firstKid(el, "sup")).trim();
      return (
        op +
        (sub ? "_" + wrap(sub) : "") +
        (sup ? "^" + wrap(sup) : "") +
        " " + convSeq(firstKid(el, "e"))
      );
    }
    case "func":
      return convSeq(firstKid(el, "fName")) + " " + convSeq(firstKid(el, "e"));
    case "bar":
      return "\\overline" + wrap(convSeq(firstKid(el, "e")), true);
    case "acc": {
      // Word-та үстіңгі сызықты екі жолмен қоюға болады:
      //   «Черты сверху и снизу» → m:bar (жоғарыда өңделеді);
      //   «Диакритические знаки» → m:acc, яғни «үстіне таңба қою».
      // Екіншісінде таңбаның өзін қарау керек: сызықша болса — сызық,
      // үйшік болса — үйшік. Бұрын бәрі үйшік (\hat) болып шығатын,
      // сондықтан «416x» деген сан «41ˆ6x» болып көрінген.
      const chr =
        firstKid(firstKid(el, "accPr"), "chr")?.getAttributeNS(M_NS, "val") ?? "\u0302";
      const cmd =
        chr === "\u0304" || chr === "\u0305" || chr === "‾" || chr === "¯"
          ? "\\overline"
          : chr === "\u20d7" || chr === "→"
          ? "\\vec"
          : chr === "\u0303" || chr === "~"
          ? "\\tilde"
          : chr === "\u0307" || chr === "˙"
          ? "\\dot"
          : "\\hat";
      return cmd + wrap(convSeq(firstKid(el, "e")), true);
    }
    default:
      // Белгісіз элемент — ішіндегі мәтін жоғалмауы керек.
      return convSeq(el);
  }
}

// ---------------------------------------------------------------
// 3. Абзацтар -> жолдар
// ---------------------------------------------------------------

/** Абзацтағы суреттің rId-ін табады (болса). */
function findImageRel(p: Element): string | null {
  const blips = p.getElementsByTagNameNS(
    "http://schemas.openxmlformats.org/drawingml/2006/main",
    "blip"
  );
  for (const b of Array.from(blips)) {
    const id =
      b.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "embed") ??
      b.getAttribute("r:embed");
    if (id) return id;
  }
  // Ескі формат (Word 2003 сияқты): v:imagedata
  const vml = p.getElementsByTagName("v:imagedata");
  for (const v of Array.from(vml)) {
    const id = v.getAttribute("r:id");
    if (id) return id;
  }
  return null;
}

function paragraphText(p: Element): string {
  const out: string[] = [];

  const walk = (el: Element) => {
    for (const c of Array.from(el.children)) {
      const name = local(c);
      if (name === "r" && c.namespaceURI !== M_NS) {
        for (const t of Array.from(c.children)) {
          if (local(t) === "t") out.push(t.textContent ?? "");
          else if (local(t) === "br" || local(t) === "tab") out.push(" ");
        }
      } else if (name === "oMathPara") {
        const latex = convSeq(c).trim();
        if (latex) out.push(`$$${latex}$$`);
      } else if (name === "oMath") {
        const latex = convSeq(c).trim();
        if (latex) out.push(`$${latex}$`);
      } else if (["hyperlink", "sdt", "sdtContent", "smartTag", "ins"].includes(name)) {
        walk(c);
      }
    }
  };

  walk(p);
  return out.join("").trim();
}

export type DocxImage = { blob: Blob; ext: string };

export type DocxContent = {
  /** Мәтін жолдары. Сурет тұрған жерде "[[image:N]]" деген белгі тұрады. */
  lines: string[];
  /** Белгідегі N -> сурет. */
  images: Map<number, DocxImage>;
};

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  bmp: "image/bmp",
  webp: "image/webp",
  emf: "image/emf",
  wmf: "image/wmf",
};

/**
 * Word файлын мағыналы жолдарға айналдырады.
 * Суреттер бөлек шығарылады, ал мәтінде олардың орны белгіленеді —
 * сол арқылы қай сурет қай сұраққа тиесілі екені анықталады.
 */
export async function docxToContent(file: File): Promise<DocxContent> {
  const zip = await readZip(file);

  const docBytes = zip.get("word/document.xml");
  if (!docBytes) throw new Error("Файл ішінен word/document.xml табылмады.");
  const xml = new TextDecoder("utf-8").decode(docBytes);

  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("Файлды оқу мүмкін болмады.");

  // rId -> word/media/... байланысы
  const relMap = new Map<string, string>();
  const relBytes = zip.get("word/_rels/document.xml.rels");
  if (relBytes) {
    const relDoc = new DOMParser().parseFromString(
      new TextDecoder("utf-8").decode(relBytes),
      "application/xml"
    );
    for (const r of Array.from(relDoc.getElementsByTagName("Relationship"))) {
      const id = r.getAttribute("Id");
      const target = r.getAttribute("Target");
      if (id && target) relMap.set(id, target.replace(/^\/?word\//, "").replace(/^\.\.\//, ""));
    }
  }

  const lines: string[] = [];
  const images = new Map<number, DocxImage>();
  let imageCounter = 0;

  const paragraphs = doc.getElementsByTagNameNS(
    "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "p"
  );

  for (const p of Array.from(paragraphs)) {
    const text = paragraphText(p);
    const rel = findImageRel(p);

    if (rel) {
      const target = relMap.get(rel);
      const bytes = target ? zip.get("word/" + target) : undefined;
      if (bytes) {
        const ext = (target!.split(".").pop() ?? "png").toLowerCase();
        imageCounter++;
        images.set(imageCounter, {
          blob: new Blob([bytes as BlobPart], { type: MIME[ext] ?? "image/png" }),
          ext,
        });
        lines.push(`[[image:${imageCounter}]]`);
      }
    }

    if (text) lines.push(text);
  }

  return { lines, images };
}
