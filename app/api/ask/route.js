// app/api/ask/route.js
import { NextResponse } from 'next/server';
import { searchRelevantChunks } from '../chat/chunkResume';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { tool } from '@langchain/core/tools';
import { HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import { cosineSimilarity } from '@langchain/core/utils/math';
import { z } from 'zod';
import nodemailer from 'nodemailer';

// ── job-fit detection ────────────────────────────────────────────────────────
const JOB_FIT_PATTERN = /good\s*fit|fit\s*for\s*(the\s*)?role|match.*job|job.*match|suitable\s*for|role\s*match|how\s*suited|percent.*match|match.*percent/i;

async function fetchJobDescs() {
  const DOC_ID = process.env.DOC_ID;
  const EXPORT_URL = `https://docs.google.com/document/d/${DOC_ID}/export?format=txt`;
  const docRes = await fetch(EXPORT_URL);
  if (!docRes.ok) throw new Error('Failed to fetch job descriptions from Google Docs');
  const raw = await docRes.text();

  // Parse each JD block — supports both simple `text: "..."` and structured fields
  const blocks = raw.split(/\n(?=\s*id:)/i).filter(Boolean);

  const jobDescs = blocks.map((block, i) => {
    const get = (field) => {
      const m = block.match(new RegExp(`${field}:\\s*"([^"]*)"`,'i'));
      return m ? m[1].replace(/\s*\n\s*/g, ' ').trim() : null;
    };
    return {
      id: i + 1,
      role: get('role'),
      company: get('company'),
      location: get('location'),
      type: get('type'),
      text: get('text') || block.replace(/\s*\n\s*/g, ' ').trim(),
    };
  }).filter((j) => j.text);

  if (jobDescs.length === 0) throw new Error('No job descriptions found in Google Docs');
  return jobDescs;
}

async function fetchCompanyName() {
  const DOC_ID = process.env.DOC_ID;
  const EXPORT_URL = `https://docs.google.com/document/d/${DOC_ID}/export?format=txt`;
  const docRes = await fetch(EXPORT_URL);
  if (!docRes.ok) return 'Our Company';
  const raw = await docRes.text();
  const m = raw.match(/company_name:\s*"([^"]*)"/i);
  return m ? m[1].trim() : 'Our Company';
}

async function computeJobFit(contextText) {
  const jobDescs = await fetchJobDescs();

  const embeddings = new OpenAIEmbeddings({
    model: 'text-embedding-3-large',
    apiKey: process.env.OPENAI_API_KEY,
  });

  const [resumeVec, jdVecs] = await Promise.all([
    embeddings.embedQuery(contextText),
    embeddings.embedDocuments(jobDescs.map((j) => j.text)),
  ]);

  const scores = cosineSimilarity([resumeVec], jdVecs)[0];
  const THRESHOLD = 0.62;
  const maxScore = Math.max(...scores);
  const absoluteMultiplier = Math.pow(Math.min(1, maxScore / THRESHOLD), 2);

  return jobDescs.map((job, i) => {
    const relative = maxScore > 0 ? scores[i] / maxScore : 0;
    const percent = Math.round(Math.pow(relative, 2) * absoluteMultiplier * 100);
    return { id: job.id, role: job.role, company: job.company, location: job.location, type: job.type, text: job.text, percent };
  });
}

