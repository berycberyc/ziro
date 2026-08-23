import { supabase } from "@/lib/supabase";

export type SessionSummary = {
  sessionId: string;
  titleKk: string;
  titleRu: string;
  sessionDate: string;
  address: string | null;
  price: number;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
};

export async function getUpcomingSessions(): Promise<SessionSummary[]> {
  const { data, error } = await supabase
    .from("test_sessions")
    .select("id, title_kk, title_ru, session_date, address, price, registration_opens_at, registration_closes_at, is_active")
    .eq("is_active", true)
    .order("session_date", { ascending: true });

  if (error || !data) return [];

  return data.map((s) => ({
    sessionId: s.id,
    titleKk: s.title_kk,
    titleRu: s.title_ru,
    sessionDate: s.session_date,
    address: s.address,
    price: s.price,
    registrationOpensAt: s.registration_opens_at,
    registrationClosesAt: s.registration_closes_at,
  }));
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
