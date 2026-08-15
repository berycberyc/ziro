import { supabase } from "@/lib/supabase";

export type SessionTestOption = {
  sessionId: string;
  titleKk: string;
  titleRu: string;
  sessionDate: string;
  testTypeCode: string;
  price: number;
};

export async function getUpcomingSessionTests(): Promise<SessionTestOption[]> {
  const { data, error } = await supabase
    .from("session_test_types")
    .select(
      `
      price,
      test_sessions ( id, title_kk, title_ru, session_date, price, is_active ),
      test_types ( code )
    `
    );

  if (error || !data) return [];

  return data
    .filter((row: any) => row.test_sessions?.is_active)
    .map((row: any) => ({
      sessionId: row.test_sessions.id,
      titleKk: row.test_sessions.title_kk,
      titleRu: row.test_sessions.title_ru,
      sessionDate: row.test_sessions.session_date,
      testTypeCode: row.test_types.code,
      price: row.price ?? row.test_sessions.price,
    }))
    .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));
}
