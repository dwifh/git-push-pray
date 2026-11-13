// Server-only. Vectors and their model come from `npm run seed` (scripts/seed-knowledge.mjs).
// Callers pass **redacted** text only. Any failure → [] (no matches), never throws.
import vectors from '../../data/knowledge-vectors.json' with { type: 'json' };

type Chunk = { id: string; title: string; text: string; institution: string; source: string; embedding: number[] };
type Kb = { model: string; chunks: Chunk[] };
export type RagMatch = { id: string; title: string; text: string; institution: string; score: number };

function cosine(a: number[], b: number[]) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na * nb) || 1);
}

export async function searchKnowledgeBase(
  query: string,
  k = 3,
  { fetch: f = fetch, kb = vectors as Kb, timeoutMs = 3000 }: { fetch?: typeof fetch; kb?: Kb; timeoutMs?: number } = {},
): Promise<RagMatch[]> {
  try {
    const res = await f('https://openrouter.ai/api/v1/embeddings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: kb.model, input: query.slice(0, 2000) }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return [];
    const q: number[] = (await res.json()).data[0].embedding;
    return kb.chunks
      .map((c) => ({ id: c.id, title: c.title, text: c.text, institution: c.institution, score: +cosine(q, c.embedding).toFixed(3) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  } catch {
    return [];
  }
}
