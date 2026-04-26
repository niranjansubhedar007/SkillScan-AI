// app/api/chat/route.js
import { NextResponse } from 'next/server';
import { extractText, getDocumentProxy } from 'unpdf';
import { chunkAndStoreResume, searchRelevantChunks } from './chunkResume';

async function makeCollectionName(fileName, buffer) {
  const base = fileName.replace(/\.[^/.]+$/, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').substring(0, 20).replace(/^_|_$/g, '');
  // Deterministic 8-char hash of file content — same file = same collection
  const hashBuf = await crypto.subtle.digest('SHA-256', buffer);
  const hashHex = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 8);
  return `resume_${base}_${hashHex}`;
}

// MAIN API HANDLER
export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("resume");
    const skill = formData.get("message");

    if (!file) {
      return NextResponse.json({ reply: "Please upload a resume file" });
    }

    if (!skill || !skill.trim()) {
      return NextResponse.json({ reply: "Please enter a skill to search for" });
    }

    // Extract text from file
    let resumeText;
    const buffer = Buffer.from(await file.arrayBuffer());

    if (file.type === 'application/pdf') {
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const { text } = await extractText(pdf, { mergePages: true });
      resumeText = text;
    } else {
      resumeText = buffer.toString('utf-8');
    }


    if (!resumeText || resumeText.length < 10) {
      return NextResponse.json({ reply: "Could not read text from file" });
    }

    // Chunk resume and store embeddings in its own Qdrant collection
    const collectionName = await makeCollectionName(file.name, buffer);
    await chunkAndStoreResume(resumeText, collectionName);

    // Retrieve the most relevant chunks for the queried skill
    const relevantChunks = await searchRelevantChunks(skill.trim(), collectionName);
    const contextText = relevantChunks.join('\n\n');

    const systemPrompt = `You are a resume parsing assistant. Given a resume and a skill query, you must:
1. Check if the skill is mentioned or implied in the resume.
2. If found, extract the candidate's contact details (name, email, phone, LinkedIn, location) from the resume.
3. Return a JSON object with this exact shape:
{
  "skillFound": true or false,
  "contact": {
    "name": "...",
    "email": "...",
    "phone": "...",
    "linkedin": "...",
    "location": "...",
    "Skills": ["..."] // List of all skills found in the resume
  }
}
If a contact field is not found, use null for its value. If skillFound is false, contact should be null.
Return ONLY valid JSON. No extra text.`;

    const userPrompt = `Resume (relevant sections):\n${contextText}\n\nSkill to search: ${skill.trim()}`;

    const openAIResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
      }),
    });

    const data = await openAIResponse.json();
    const raw = data.choices?.[0]?.message?.content || '{"skillFound":false,"contact":null}';

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ reply: "Failed to parse AI response" });
    }

    return NextResponse.json({ ...parsed, collectionName });

  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ reply: `Error: ${error.message}` });
  }
}
