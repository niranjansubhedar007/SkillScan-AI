// app/api/jobdescs/route.js
import { NextResponse } from 'next/server';

const DOC_ID = process.env.DOC_ID; // Google Doc ID containing job descriptions
const EXPORT_URL = `https://docs.google.com/document/d/${DOC_ID}/export?format=txt`;

export async function GET() {
  try {
    const res = await fetch(EXPORT_URL, { next: { revalidate: 60 } });
    if (!res.ok) throw new Error(`Failed to fetch doc: ${res.status}`);
    const raw = await res.text();

    // Extract each text: "..." value from the JS array in the doc
    const matches = [...raw.matchAll(/text:\s*"([\s\S]*?)"/g)];
    const jobDescs = matches.map((m, i) => ({
      id: i + 1,
      text: m[1].replace(/\s*\n\s*/g, ' ').trim(),
      number: [],
    }));

    if (jobDescs.length === 0) throw new Error('No job descriptions found in document');

    return NextResponse.json({ jobDescs });
  } catch (error) {
    console.error('jobdescs error:', error);
    return NextResponse.json({ jobDescs: [], error: error.message }, { status: 500 });
  }
}
