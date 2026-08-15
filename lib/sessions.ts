import { supabase } from "@/lib/supabase";

export type SessionSummary = {
  sessionId: string;
  titleKk: string;
  titleRu: string;
  sessionDate: string;
  price: number;
  testTypeCodes: string[];
};

export async function getUpcomingSessions(): Promise<SessionSummary[]> {
  const { data, error } = await supabase
    .from("session_test_types")
    .select(
      `
      test_session_id,
      price,
      test_sessions ( id, title_kk, title_ru, session_date, price, is_active ),
      test_types ( code )
    `
    );

  if (error || !data) return [];

  const bySession = new Map<string, SessionSummary>();

  for (const row of data as any[]) {
    if (!row.test_sessions?.is_active) continue;
    const id = row.test_sessions.id;
    if (!bySession.has(id)) {
      bySession.set(id, {
        sessionId: id,
        titleKk: row.test_sessions.title_kk,
        titleRu: row.test_sessions.title_ru,
        sessionDate: row.test_sessions.session_date,
        price: row.test_sessions.price,
        testTypeCodes: [],
      });
    }
    bySession.get(id)!.testTypeCodes.push(row.test_types.code);
  }

  return Array.from(bySession.values()).sort((a, b) =>
    a.sessionDate.localeCompare(b.sessionDate)
  );
}

export type SessionDetail = {
  id: string;
  titleKk: string;
  titleRu: string;
  sessionDate: string;
  testTypes: { id: string; code: string; nameKk: string; nameRu: string; price: number }[];
};

export async function getSessionDetail(sessionId: string): Promise<SessionDetail | null> {
  const { data: session } = await supabase
    .from("test_sessions")
    .select("id, title_kk, title_ru, session_date, price")
    .eq("id", sessionId)
    .single();

  if (!session) return null;

  const { data: links } = await supabase
    .from("session_test_types")
    .select("price, test_types ( id, code, name_kk, name_ru )")
    .eq("test_session_id", sessionId);

  const testTypes = (links ?? []).map((row: any) => ({
    id: row.test_types.id,
    code: row.test_types.code,
    nameKk: row.test_types.name_kk,
    nameRu: row.test_types.name_ru,
    price: row.price ?? session.price,
  }));

  return {
    id: session.id,
    titleKk: session.title_kk,
    titleRu: session.title_ru,
    sessionDate: session.session_date,
    testTypes,
  };
}
