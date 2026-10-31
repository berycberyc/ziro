import { cornerSpots, PAGE, CORNER_SIZE, type Spot } from "./layout";
import { greysFromRgba, readSheet, type SheetReading } from "./read";

/**
 * Камера мен суреттің браузердегі бөлігі: кадрды сұр суретке айналдыру,
 * бағыттау терезелері, затвор дыбысы.
 */

/** Оқу осы енде жүреді: дөңгелек 15-тей нүкте болады, жұмыс 16 есе аз. */
export const READ_WIDTH = 1100;
/** Бағыттау осы енде: белгілер көрінеді, ал жұмыс он есе аз. */
export const AIM_WIDTH = 480;

export interface AimWindow { left: number; top: number; side: number }

/**
 * Парақ кадрға дұрыс сыйса, белгілер қай жерге түседі — сол жерде терезелер.
 * Терезе белгіден 5 есе үлкен: қолмен ұстағанда дәл келтіру қиын.
 */
export function aimWindows(width: number, height: number): AimWindow[] {
  const scale = Math.min(width / PAGE.width, height / PAGE.height);
  const left = (width - PAGE.width * scale) / 2;
  const top = (height - PAGE.height * scale) / 2;
  const side = Math.max(12, CORNER_SIZE * scale * 5);
  return cornerSpots().map((spot) => ({
    left: left + spot.x * scale - side / 2,
    top: top + spot.y * scale - side / 2,
    side,
  }));
}

export function marksInWindows(windows: AimWindow[], marks: Spot[] | null): boolean[] {
  if (!marks) return windows.map(() => false);
  return windows.map((box, at) => {
    const mark = marks[at];
    return !!mark && mark.x >= box.left && mark.x <= box.left + box.side
      && mark.y >= box.top && mark.y <= box.top + box.side;
  });
}

/** Кез келген суреттен (видео кадры, файл) — оқуға дайын кіші холст. */
export function toReadCanvas(source: CanvasImageSource, width: number, height: number): HTMLCanvasElement {
  const scale = Math.min(1, READ_WIDTH / width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ink = canvas.getContext("2d", { willReadFrequently: true });
  if (!ink) throw new Error("no_canvas");
  ink.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function readCanvas(canvas: HTMLCanvasElement): SheetReading {
  const ink = canvas.getContext("2d", { willReadFrequently: true });
  if (!ink) return { status: "no_sheet" };
  const paint = ink.getImageData(0, 0, canvas.width, canvas.height).data;
  return readSheet(greysFromRgba(paint, canvas.width, canvas.height));
}

/** Файлдан (телефонда түсірілген сурет) оқу — камерасыз тексеру үшін. */
export async function readFile(file: File): Promise<{ reading: SheetReading; shot: string; width: number; height: number }> {
  const picture = await createImageBitmap(file);
  const canvas = toReadCanvas(picture, picture.width, picture.height);
  picture.close();
  return { reading: readCanvas(canvas), shot: canvas.toDataURL("image/jpeg", 0.85), width: canvas.width, height: canvas.height };
}

/**
 * Затвордың шыртылы. Админ экранға емес, қағазға қарап отырады — «алдым»
 * деген белгі тек дыбыс. Файл жоқ: дыбыс орнында жиналады.
 */
export function clickSound() {
  try {
    const Sound = window.AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Sound) return;
    const air = new Sound();
    for (const [at, high] of [[0, 2200], [0.055, 1400]] as const) {
      const tone = air.createOscillator();
      const loud = air.createGain();
      tone.type = "square";
      tone.frequency.value = high;
      loud.gain.setValueAtTime(0.0001, air.currentTime + at);
      loud.gain.exponentialRampToValueAtTime(0.18, air.currentTime + at + 0.004);
      loud.gain.exponentialRampToValueAtTime(0.0001, air.currentTime + at + 0.035);
      tone.connect(loud); loud.connect(air.destination);
      tone.start(air.currentTime + at);
      tone.stop(air.currentTime + at + 0.05);
    }
    setTimeout(() => void air.close().catch(() => undefined), 400);
  } catch {
    // Дыбыс жоқ — карточка бәрібір шығады.
  }
}
