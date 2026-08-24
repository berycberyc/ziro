"use client";

import { useEffect, useRef, useState } from "react";
import { useLang } from "@/lib/LangContext";
import PhotoCropModal from "@/components/PhotoCropModal";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB — тексеру кесуге дейінгі файлға

/**
 * Фото таңдау блогы: камера / галерея → міндетті кесу терезесі → 3:4 JPEG.
 * Ата-анаға екі бөлек түйме керек, өйткені телефонда accept="image/*" кейде
 * камераны ұсынбай, бірден галереяны ашып жібереді.
 */
export default function PhotoPicker({
  existingUrl,
  onChange,
}: {
  existingUrl?: string | null;
  onChange: (file: File | null) => void;
}) {
  const { t } = useLang();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [rawFile, setRawFile] = useState<File | null>(null);
  const [croppedFile, setCroppedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [error, setError] = useState("");

  // Кесілген фотоның превьюсі.
  useEffect(() => {
    if (!croppedFile) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(croppedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [croppedFile]);

  function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Бір файлды қайта таңдағанда да onChange іске қосылуы үшін тазалаймыз.
    e.target.value = "";
    setError("");
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError(t.photoInvalidType);
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError(t.photoTooLarge);
      return;
    }
    setRawFile(file);
  }

  function handleCropDone(file: File) {
    setRawFile(null);
    setCroppedFile(file);
    onChange(file);
  }

  function handleRemove() {
    setCroppedFile(null);
    onChange(null);
  }

  const shownUrl = previewUrl || existingUrl || "";

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-ink/70">{t.photoLabel}</label>

      <div className="flex items-start gap-4">
        {shownUrl ? (
          <img
            src={shownUrl}
            alt=""
            className="h-[112px] w-[84px] shrink-0 rounded-xl border border-ink/10 object-cover"
          />
        ) : (
          <div className="flex h-[112px] w-[84px] shrink-0 items-center justify-center rounded-xl border border-dashed border-ink/20 bg-ink/5 text-[10px] text-ink/40">
            3:4
          </div>
        )}

        <div className="flex-1">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="focus-ring rounded-full bg-parent-soft px-4 py-2 text-sm font-semibold text-parent hover:opacity-90 sm:hidden"
            >
              {t.photoTakePhoto}
            </button>
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="focus-ring rounded-full border border-ink/15 px-4 py-2 text-sm font-semibold text-ink/70 hover:bg-ink/5"
            >
              {croppedFile || existingUrl ? t.photoChangeButton : t.photoChooseFile}
            </button>
            {croppedFile && (
              <button
                type="button"
                onClick={handleRemove}
                className="focus-ring rounded-full px-3 py-2 text-sm font-semibold text-ink/40 hover:text-ink/70"
              >
                {t.photoCropCancel}
              </button>
            )}
          </div>

          <p className="mt-2 text-xs text-ink/50">{t.photoNote}</p>
          {croppedFile && <p className="mt-1 text-xs font-semibold text-parent">{t.photoReady}</p>}
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePick}
        className="hidden"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handlePick}
        className="hidden"
      />

      {rawFile && (
        <PhotoCropModal
          file={rawFile}
          onDone={handleCropDone}
          onCancel={() => setRawFile(null)}
        />
      )}
    </div>
  );
}
