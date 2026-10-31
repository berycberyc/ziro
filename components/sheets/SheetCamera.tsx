"use client";

import { useEffect, useRef, useState } from "react";
import {
  AIM_WIDTH, aimWindows, clickSound, marksInWindows, readCanvas, toReadCanvas,
} from "@/lib/sheets/camera";
import { findCorners, greysFromRgba, type SheetReading } from "@/lib/sheets/read";

/**
 * Тірі камерамен түсіру.
 *
 * Батырма жоқ: бұрыштарда төрт терезе тұрады, парақтың белгілері соларға
 * түсіп, үш кадр қатарынан тұрақты тұрса — камера өзі түсіреді. Сонда қисық
 * кадр болмайды.
 *
 * Түсірген соң бір парақ екінші рет түсірілмеуі үшін, белгілер кадрдан
 * жоғалғанша (парақты алғанша) күтеді. Камера жабылмайды: парақтар бір
 * бумамен өтеді.
 */

const STEADY = 3;

export interface Shot {
  reading: SheetReading;
  /** Оқылған суреттің өзі — түзету экраны соны қияды. */
  shot: string;
  width: number;
  height: number;
}

export function SheetCamera({ paused, onShot, onClose, counter, notice }: {
  /** Карточка ашық тұрғанда камера күтеді. */
  paused: boolean;
  onShot: (shot: Shot) => void;
  onClose: () => void;
  counter: string;
  /** Беттің өз хабары (мысалы, РФМШ парағы) — камера үстінде көрінуі үшін. */
  notice?: string;
}) {
  const video = useRef<HTMLVideoElement | null>(null);
  const aim = useRef<HTMLCanvasElement | null>(null);
  const [trouble, setTrouble] = useState("");
  const [ready, setReady] = useState(false);
  const [inWindows, setInWindows] = useState(0);
  const [note, setNote] = useState("");
  const steady = useRef(0);
  const busy = useRef(false);
  const waitAway = useRef(false);
  const hands = useRef({ paused, onShot });
  hands.current = { paused, onShot };

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: number | null = null;
    let alive = true;

    const grab = () => {
      const source = video.current;
      if (!source || busy.current) return;
      busy.current = true;
      try {
        const canvas = toReadCanvas(source, source.videoWidth, source.videoHeight);
        const reading = readCanvas(canvas);
        if (reading.status === "no_sheet") { steady.current = 0; return; }
        if (reading.status === "no_code") {
          setNote("Код оқылмады — парақты жақынырақ, жарықта ұстаңыз");
          steady.current = 0;
          return;
        }
        clickSound();
        setNote("");
        waitAway.current = true;
        steady.current = 0;
        hands.current.onShot({
          reading, shot: canvas.toDataURL("image/jpeg", 0.85), width: canvas.width, height: canvas.height,
        });
      } finally {
        busy.current = false;
      }
    };

    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } },
        });
      } catch {
        if (alive) setTrouble("Камера ашылмады. Браузерге камераға рұқсат беріңіз.");
        return;
      }
      if (!alive || !video.current) return;
      video.current.srcObject = stream;
      await video.current.play().catch(() => undefined);
      if (alive) setReady(true);

      // Бұл желіге сұраныс емес — өз камерамыздың кадрын қарау.
      timer = window.setInterval(() => {
        const source = video.current, board = aim.current;
        if (!source || !board || busy.current || !source.videoWidth) return;
        const scale = AIM_WIDTH / source.videoWidth;
        board.width = AIM_WIDTH;
        board.height = Math.round(source.videoHeight * scale);
        const ink = board.getContext("2d", { willReadFrequently: true });
        if (!ink) return;
        ink.drawImage(source, 0, 0, board.width, board.height);
        const paint = ink.getImageData(0, 0, board.width, board.height).data;
        const marks = findCorners(greysFromRgba(paint, board.width, board.height).neutral);
        const windows = aimWindows(board.width, board.height);
        const hit = marksInWindows(windows, marks);
        const count = hit.filter(Boolean).length;
        setInWindows(count);

        if (waitAway.current) {
          if (count === 0) waitAway.current = false;
          steady.current = 0;
        } else if (count === windows.length && !hands.current.paused) {
          steady.current++;
        } else {
          steady.current = 0;
        }

        ink.clearRect(0, 0, board.width, board.height);
        ink.fillStyle = "rgba(0,0,0,0.45)";
        ink.fillRect(0, 0, board.width, board.height);
        windows.forEach((box, at) => {
          ink.clearRect(box.left, box.top, box.side, box.side);
          ink.strokeStyle = hit[at] ? "#22c55e" : "rgba(255,255,255,0.7)";
          ink.lineWidth = hit[at] ? 4 : 2;
          ink.strokeRect(box.left, box.top, box.side, box.side);
        });

        if (!waitAway.current && !hands.current.paused && steady.current >= STEADY) grab();
      }, 200);
    })();

    return () => {
      alive = false;
      if (timer !== null) window.clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const say = trouble
    || (!ready ? "…"
      : waitAway.current ? "Парақты алыңыз, келесісін қойыңыз"
      : inWindows === 4 ? "Ұстап тұрыңыз…"
      : "Парақтың төрт бұрышын терезелерге келтіріңіз");

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <video ref={video} playsInline muted className="absolute inset-0 h-full w-full object-contain" />
      <canvas ref={aim} className="absolute inset-0 h-full w-full object-contain" />
      <div className="absolute inset-x-0 top-0 flex items-start gap-2 p-3">
        <span className="min-w-0 flex-1 rounded-xl bg-black/60 px-3 py-2 text-sm text-white">
          {say}
          {note && <span className="mt-1 block text-amber-300">{note}</span>}
          {notice && <span className="mt-1 block text-amber-300">{notice}</span>}
        </span>
        <span className="shrink-0 rounded-xl bg-black/60 px-3 py-2 text-sm text-white">{counter}</span>
        <button onClick={onClose} aria-label="Жабу"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/60 text-xl text-white">
          ✕
        </button>
      </div>
    </div>
  );
}
