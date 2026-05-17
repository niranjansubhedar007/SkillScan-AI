// app/api/resume/route.js
// Returns the candidate profile + PDF (base64) + full text from a Qdrant collection
import { NextResponse } from 'next/server';
import { qdrant } from '../chat/qdrantClient';

const PROFILE_POINT_ID = '00000000-0000-0000-0000-000000000001';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const collectionName = searchParams.get('collection');

  if (!collectionName) {
    return NextResponse.json({ error: 'collection param required' }, { status: 400 });
  }

  try {
    // 1. Fetch the metadata/profile point by fixed ID
    let profile = null;
    let pdfBase64 = null;
    let fileName = null;
    let fileType = null;

    try {
      const points = await qdrant.retrieve(collectionName, {
        ids: [PROFILE_POINT_ID],
        with_payload: true,
        with_vector: false,
      });
      if (points.length > 0) {
        const p = points[0].payload;
        pdfBase64 = p.pdfBase64 ?? null;
        fileName  = p.fileName  ?? null;
        fileType  = p.fileType  ?? null;
        profile = {
          name:             p.name             ?? null,
          email:            p.email            ?? null,
          phone:            p.phone            ?? null,
          linkedin:         p.linkedin         ?? null,
          location:         p.location         ?? null,
          skills:           p.skills           ?? [],
          experience_years: p.experience_years ?? null,
          education:        p.education        ?? null,
          summary:          p.summary          ?? null,
          appliedAt:        p.appliedAt        ?? null,
        };
      }
    } catch {
      // profile point may not exist in older collections — fine
    }

    // 2. Scroll all text-chunk points and reconstruct full text
    let allPoints = [];
    let offset = null;
    do {
      const result = await qdrant.scroll(collectionName, {
        limit: 100,
        offset,
        with_payload: true,
        with_vector: false,
      });
      // Exclude the metadata point
      allPoints = allPoints.concat(
        result.points.filter((pt) => pt.id !== PROFILE_POINT_ID)
      );
      offset = result.next_page_offset ?? null;
    } while (offset !== null && offset !== undefined);

    allPoints.sort((a, b) => (a.payload.chunkIndex ?? 0) - (b.payload.chunkIndex ?? 0));
    const fullText = allPoints.map((p) => p.payload.text ?? '').join('\n');

    return NextResponse.json({ profile, pdfBase64, fileName, fileType, text: fullText, chunks: allPoints.length });
  } catch (error) {
    console.error('Resume fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
