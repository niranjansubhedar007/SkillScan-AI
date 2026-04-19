// app/api/match/route.js
import { NextResponse } from 'next/server';
import { OpenAIEmbeddings } from '@langchain/openai';
import { cosineSimilarity } from '@langchain/core/utils/math';

export async function POST(req) {
  try {
    const { userQuery, resumeSkills, jobDescs } = await req.json();

    if (!resumeSkills || !Array.isArray(jobDescs) || jobDescs.length === 0) {
      return NextResponse.json({ matches: [] });
    }

    const embeddings = new OpenAIEmbeddings({
      model: 'text-embedding-3-large',
      apiKey: process.env.OPENAI_API_KEY,
    });

    const jdTexts = jobDescs.map((j) => j.text);

    // Combine the user's original search query with the extracted resume skills
    // so the embedding captures both intent and evidence
    const queryText = userQuery
      ? `Job requirement: ${userQuery}. Candidate skills: ${resumeSkills}`
      : resumeSkills;

    // Embed combined query and all JDs in parallel
    const [resumeEmbedding, jdEmbeddings] = await Promise.all([
      embeddings.embedQuery(queryText),
      embeddings.embedDocuments(jdTexts),
    ]);

    // cosineSimilarity returns a matrix [[score0, score1, ...]]
    const similarityMatrix = cosineSimilarity([resumeEmbedding], jdEmbeddings);
    const scores = similarityMatrix[0];

    // Problem with pure relative normalization: the best JD always gets 100%
    // even when nothing is a real match (e.g. "UI/UX Design" vs coding JDs).
    //
    // Fix: two-factor scoring
    //   1. Relative score  — how this JD ranks vs the best one (^2 power curve)
    //   2. Absolute factor — how strong the best match actually is
    //      (if max cosine < GOOD_MATCH_THRESHOLD, all scores are pulled down)
    //
    // GOOD_MATCH_THRESHOLD: cosine ≥ 0.62 means a genuinely relevant JD.
    // Below that the best match is weak, so scores stay low to reflect reality.

    const GOOD_MATCH_THRESHOLD = 0.62; // determined empirically by testing various queries and resumes against the jobDescs s
    const maxSimilarity = Math.max(...scores);
    const ratio = Math.min(1, maxSimilarity / GOOD_MATCH_THRESHOLD);
    const absoluteMultiplier = Math.pow(ratio, 2); // squashes weak absolute matches

    const matches = jobDescs.map((job, i) => {
      const similarity = scores[i];
      const relative = maxSimilarity > 0 ? similarity / maxSimilarity : 0;
      const score = Math.round(Math.pow(relative, 2) * absoluteMultiplier * 100);
      return { id: job.id, score, rawSimilarity: Math.round(similarity * 1000) / 1000 };
    });

    return NextResponse.json({ matches });
  } catch {
    return NextResponse.json({ matches: [] }, { status: 500 });
  }
}
