import { QdrantClient } from '@qdrant/js-client-rest';

const COLLECTION_NAME = 'chunks';
const VECTOR_SIZE = 1536; // text-embedding-ada-002 output size

const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
});

const { collections } = await qdrant.getCollections();
const exists = collections.some((c) => c.name === COLLECTION_NAME);

if (exists) {
  console.log(`Collection "${COLLECTION_NAME}" already exists.`);
} else {
  await qdrant.createCollection(COLLECTION_NAME, {
    vectors: { size: VECTOR_SIZE, distance: 'Cosine' },
  });
  console.log(`Collection "${COLLECTION_NAME}" created successfully.`);
}
