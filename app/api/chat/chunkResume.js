import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { qdrant, ensureCollection } from './qdrantClient';

async function getEmbedding(text) {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: 'text-embedding-ada-002', input: text }),
  });
  const data = await response.json();
  return data.data[0].embedding;
}

export async function chunkAndStoreResume(resumeText, collectionName) {
  await ensureCollection(collectionName);

  // If collection already has vectors, skip re-embedding (same file uploaded again)
  const info = await qdrant.getCollection(collectionName);
  if (info.vectors_count > 0) {
    console.log(`Collection "${collectionName}" already has ${info.vectors_count} vectors — skipping re-embedding.`);
    return [];
  }

  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 50,
  });
  const chunks = await textSplitter.splitText(resumeText);

  const points = await Promise.all(
    chunks.map(async (chunk, i) => ({
      id: crypto.randomUUID(),
      vector: await getEmbedding(chunk),
      payload: { text: chunk, chunkIndex: i },
    }))
  );

  await qdrant.upsert(collectionName, { points });
  console.log(`Stored ${points.length} chunks in Qdrant collection "${collectionName}"`);
  return chunks;
}

export async function searchRelevantChunks(queryText, collectionName, topK = 5) {
  const queryVector = await getEmbedding(queryText);
  const results = await qdrant.search(collectionName, {
    vector: queryVector,
    limit: topK,
    with_payload: true,
  });
  return results.map((r) => r.payload.text);
}
