"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function TeacherHomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/teacher/scan");
  }, [router]);

  return null;
}
