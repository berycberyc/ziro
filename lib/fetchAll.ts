/**
 * Supabase/PostgREST қорғаныс шегі: бір сұраныста ең көп дегенде 1000 жол
 * қайтарады. Шектен асқан жолдар ҚАТЕСІЗ, үнсіз жоғалады — сондықтан
 * "барлығын алу" керек жерде әрқашан осы көмекшілерді қолдану керек.
 *
 * Қолданылуы:
 *   const rows = await fetchAll<MyRow>((from, to) =>
 *     supabase.from("questions").select("...").eq("session_id", id).order("id").range(from, to)
 *   );
 */

type QueryResult<T> = { data: T[] | null; error: { message?: string } | null };

const PAGE_SIZE = 1000;

/**
 * Сұранысты беттеп (paging) толық оқиды.
 *
 * МАҢЫЗДЫ: build ішінде міндетті түрде тұрақты .order(...) болуы керек,
 * әйтпесе беттер қабаттасып немесе жол түсіп қалуы мүмкін.
 */
export async function fetchAll<T = any>(
  build: (from: number, to: number) => PromiseLike<QueryResult<T>>,
  pageSize: number = PAGE_SIZE
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) throw error;
    const batch = data ?? [];
    all.push(...batch);
    if (batch.length < pageSize) break;
  }
  return all;
}

/**
 * .in("id", ids) түріндегі сұраныстарды бөліктеп орындайды.
 * Екі мәселені шешеді: 1000 жол шегі және тым ұзын URL.
 */
export async function fetchAllByIds<T = any>(
  ids: string[],
  build: (chunk: string[]) => PromiseLike<QueryResult<T>>,
  chunkSize: number = 300
): Promise<T[]> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return [];

  const all: T[] = [];
  for (let i = 0; i < unique.length; i += chunkSize) {
    const { data, error } = await build(unique.slice(i, i + chunkSize));
    if (error) throw error;
    all.push(...(data ?? []));
  }
  return all;
}
