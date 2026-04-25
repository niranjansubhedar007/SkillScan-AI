import { QdrantClient } from '@qdrant/js-client-rest';

export const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
});

export const VECTOR_SIZE = 1536; // text-embedding-ada-002

export async function ensureCollection(collectionName) {
  const { collections } = await qdrant.getCollections();
  const exists = collections.some((c) => c.name === collectionName);
  if (!exists) {
    await qdrant.createCollection(collectionName, {
      vectors: { size: VECTOR_SIZE, distance: 'Cosine' },
    });
  }
}
