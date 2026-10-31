import { KIND_BY_NUMBER, KIND_NUMBER, STRIP, type SheetKind } from "./layout";

/**
 * Парақтың жоғарғы жолағындағы код: 28 шаршы, қара — 1, ақ — 0.
 *
 *   2 бит  — парақтың түрі (НИШ, Тілдер, БИЛ, РФМШ)
 *   2 бит  — нұсқа (1–4)
 *   17 бит — оқушының ZipGrade ID-і (5 цифр, 0–99999)
 *   7 бит  — тексеру (CRC-7)
 *
 * Неге тексеру керек. Суретте бір шаршы қате оқылса, басқа оқушының нөмірі
 * шығып кетуі мүмкін — сонда жауаптар бөтен балаға жазылар еді. Тексеру
 * биттері бір-екі қатені міндетті түрде ұстайды: код сәйкес келмесе, машина
 * «қайта түсіріңіз» дейді, ешкімді болжамайды.
 */

const DATA_BITS = 21;
const CHECK_BITS = 7;
const ID_BITS = 17;

export interface SheetCode {
  kind: SheetKind;
  variant: number;
  /** 5 таңбалы, алдындағы нөлдермен: «01234». */
  zipgradeId: string;
}

/**
 * CRC-7 (көпмүше x⁷ + x³ + 1) — биттер тізбегінен.
 *
 * Регистр нөлден емес, бірліктерден басталады: әйтпесе мүлде бос (басылмаған)
 * жолақ «бәрі нөл, тексеру де нөл» болып, 00000 оқушының парағы деп оқылар еді.
 */
function crc7(bits: boolean[]): boolean[] {
  let reg = 0x7f;
  for (const bit of bits) {
    const top = ((reg >> 6) & 1) ^ (bit ? 1 : 0);
    reg = (reg << 1) & 0x7f;
    if (top) reg ^= 0x09;
  }
  return Array.from({ length: CHECK_BITS }, (_, k) => Boolean((reg >> (CHECK_BITS - 1 - k)) & 1));
}

function toBits(value: number, count: number): boolean[] {
  return Array.from({ length: count }, (_, k) => Boolean((value >> (count - 1 - k)) & 1));
}

function fromBits(bits: boolean[]): number {
  return bits.reduce((sum, bit) => sum * 2 + (bit ? 1 : 0), 0);
}

/** Басу үшін: код → 28 бит. Жарамсыз деректе қате лақтырады (басылмауы керек). */
export function encodeSheetCode(code: SheetCode): boolean[] {
  const id = Number(code.zipgradeId);
  if (!/^\d{1,5}$/.test(code.zipgradeId.trim()) || !Number.isInteger(id) || id < 0 || id > 99999) {
    throw new Error(`ZipGrade ID жарамсыз: «${code.zipgradeId}»`);
  }
  if (!(code.variant >= 1 && code.variant <= 4)) throw new Error(`Нұсқа жарамсыз: ${code.variant}`);
  const data = [
    ...toBits(KIND_NUMBER[code.kind], 2),
    ...toBits(code.variant - 1, 2),
    ...toBits(id, ID_BITS),
  ];
  const out = [...data, ...crc7(data)];
  if (out.length !== STRIP.count) throw new Error("code_length");
  return out;
}

/** Суреттен оқылған 28 бит → код. Тексеру сәйкес келмесе — null. */
export function decodeSheetCode(bits: boolean[]): SheetCode | null {
  if (bits.length !== STRIP.count) return null;
  const data = bits.slice(0, DATA_BITS);
  const check = bits.slice(DATA_BITS);
  const want = crc7(data);
  if (want.some((bit, k) => bit !== check[k])) return null;
  const id = fromBits(data.slice(4));
  if (id > 99999) return null;
  return {
    kind: KIND_BY_NUMBER[fromBits(data.slice(0, 2))],
    variant: fromBits(data.slice(2, 4)) + 1,
    zipgradeId: String(id).padStart(5, "0"),
  };
}
