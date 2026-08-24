"use client";

import { useCallback, useEffect, useState } from "react";
import Cropper from "react-easy-crop";
import { useLang } from "@/lib/LangContext";
import { cropImageToFile, PHOTO_ASPECT, type CropArea } from "@/lib/imageCrop";

export default function PhotoCropModal({
  file,
  onDone,
  onCancel,
}: {
  file: File;
  onDone: (cropped: File) => void;
  onCancel: () => void;
}) {
  const { t } = useLang();
  const [imageSrc, setImageSrc] = useState<string>("");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [areaPixels, setAreaPixels] = useState<CropArea | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Файлдан уақытша URL жасаймыз, модал жабылғанда босатамыз.
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImageSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Модал ашық тұрғанда беттің өзі скроллданбауы керек.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const handleCropComplete = useCallback((_area: any, croppedAreaPixels: any) => {
    setAreaPixels(croppedAreaPixels as CropArea);
  }, []);

  async function handleConfirm() {
    if (!areaPixels || !imageSrc) return;
    setSaving(true);
    setError("");
    try {
      const cropped = await cropImageToFile(imageSrc, areaPixels, rotation, "photo.jpg");
      onDone(cropped);
    } catch (err) {
      console.error("Photo crop failed:", err);
      setError(t.errorGeneric);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink">
      <div className="flex items-center justify-between px-5 py-4">
        <p className="font-display text-base font-bold text-parchment">{t.photoCropTitle}</p>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="focus-ring rounded-full px-3 py-1.5 text-sm font-semibold text-parchment/70 hover:text-parchment disabled:opacity-50"
        >
          {t.photoCropCancel}
        </button>
      </div>

      <div className="relative flex-1">
        {imageSrc && (
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={PHOTO_ASPECT}
            minZoom={1}
            maxZoom={4}
            zoomWithScroll
            restrictPosition
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            onCropComplete={handleCropComplete}
          />
        )}
      </div>

      <div className="space-y-4 px-5 pb-6 pt-4">
        <p className="text-center text-xs leading-relaxed text-parchment/60">{t.photoCropHint}</p>

        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] uppercase tracking-wider text-parchment/50">
            {t.photoCropZoom}
          </span>
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-parchment/25 accent-gold"
          />
        </div>

        {error && <p className="text-center text-sm text-red-400">{error}</p>}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setRotation((r) => (r + 90) % 360)}
            disabled={saving}
            className="focus-ring rounded-full border border-parchment/25 px-5 py-3 text-sm font-semibold text-parchment hover:bg-parchment/10 disabled:opacity-50"
          >
            {t.photoCropRotate}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving || !areaPixels}
            className="focus-ring flex-1 rounded-full bg-gold px-5 py-3 text-sm font-bold text-ink hover:opacity-90 disabled:opacity-50"
          >
            {saving ? t.photoCropProcessing : t.photoCropConfirm}
          </button>
        </div>
      </div>
    </div>
  );
}
