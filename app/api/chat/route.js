// app/api/chat/route.js
import { NextResponse } from 'next/server';

const SYSTEM_INSTRUCTION = `You are a resume skill extraction expert. Extract ALL skills from the resume content.

Rules:
1. ONLY extract skills from the RESUME CONTENT
2. Look for technical skills, soft skills, and domain skills
3. Return ONLY a comma-separated list of unique skills
4. If no skills found, respond with "No skills detected."
5. No extra text or explanations

Example: "Python, JavaScript, React, Communication, Leadership"`;

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("resume");
    const message = formData.get("message");

    // Validation
    if (!file || !message) {
      return NextResponse.json({ 
        reply: "Please upload a resume and enter a message" 
      });
    }

    // Get text from file
    let resumeText;
    if (file.type === 'application/pdf') {
      // For PDF - convert buffer to string (basic extraction)
      const buffer = Buffer.from(await file.arrayBuffer());
      resumeText = buffer.toString('utf-8');
      // Clean up PDF binary garbage
      resumeText = resumeText.replace(/[^\x20-\x7E\n]/g, ' ').replace(/\s+/g, ' ');
    } else {
      // For TXT file
      resumeText = await file.text();
    }

    if (!resumeText || resumeText.length < 10) {
      return NextResponse.json({ 
        reply: "Could not read text from file. Please ensure it's not empty." 
      });
    }

    // Limit text length
    const limitedText = resumeText.substring(0, 8000);

    // Create prompt
    const userPrompt = `Resume Content:
${limitedText}

User Instruction: ${message}

Extract all skills from the resume above. Return only comma-separated skills.`;

    // Call OpenAI
    const openAIResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: SYSTEM_INSTRUCTION },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!openAIResponse.ok) {
      const error = await openAIResponse.json();
      return NextResponse.json({ 
        reply: `API Error: ${error.error?.message || "Something went wrong"}` 
      });
    }

    const data = await openAIResponse.json();
    const reply = data.choices?.[0]?.message?.content || "No skills detected.";
    
    return NextResponse.json({ reply });

  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ 
      reply: "Error processing request. Please try again." 
    });
  }
}