// app/api/collections/route.js
import { NextResponse } from 'next/server';
import { qdrant } from '../chat/qdrantClient';

export async function GET() {
  try {
    const { collections } = await qdrant.getCollections();
    const resumeCollections = collections
      .filter((c) => c.name.startsWith('resume_'))
      .map((c) => ({ name: c.name }));
    return NextResponse.json({ collections: resumeCollections });
  } catch (error) {
    console.error('Collections error:', error);
    return NextResponse.json({ collections: [], error: error.message });
  }
}
