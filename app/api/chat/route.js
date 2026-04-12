const SYSTEM_INSTRUCTION = `You are a resume skill extraction expert. Your task is to carefully analyze the resume content provided and extract ALL skills, technologies, tools, and competencies mentioned in it. 

Rules:
1. ONLY extract skills from the RESUME CONTENT, not from the user's instruction message
2. Look for technical skills (programming languages, frameworks, libraries, tools)
3. Look for soft skills (leadership, communication, project management, etc.)
4. Look for domain-specific skills (data analysis, machine learning, cloud platforms, etc.)
5. Return ONLY a comma-separated list of unique skills
6. If no skills are found in the resume, respond with "No skills detected."
7. Do not add any extra text, explanations, or formatting to your response

Example output format: "Python, JavaScript, React, Node.js, Communication, Team Leadership"`;

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("resume");
    const message = formData.get("message");

    if (!file || !message) {
      return Response.json({ reply: "Please upload a resume and enter a message." });
    }

    const resumeText = await file.text();

    // Clean up the resume text (remove excessive whitespace)
    const cleanResumeText = resumeText.replace(/\s+/g, ' ').trim();

    // Create a clear prompt that separates resume content from user message
    const userPrompt = `RESUME CONTENT:
${cleanResumeText}

USER INSTRUCTION:
${message}

Please analyze the RESUME CONTENT above and extract all skills mentioned in it.`;

    const embeddingRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_INSTRUCTION },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.8, // Higher temperature for more creative responses
      }),
    });

    if (!embeddingRes.ok) {
      const errorData = await embeddingRes.json();
      console.error("OpenAI API Error:", errorData);
      return Response.json({ 
        reply: `API Error: ${errorData.error?.message || "Something went wrong"}` 
      });
    }

    const embeddingData = await embeddingRes.json();
    const reply = embeddingData.choices?.[0]?.message?.content || "No skills detected.";
    
    return Response.json({ reply });
  } catch (error) {
    console.error("Chat API error:", error);
    return Response.json({
      reply: `Error: ${error.message}`,
    });
  }
}