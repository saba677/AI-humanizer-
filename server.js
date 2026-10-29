import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

const API_KEY = process.env.GROQ_API_KEY || process.env.API_KEY;

let cachedModel = null;

// ---------- Bulletproof Model Selector (Excludes Specialized/Slashed Models) ----------
async function discoverWorkingModel() {
  if (cachedModel) return cachedModel;
  if (!API_KEY) throw new Error('GROQ_API_KEY missing in .env file!');

  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${API_KEY}` }
    });

    if (!res.ok) throw new Error(`Status ${res.status}`);

    const data = await res.json();
    const available = (data.data || []).map(m => m.id);

    // Filter out models with slashes (e.g. canopylabs/...), whisper, guard, distil
    const standardLLMs = available.filter(id => 
      !id.includes('/') &&
      !id.toLowerCase().includes('whisper') && 
      !id.toLowerCase().includes('guard') && 
      !id.toLowerCase().includes('distil') &&
      !id.toLowerCase().includes('tool')
    );

    const candidates = [
      'llama-3.1-8b-instant',
      'llama-3.3-70b-versatile',
      'llama3-8b-8192',
      'mixtral-8x7b-32768'
    ];

    cachedModel = candidates.find(id => standardLLMs.includes(id)) || standardLLMs[0] || 'llama-3.1-8b-instant';
    console.log(`🤖 Selected Clean Text Model: ${cachedModel}`);
    return cachedModel;
  } catch (err) {
    console.warn('⚠ Fallback model active:', err.message);
    return 'llama-3.1-8b-instant';
  }
}

// ---------- DEEP PLAGIARISM & AI BYPASS SYSTEM PROMPT ----------
const SYSTEM_PROMPT = `You are an expert human writer and paraphraser. Your task is to completely rewrite the given text to eliminate BOTH AI detection AND Turnitin database plagiarism (matching percentage).

STRICT RULES:
1. DEEP RESTRUCTURING: Change sentence structures, active/passive phrasing, and clause orders so no exact phrase matches existing papers.
2. ZERO 3-ITEM LISTS (TRIADS): Never write "A, B, and C". Split them into separate sentences or two-item pairings.
3. EXTREME BURSTINESS: Mix short statements with longer explanations.
4. ZERO AI/CLICHÉ VOCABULARY: Avoid "pivotal role", "furthermore", "moreover", "consequently", "ultimately", "environmental stewardship", "critical priority".
5. PRESERVE MEANING & LENGTH: Retain all original facts, figures, and word count.

Output ONLY the rewritten text.`;

// ---------- Call Groq API with Retry ----------
async function callGroqAPI(text, retries = 2) {
  const selectedModel = await discoverWorkingModel();

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
          model: selectedModel,
          temperature: 0.95,
          top_p: 0.92,
          max_tokens: 1200,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: `Paraphrase this text deeply to remove Turnitin matches and AI patterns while keeping full details:\n\n${text}` }
          ]
        })
      });

      const data = await response.json();
      if (response.ok) {
        return data.choices?.[0]?.message?.content?.trim() || '';
      }

      if (response.status === 429 && attempt < retries) {
        await new Promise(res => setTimeout(res, 1500));
        continue;
      }

      throw new Error(data?.error?.message || `Groq Error (${response.status})`);
    } catch (err) {
      if (attempt === retries) throw err;
    }
  }
}

// ---------- Deterministic Post-Processor ----------
function postProcess(text) {
  if (!text) return '';

  let cleaned = text;

  cleaned = cleaned
    .replace(/\bIn conclusion,?\s*/gi, '')
    .replace(/\bFurthermore,?\s*/gi, 'Additionally, ')
    .replace(/\bMoreover,?\s*/gi, 'What is more, ')
    .replace(/\bConsequently,?\s*/gi, 'As an outcome, ')
    .replace(/\bHowever,?\s*/gi, 'Still, ')
    .replace(/\bTherefore,?\s*/gi, 'As a result, ');

  // Break standard 3-item list structures
  cleaned = cleaned.replace(/([^,.!]+),\s*([^,.!]+),\s*and\s+([^,.!]+)/g, '$1 along with $2. Plus, $3');

  return cleaned
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/ {2,}/g, ' ')
    .trim();
}

// ---------- Express API Route ----------
app.post('/api/humanize', async (req, res) => {
  try {
    const text = req.body.text || req.body.input || req.body.content || req.body.draft || req.body.prompt;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'No text provided.' });
    }

    const rawOutput = await callGroqAPI(text);
    const finalOutput = postProcess(rawOutput);

    return res.json({
      success: true,
      output: finalOutput,
      result: finalOutput,
      text: finalOutput,
      humanized: finalOutput
    });

  } catch (err) {
    console.error('❌ Endpoint Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});