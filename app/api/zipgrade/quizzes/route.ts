import { NextResponse } from "next/server";
import { loginToZipGrade, ZIPGRADE_BASE } from "@/lib/zipgrade";

type QuizRow = { id: string; name: string; date: string; questions: number };

/**
 * Lists all quizzes in the ZipGrade account: id, name, date, question count.
 * Usage: GET /api/zipgrade/quizzes
 */
export async function GET() {
  try {
    const session = await loginToZipGrade();

    const res = await fetch(`${ZIPGRADE_BASE}/quizzes`, {
      headers: { Cookie: session },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `ZipGrade returned ${res.status}` },
        { status: 502 }
      );
    }

    const html = await res.text();

    const rowPattern =
      /name="quizList" value="([^"]+)">[\s\S]*?<a href="\/quiz\/\1\/all\/">\s*([^<]*)<\/a>\s*<\/td>\s*<td>([\d-]+)<\/td>\s*<td>(\d+)<\/td>/g;

    const quizzes: QuizRow[] = [];
    let match;
    while ((match = rowPattern.exec(html)) !== null) {
      quizzes.push({
        id: match[1],
        name: match[2].trim(),
        date: match[3],
        questions: Number(match[4]),
      });
    }

    if (quizzes.length === 0) {
      return NextResponse.json({
        quizzes: [],
        debug: {
          htmlLength: html.length,
          htmlSnippet: html.slice(0, 1500),
          containsLoginForm: html.includes("csrf_token") && html.includes("password"),
          containsQuizTable: html.includes("quizCheckbox"),
        },
      });
    }

    return NextResponse.json({ quizzes });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500 });
  }
}
