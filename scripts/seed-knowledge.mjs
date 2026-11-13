// Embeds data/knowledge-base.json into data/knowledge-vectors.json. Run: npm run seed
import { readFileSync, writeFileSync } from 'node:fs';

const EMBEDDING_MODEL = 'openai/text-embedding-3-small';
const chunks = JSON.parse(readFileSync('data/knowledge-base.json', 'utf8'));

const res = await fetch('https://openrouter.ai/api/v1/embeddings', {
  method: 'POST',
  headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: EMBEDDING_MODEL, input: chunks.map((c) => `${c.title}\n${c.text}`) }),
});
const data = await res.json();
if (!res.ok) throw new Error(`Embedding failed ${res.status}: ${JSON.stringify(data)}`);

const vectors = chunks.map((c, i) => ({ ...c, embedding: data.data.find((d) => d.index === i).embedding.map((x) => +x.toFixed(5)) }));
// rag.ts reads the model from here so queries are embedded the same way.
writeFileSync('data/knowledge-vectors.json', JSON.stringify({ model: EMBEDDING_MODEL, chunks: vectors }));
console.log(`Embedded ${vectors.length} chunks with ${EMBEDDING_MODEL}`);
