/**
 * Жүктелген Word файлынан басып шығаруға дайын нұсқа жасау.
 *
 * НЕГЕ ҚАЙТА ҚҰРАСТЫРМАЙМЫЗ. Бастапқыда таза құжат базадан нөлден
 * жиналатын, бірақ ондай құжатта формулалар суретке айналады: өңдеуге
 * келмейді, шрифт өлшемімен үйлеспейді, басып шығарғанда бұлыңғыр болады.
 * Ал пайдаланушының файлында формулалар — Word-тың нағыз теңдеулері.
 * Сондықтан құжатты қайта жасамай, СОЛ ФАЙЛДЫҢ көшірмесін тазалаймыз:
 * формулалар, суреттер, стильдер сол күйінде қалады.
 *
 * Не істейді:
 *   • [question12] → сұрақтың бірінші жолына «12. » деп қосады
 *   • [A] → «A) », [A_баған] → «A) »
 *   • [kk] / [ru] → біреуін қалдырып, екіншісінің бүкіл блогын өшіреді
 *   • [Тақырып], [right_answer], [Нұсқа 1], пән аты — өшіріледі
 *   • сурет басқа тілдегі блокта тұрса, қалған блокта сурет жоқ болса —
 *     сурет жоғалмас үшін көшіріледі
 */

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const XML_SPACE = "http://www.w3.org/XML/1998/namespace";

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function deflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

type ZipEntry = { name: string; data: Uint8Array };

