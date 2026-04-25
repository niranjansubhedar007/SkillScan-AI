// app/api/ask/route.js
import { NextResponse } from 'next/server';
import { searchRelevantChunks } from '../chat/chunkResume';

export async function POST(req) {
  try {
    const { question, collectionNames } = await req.json();

    if (!question?.trim()) {
      return NextResponse.json({ answer: 'Please provide a question.' });
    }
    if (!collectionNames?.length) {
      return NextResponse.json({ answer: 'No resume selected. Please select at least one resume collection.' });
    }

    // Retrieve top chunks from every selected collection in parallel
    const chunkArrays = await Promise.all(
      collectionNames.map((name) => searchRelevantChunks(question.trim(), name, 5))
    );
    const contextText = chunkArrays.flat().join('\n\n');

    if (!contextText.trim()) {
      return NextResponse.json({ answer: 'Could not retrieve relevant context from the selected resume(s).' });
    }

    const systemPrompt = `You are an expert resume assistant. Answer the user's question using ONLY the resume content provided as context. 
Be concise, accurate, and helpful. If the answer is not present in the context, say so clearly.`;

    const userPrompt = `Resume context:\n${contextText}\n\nQuestion: ${question.trim()}`;

    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
      }),
    });

    const data = await openAIResponse.json();
    const answer = data.choices?.[0]?.message?.content || 'No answer generated.';

    return NextResponse.json({ answer });
  } catch (error) {
    console.error('Ask error:', error);
    return NextResponse.json({ answer: `Error: ${error.message}` });
  }
}
