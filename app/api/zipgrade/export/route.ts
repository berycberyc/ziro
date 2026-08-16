import { NextRequest, NextResponse } from "next/server";
import { loginToZipGrade, ZIPGRADE_BASE } from "@/lib/zipgrade";

/**
 * Downloads the "Full Format" CSV export for a given ZipGrade quiz ID.
 * Usage: GET /api/zipgrade/export?quizId=<the ZipGrade quiz id>
 */
export async function GET(request: NextRequest) {
  const quizId = request.nextUrl.searchParams.get("quizId");
  if (!quizId) {
    return NextResponse.json({ error: "Missing quizId query param" }, { status: 400 });
  }

  try {
    const session = await loginToZipGrade();

    const csvRes = await fetch(`${ZIPGRADE_BASE}/quiz/full/all/${quizId}.CSV`, {
      headers: { Cookie: session },
    });

    if (!csvRes.ok) {
      return NextResponse.json(
        { error: `ZipGrade returned ${csvRes.status} for that quiz id` },
        { status: 502 }
      );
    }

    const csvText = await csvRes.text();

    return new NextResponse(csvText, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="zipgrade_${quizId}.csv"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500 });
  }
}
