"use client";

import { useEffect } from "react";
import { captureUtmFromUrl } from "@/lib/utm";

/** Кез келген бетке жарнама сілтемесімен кірсе, белгіні сақтайды. */
export default function UtmCapture() {
  useEffect(() => {
    captureUtmFromUrl();
  }, []);
  return null;
}
