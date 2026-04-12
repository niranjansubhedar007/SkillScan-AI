// app/api/chat/route.js
import { NextResponse } from 'next/server';

// 1. PREDEFINED SKILLS DATABASE (You need this for embedding comparison)
const SKILLS_DATABASE = [
  // Programming Languages
  "Python", "JavaScript", "TypeScript", "Java", "C++", "C#", "Go", "Rust", "Ruby", "PHP", "Swift", "Kotlin",
  
  // Frameworks & Libraries
  "React", "Angular", "Vue.js", "Node.js", "Django", "Flask", "Spring Boot", "ASP.NET", "Express.js", "Next.js",
  "TensorFlow", "PyTorch", "Scikit-learn", "Pandas", "NumPy",
  
  // Databases
  "MySQL", "PostgreSQL", "MongoDB", "Redis", "Cassandra", "Oracle", "SQLite", "Firebase",
  
  // Cloud & DevOps
  "AWS", "Azure", "Google Cloud", "Docker", "Kubernetes", "Jenkins", "Git", "GitHub Actions", "Terraform",
  
  // Soft Skills
  "Communication", "Leadership", "Problem Solving", "Teamwork", "Time Management", "Critical Thinking",
  "Project Management", "Agile", "Scrum", "Adaptability", "Creativity", "Conflict Resolution",
  
  // Data Science & ML
  "Machine Learning", "Deep Learning", "Data Analysis", "Data Visualization", "Statistics", "NLP",
  "Computer Vision", "Big Data", "Hadoop", "Spark",
  
  // Cybersecurity
  "Network Security", "Penetration Testing", "Cryptography", "Risk Assessment", "Compliance", "ISO 27001"
];
const SYSTEM_INSTRUCTION = "You are a helpful assistant that extracts skills from resumes. Focus on identifying both technical and soft skills. Return only a comma-separated list of skills without any additional text.";
// 2. FUNCTION TO GET EMBEDDING FOR ANY TEXT
async function getEmbedding(text) {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text.substring(0, 8000), // Limit text length
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to get embedding");
  }

  const data = await response.json();
  return data.data[0].embedding;
}

// 3. FUNCTION TO CALCULATE COSINE SIMILARITY
function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magnitudeA += vecA[i] * vecA[i];
    magnitudeB += vecB[i] * vecB[i];
  }
  
  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);
  
  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  return dotProduct / (magnitudeA * magnitudeB);
}

// 4. FUNCTION TO CACHE SKILLS EMBEDDINGS (Run once and store)
let cachedSkillEmbeddings = null;

async function getSkillEmbeddings() {
  if (cachedSkillEmbeddings) return cachedSkillEmbeddings;
  
  console.log("🔄 Generating embeddings for all skills...");
  
  const embeddings = [];
  for (const skill of SKILLS_DATABASE) {
    const embedding = await getEmbedding(skill);
    embeddings.push({ skill, embedding });
  }
  
  cachedSkillEmbeddings = embeddings;
  console.log(`✅ Generated embeddings for ${embeddings.length} skills`);
  return embeddings;
}

// 5. FUNCTION TO EXTRACT SKILLS USING EMBEDDINGS
async function extractSkillsWithEmbeddings(resumeText, threshold = 0.75) {
  // Get embedding for the entire resume
  console.log("🔄 Getting embedding for resume...");
  const resumeEmbedding = await getEmbedding(resumeText);
  
  // Get all skill embeddings
  const skillEmbeddings = await getSkillEmbeddings();
  
  // Calculate similarity between resume and each skill
  console.log("🔄 Comparing resume with skills database...");
  const matchedSkills = [];
  
  for (const { skill, embedding } of skillEmbeddings) {
    const similarity = cosineSimilarity(resumeEmbedding, embedding);
    
    if (similarity > threshold) {
      matchedSkills.push({ skill, similarity: similarity.toFixed(3) });
    }
  }
  
  // Sort by similarity (highest first)
  matchedSkills.sort((a, b) => b.similarity - a.similarity);
  
  return matchedSkills;
}

// 6. MAIN API HANDLER
export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("resume");
    const message = formData.get("message");
    const method = formData.get("method") || "embeddings"; // 'embeddings' or 'chat'

    // Validation
    if (!file) {
      return NextResponse.json({ 
        reply: "Please upload a resume file" 
      });
    }

    // Extract text from file
    let resumeText;
    const buffer = Buffer.from(await file.arrayBuffer());
    
    if (file.type === 'application/pdf') {
      resumeText = buffer.toString('utf-8');
      resumeText = resumeText.replace(/[^\x20-\x7E\n]/g, ' ').replace(/\s+/g, ' ');
    } else {
      resumeText = await file.text();
    }

    if (!resumeText || resumeText.length < 10) {
      return NextResponse.json({ 
        reply: "Could not read text from file" 
      });
    }

    // Choose method based on user preference
    if (method === "embeddings") {
      // METHOD 1: Using Embeddings (Faster, Cheaper, No LLM needed)
      console.log("📊 Using Embeddings method");
      
      const matchedSkills = await extractSkillsWithEmbeddings(resumeText, 0.7);
      
      if (matchedSkills.length === 0) {
        return NextResponse.json({ 
          reply: "No skills detected.",
          method: "embeddings",
          details: { matchedCount: 0 }
        });
      }
      
      // Format the reply
      const skillsList = matchedSkills.map(s => s.skill).join(", ");
      const reply = skillsList;
      
      return NextResponse.json({ 
        reply,
        method: "embeddings",
        details: {
          matchedCount: matchedSkills.length,
          topMatches: matchedSkills.slice(0, 10)
        }
      });
      
    } else {
      // METHOD 2: Using Chat API (More accurate, understands context)
      console.log("🤖 Using Chat API method");
      
      const limitedText = resumeText.substring(0, 8000);
      const userPrompt = `Resume Content:\n${limitedText}\n\nUser Instruction: ${message}\n\nExtract all skills from the resume above. Return only comma-separated skills.`;
      
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
      
      const data = await openAIResponse.json();
      const reply = data.choices?.[0]?.message?.content || "No skills detected.";
      
      return NextResponse.json({ 
        reply,
        method: "chat"
      });
    }

  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ 
      reply: `Error: ${error.message}` 
    });
  }
}

