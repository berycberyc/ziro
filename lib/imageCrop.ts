/**
 * Оқушы фотосын 3:4 пропорциясымен кесу.
 *
 * Неге керек: пропускта фото рамкасы қатаң 3:4. Бұрын фото өз пропорциясымен
 * жүктеліп, PDF-те созылып кететін. Енді ата-ана өзі кеседі — сервер ешнәрсе
 * болжамайды.
 *
 * EXIF туралы: суретті <img> арқылы жүктейміз, өйткені react-easy-crop та
 * дәл солай көрсетеді. Заманауи браузерлер <img>-ге EXIF бұрылысын өздері
 * қолданады, сондықтан экранда көрінген нәрсе canvas-қа да дәл солай түседі.
 */

export type CropArea = { x: number; y: number; width: number; height: number };

/** Пропуск рамкасы: 3:4 (210×280 нүкте). */
export const PHOTO_ASPECT = 3 / 4;

/** Сақталатын өлшем — рамкадан ірі, бірақ файл жеңіл болып қалады. */
export const PHOTO_OUT_WIDTH = 600;
export const PHOTO_OUT_HEIGHT = 800;

const JPEG_QUALITY = 0.85;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", () => reject(new Error("Image failed to load")));
    img.src = src;
  });
}

/** Бұрылған суреттің сыртқы қорабының өлшемі. */
function rotatedSize(width: number, height: number, rotation: number) {
  const rad = (rotation * Math.PI) / 180;
  return {
    width: Math.abs(Math.cos(rad) * width) + Math.abs(Math.sin(rad) * height),
    height: Math.abs(Math.sin(rad) * width) + Math.abs(Math.cos(rad) * height),
  };
}

/**
 * Таңдалған аймақты кесіп, 600×800 JPEG File қайтарады.
 * pixelCrop — react-easy-crop берген croppedAreaPixels.
 */
export async function cropImageToFile(
  imageSrc: string,
  pixelCrop: CropArea,
  rotation: number = 0,
  fileName: string = "photo.jpg"
): Promise<File> {
  const image = await loadImage(imageSrc);

  // 1-қадам: суретті бұрылысымен қоса толық canvas-қа саламыз.
  const box = rotatedSize(image.naturalWidth, image.naturalHeight, rotation);
  const stage = document.createElement("canvas");
  stage.width = Math.round(box.width);
  stage.height = Math.round(box.height);
  const stageCtx = stage.getContext("2d");
  if (!stageCtx) throw new Error("Canvas is not available");

  stageCtx.translate(stage.width / 2, stage.height / 2);
  stageCtx.rotate((rotation * Math.PI) / 180);
  stageCtx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);

  // 2-қадам: керек аймақты бөліп аламыз.
  const cropW = Math.max(1, Math.round(pixelCrop.width));
  const cropH = Math.max(1, Math.round(pixelCrop.height));
  const cropped = document.createElement("canvas");
  cropped.width = cropW;
  cropped.height = cropH;
  const croppedCtx = cropped.getContext("2d");
  if (!croppedCtx) throw new Error("Canvas is not available");
  croppedCtx.drawImage(
    stage,
    Math.round(pixelCrop.x),
    Math.round(pixelCrop.y),
    cropW,
    cropH,
    0,
    0,
    cropW,
    cropH
  );

  // 3-қадам: тұрақты 600×800-ге келтіреміз.
  const out = document.createElement("canvas");
  out.width = PHOTO_OUT_WIDTH;
  out.height = PHOTO_OUT_HEIGHT;
  const outCtx = out.getContext("2d");
  if (!outCtx) throw new Error("Canvas is not available");
  outCtx.imageSmoothingEnabled = true;
  outCtx.imageSmoothingQuality = "high";
  outCtx.fillStyle = "#ffffff";
  outCtx.fillRect(0, 0, out.width, out.height);
  outCtx.drawImage(cropped, 0, 0, out.width, out.height);

  const blob = await new Promise<Blob | null>((resolve) =>
    out.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
  );
  if (!blob) throw new Error("Failed to encode image");

  return new File([blob], fileName, { type: "image/jpeg" });
}