async function readZipEntries(file: File): Promise<ZipEntry[]> {
  const data = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(data.buffer);

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
  const entries: ZipEntry[] = [];

  for (let i = 0; i < count; i++) {
    if (view.getUint32(ptr, true) !== 0x02014b50) break;
    const method = view.getUint16(ptr + 10, true);
    const compSize = view.getUint32(ptr + 20, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localOffset = view.getUint32(ptr + 42, true);
    const name = new TextDecoder().decode(data.subarray(ptr + 46, ptr + 46 + nameLen));

    const lNameLen = view.getUint16(localOffset + 26, true);
    const lExtraLen = view.getUint16(localOffset + 28, true);
    const start = localOffset + 30 + lNameLen + lExtraLen;
    const raw = data.subarray(start, start + compSize);
    entries.push({ name, data: method === 0 ? raw : await inflateRaw(raw) });

    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

// CRC-32 — zip үшін қажет.
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

async function writeZip(entries: ZipEntry[]): Promise<Blob> {
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const e of entries) {
    const nameBytes = new TextEncoder().encode(e.name);
    const compressed = await deflateRaw(e.data);
    const crc = crc32(e.data);

    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0, true);
    lv.setUint16(8, 8, true); // deflate
    lv.setUint32(14, crc, true);
    lv.setUint32(18, compressed.length, true);
    lv.setUint32(22, e.data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);

    chunks.push(local, compressed);

    const cd = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(10, 8, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, compressed.length, true);
    cv.setUint32(24, e.data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    cd.set(nameBytes, 46);
    central.push(cd);

    offset += local.length + compressed.length;
  }

  const centralSize = central.reduce((a, c) => a + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  return new Blob([...chunks, ...central, end] as BlobPart[], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

// ---------------------------------------------------------------
// Тазалау
// ---------------------------------------------------------------

const TAG_RE = /^\[([^\]]+)\]\s*([\s\S]*)$/;

function paragraphText(p: Element): string {
  return Array.from(p.getElementsByTagNameNS(W, "t"))
    .map((t) => t.textContent ?? "")
    .join("")
    .trim();
}

/** Абзац тек бет үзілімінен тұра ма? */
function isPageBreakOnly(p: Element): boolean {
  const breaks = Array.from(p.getElementsByTagNameNS(W, "br")).filter(
    (b) => b.getAttributeNS(W, "type") === "page" || b.getAttribute("w:type") === "page"
  );
  return breaks.length > 0 && paragraphText(p) === "";
}

function hasImage(p: Element): boolean {
  return (
    p.getElementsByTagNameNS("http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing", "*").length > 0 ||
    p.getElementsByTagName("w:drawing").length > 0 ||
    p.getElementsByTagName("w:pict").length > 0
  );
}

/**
 * Абзац басындағы [X] белгісін өшіріп, орнына replacement қояды.
 * Word белгіні бөліп жазуы мүмкін ("[", "B", "]5"), сондықтан бүкіл
 * мәтін бойынша есептеп, әріптерді бөліктерден ретімен қиямыз.
 */
function stripTagPrefix(p: Element, replacement: string) {
  const runs = Array.from(p.getElementsByTagNameNS(W, "t"));
  const full = runs.map((t) => t.textContent ?? "").join("");
  const m = full.match(/^\s*\[[^\]]*\]\s*/);
  if (!m) return;

  let remove = m[0].length;
  for (const t of runs) {
    const s = t.textContent ?? "";
    if (remove <= 0) break;
    if (s.length <= remove) {
      remove -= s.length;
      t.textContent = "";
    } else {
      t.textContent = s.slice(remove);
      remove = 0;
    }
  }
  if (replacement && runs.length > 0) {
    runs[0].textContent = replacement + (runs[0].textContent ?? "");
    runs[0].setAttributeNS(XML_SPACE, "xml:space", "preserve");
  }
}

function makeNumberRun(doc: Document, text: string): Element {
  const r = doc.createElementNS(W, "w:r");
  const t = doc.createElementNS(W, "w:t");
  t.setAttributeNS(XML_SPACE, "xml:space", "preserve");
  t.textContent = text;
  r.appendChild(t);
  return r;
}

/** Бір тілге арналған таза көшірме жасайды. */
export async function buildCleanDocx(file: File, lang: "kk" | "ru"): Promise<Blob> {
  const entries = await readZipEntries(file);
  const docEntry = entries.find((e) => e.name === "word/document.xml");
  if (!docEntry) throw new Error("Файл ішінен word/document.xml табылмады.");

  const xml = new TextDecoder("utf-8").decode(docEntry.data);
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const body = doc.getElementsByTagNameNS(W, "body")[0];
  if (!body) throw new Error("Құжаттың құрылымы танылмады.");

  const keep: Element[] = [];
  let mode: "header" | "await" | "kk" | "ru" | "passage" = "header";
  let pendingNumber: string | null = null;
  // Басқа тілдегі блоктағы суреттер: жоғалмауы үшін сақтап, осы тілдегі
  // сұрақтың мәтінінен КЕЙІН қоямыз. Бұрын кезектің соңына түсіп, келесі
  // сұрақтың алдында тұрып қалатын.
  let pendingImages: Element[] = [];
  let keptImageInQuestion = false;

  for (const el of Array.from(body.children)) {
    if (el.localName !== "p") {
      keep.push(el);
      continue;
    }

    const text = paragraphText(el);
    const m = text.match(TAG_RE);
    const key = m ? m[1].trim().toLowerCase() : null;

    if (key) {
      if (/^question\s*\d+$/.test(key)) {
        // Сұрақ мәтіні табылмай қалса да сурет жоғалмасын.
        if (pendingImages.length > 0 && !keptImageInQuestion) keep.push(...pendingImages);
        pendingImages = [];
        keptImageInQuestion = false;
        pendingNumber = `${key.match(/\d+/)![0]}. `;
        mode = "await";
        continue;
      }
      if (["kk", "қаз", "каз"].includes(key)) {
        mode = "kk";
        continue;
      }
      if (["ru", "рус"].includes(key)) {
        mode = "ru";
        continue;
      }
      if (["тақырып", "тема", "topic", "right_answer", "дұрыс_жауап"].includes(key)) continue;
      if (/^(нұсқа|нускa|нуска|вариант|variant)\s*\d+$/.test(key)) continue;

      if (/^[abcd]$/.test(key)) {
        if ((mode === "kk" || mode === "ru") && mode !== lang) continue;
        stripTagPrefix(el, key.toUpperCase() + ") ");
        keep.push(el);
        continue;
      }
      if (/^[ab]_(баған|bagan)$/.test(key)) {
        if ((mode === "kk" || mode === "ru") && mode !== lang) continue;
        stripTagPrefix(el, key[0].toUpperCase() + ") ");
        keep.push(el);
        continue;
      }
      if (/^(мәтін|матин|текст|passage)\s*\d+$/.test(key)) {
        stripTagPrefix(el, "");
        keep.push(el);
        mode = "passage";
        continue;
      }
      // Танылмаған, бірақ жалғыз тұрған белгі — сессия аты, пән аты.
      if (/^\[[^\]]+\]$/.test(text.trim())) continue;
      if (mode === "header") continue;
    }

    if ((mode === "kk" || mode === "ru") && mode !== lang) {
      if (hasImage(el)) pendingImages.push(el);
      continue;
    }
    if (mode === "header") continue;

    // Бет үзілімдері екі тілде бірдей болуы үшін алынып тасталады —
    // беттің бөлінуін пайдаланушы өзі қайта қояды.
    if (isPageBreakOnly(el)) continue;

    const isQuestionText = Boolean(pendingNumber && text);
    if (isQuestionText) {
      const run = makeNumberRun(doc, pendingNumber!);
      const first = el.firstElementChild;
      if (first && first.localName === "pPr") el.insertBefore(run, first.nextSibling);
      else el.insertBefore(run, el.firstChild);
      pendingNumber = null;
    }
    if (hasImage(el)) keptImageInQuestion = true;
    keep.push(el);

    // Сұрақтың мәтінінен кейін — сол сұрақтың суреті.
    if (isQuestionText && pendingImages.length > 0) {
      keep.push(...pendingImages);
      pendingImages = [];
      keptImageInQuestion = true;
    }
  }

  if (pendingImages.length > 0 && !keptImageInQuestion) keep.push(...pendingImages);

  while (body.firstChild) body.removeChild(body.firstChild);
  keep.forEach((el) => body.appendChild(el));

  const out = new XMLSerializer().serializeToString(doc);
  docEntry.data = new TextEncoder().encode(out);

  return writeZip(entries);
}
