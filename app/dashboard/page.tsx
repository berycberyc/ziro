"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DashboardHomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/tests");
  }, [router]);

  return null;
}