function createSendEmailTool(companyName) {
  return tool(
    async ({ to, subject, body }) => {
      // Extract bare email address in case LLM sends "Name <email>" format
      const emailMatch = to.match(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
      const recipient = emailMatch ? emailMatch[0] : null;

      if (!recipient) {
        return `Could not find a valid email address in the resume. The value provided was: "${to}". Please ensure the resume contains a valid email address.`;
      }

      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      try {
        await transporter.sendMail({
          from: `"${companyName}" <${process.env.EMAIL_USER}>`,
          to: recipient,
          subject,
          text: body,
        });
      } catch (err) {
        return `Failed to send email to ${recipient}: ${err.message}`;
      }

      return `Email successfully sent to ${recipient} with subject "${subject}".`;
    },
    {
      name: 'send_email',
      description:
        'Send an email to a candidate. Use this when the user asks to email, contact, or reach out to someone. Extract the recipient email address from the resume context.',
      schema: z.object({
        to: z.string().describe('Recipient email address extracted from the resume. Can be a bare email or "Name <email>" format.'),
        subject: z.string().describe('Concise email subject line'),
        body: z.string().describe('Full email body text'),
      }),
    }
  );
}

// ── route handler ────────────────────────────────────────────────────────────
export async function POST(req) {
  try {
    const { question, collectionNames } = await req.json();

    if (!question?.trim()) {
      return NextResponse.json({ answer: 'Please provide a question.' });
    }
    if (!collectionNames?.length) {
      return NextResponse.json({ answer: 'No resume selected. Please select at least one resume collection.' });
    }

    // For broad listing questions (projects, skills, experience, education),
    // fetch more chunks to ensure all entities are captured.
    const broadListingPattern = /\b(project|skill|experience|education|work|employ|certif|achiev|tool|technolog)/i;
    const topK = broadListingPattern.test(question.trim()) ? 30 : 12;

    // Retrieve top chunks from every selected collection in parallel
    const chunkArrays = await Promise.all(
      collectionNames.map((name) => searchRelevantChunks(question.trim(), name, topK))
    );
    const contextText = chunkArrays.flat().join('\n\n');

    if (!contextText.trim()) {
      return NextResponse.json({ answer: 'Could not retrieve relevant context from the selected resume(s).' });
    }

    // ── Job-fit shortcut: skip LLM, return percentage scores ─────────────────
    if (JOB_FIT_PATTERN.test(question.trim())) {
      try {
        const results = await computeJobFit(contextText);
        const best = results.reduce((a, b) => (a.percent >= b.percent ? a : b));
        const label =
          best.percent >= 70 ? 'Strong Fit' : best.percent >= 45 ? 'Moderate Fit' : 'Weak Fit';
        const answer = `Job Fit Score: ${best.percent}% (${label})\n\nBased on matching the resume against all job descriptions, the highest match is ${best.percent}% for Job Description ${best.id}.`;
        return NextResponse.json({ answer, toolCallEvents: [] });
      } catch (e) {
        return NextResponse.json({ answer: `Could not compute job fit: ${e.message}`, toolCallEvents: [] });
      }
    }

    const llm = new ChatOpenAI({
      model: 'gpt-4o-mini',
      temperature: 0.8,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    const companyName = await fetchCompanyName().catch(() => 'Our Company');
    const sendEmailTool = createSendEmailTool(companyName);
    const tools = [sendEmailTool];
    const toolsByName = { send_email: sendEmailTool };

    const llmWithTools = llm.bindTools(tools);

    // If the question involves sending an email, fetch JDs + compute fit scores
    const EMAIL_PATTERN = /send.*email|email.*candidate|contact.*candidate|reach.*out|mail.*them/i;
    let jobDescContext = '';
    if (EMAIL_PATTERN.test(question.trim())) {
      try {
        const fitResults = await computeJobFit(contextText);
        jobDescContext = '\n\nJob Descriptions with match scores (use these to decide shortlist or rejection):\n' +
          fitResults.map((j) => {
            return [
              `Role: ${j.role || `JD ${j.id}`}`,
              j.company ? `Company: ${j.company}` : null,
              j.location ? `Location: ${j.location}` : null,
              j.type ? `Type: ${j.type}` : null,
              `Match Score: ${j.percent}%`,
              `Requirements: ${j.text}`,
            ].filter(Boolean).join(' | ');
          }).join('\n\n');
      } catch { /* proceed without JDs if fetch fails */ }
    }

    const systemPrompt = `You are an expert resume analyst. Answer the user's question using ONLY the resume content provided as context.
Be thorough — scan the ENTIRE context carefully before answering. For questions about projects, experience, skills, education, or employment history, extract EVERY item present — do NOT stop after finding one. List all of them.

IMPORTANT FORMATTING RULES:
- Do NOT use markdown. Do not use asterisks (*), double asterisks (**), pound signs (#), or any other markdown syntax.
- Do not bold anything. Write in plain text only.
- When listing projects, list EVERY project found in the context. Start each with the exact project name followed by a colon, then its tech stack and description.
- When listing companies or employers, ALWAYS include the company name, role/title, and dates if available.
- When listing skills or technologies, group them clearly using plain labels like "Frontend:", "Backend:", etc.
- Never omit proper names (project names, company names, tool names) — always quote them exactly as they appear in the resume.
- Never truncate the list — if there are 3 projects, list all 3; if there are 5, list all 5.

EMAIL RULES (only when sending an email):
You are acting as a professional HR representative composing an official recruitment email.
Steps you must follow:
1. Extract the candidate's name and email address from the resume context.
2. Review the job descriptions and their match scores provided.
3. Based on the scores, decide on your own whether the candidate is suitable or not — do not ask for confirmation.
4. Compose a complete, professional HR email:
   - Write a proper subject line relevant to the decision (shortlisting or rejection).
   - Address the candidate by their name.
   - Write in a formal, respectful HR tone.
   - For shortlisting: mention the specific role(s), company name, and location they matched. Express genuine interest and invite them for next steps (interview/call).
   - For rejection: thank them warmly, inform them they are not being moved forward at this time, encourage future applications, wish them success.
   - Sign off as: HR Team, ${companyName}
5. Do NOT use placeholder text like [Your Name], [Company], [Position] — write the complete email using only actual data from the resume and job descriptions.
6. Use ONLY the job descriptions provided. Do NOT invent roles or requirements.

If a piece of information is not found anywhere in the context, say so clearly. Do not guess or fabricate details.
You have access to a send_email tool. Use it when the user asks to send an email or contact a candidate — extract the email address from the resume context.`;

    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage(`Resume context:\n${contextText}${jobDescContext}\n\nQuestion: ${question.trim()}`),
    ];

    // Agentic loop — max 5 iterations to prevent runaway loops
    const toolCallEvents = [];
    const sentEmailKeys = new Set(); // dedup tracker

    for (let i = 0; i < 5; i++) {
      const response = await llmWithTools.invoke(messages);
      messages.push(response);

      if (!response.tool_calls || response.tool_calls.length === 0) {
        // Final text answer — strip all markdown symbols before returning
        const raw = response.content || 'No answer generated.';
        const clean = raw
          .replace(/\*\*/g, '')
          .replace(/\*/g, '')
          .replace(/^#{1,6} /gm, '')
          .replace(/_([^_]+)_/g, '$1');
        return NextResponse.json({
          answer: clean,
          toolCallEvents,
        });
      }

      // Execute each tool call
      let breakLoop = false;
      for (const tc of response.tool_calls) {
        const toolFn = toolsByName[tc.name];
        let result;
        if (toolFn) {
          // Deduplicate send_email calls with the same recipient + subject
          if (tc.name === 'send_email') {
            const emailMatch = (tc.args.to || '').match(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
            const recipient = emailMatch ? emailMatch[0] : tc.args.to;
            const dedupKey = `${recipient}::${tc.args.subject}`;
            if (sentEmailKeys.has(dedupKey)) {
              // Already sent — skip silently, no more retries
              breakLoop = true;
              break;
            }
            sentEmailKeys.add(dedupKey);
          }
          result = await toolFn.invoke(tc.args);
        } else {
          result = `Tool "${tc.name}" not found.`;
        }

        toolCallEvents.push({ tool: tc.name, args: tc.args, result });
        messages.push(new ToolMessage({ tool_call_id: tc.id, content: result }));

        // Stop retrying if the tool reported an error (no valid email, send failure, etc.)
        if (tc.name === 'send_email' && (result.startsWith('Could not find') || result.startsWith('Failed to send'))) {
          breakLoop = true;
          break;
        }
      }

      if (breakLoop) {
        const lastEvent = toolCallEvents[toolCallEvents.length - 1];
        return NextResponse.json({ answer: lastEvent?.result || 'Could not complete the action.', toolCallEvents });
      }
    }

    return NextResponse.json({ answer: 'Agent loop exceeded maximum iterations.', toolCallEvents });
  } catch (error) {
    console.error('Ask error:', error);
    return NextResponse.json({ answer: `Error: ${error.message}`, toolCallEvents: [] });
  }
}
