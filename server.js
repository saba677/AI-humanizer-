import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.post('/api/humanize', async (req, res) => {
    try {
        const { text } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }

        // Word count limit check (500 words max)
        const wordCount = text.trim().split(/\s+/).length;
        if (wordCount > 500) {
            return res.status(400).json({ error: 'Text exceeds the 500-word limit. Please shorten it.' });
        }

        // 1. Preserve technical tokens / code strings
        const protectedTokens = [];
        let placeholderText = text.replace(/`[^`]+`|(https?:\/\/[^\s]+)|\b\d+(?:\.\d+)?%?\b/g, (match) => {
            protectedTokens.push(match);
            return `__PROTECTED_TOKEN_${protectedTokens.length - 1}__`;
        });

        // 2. ULTRA-HUMAN SYSTEM PROMPT FOR 100% SCORE
        const systemPrompt = `You are an expert native human writer and professional editor specializing in bypassing AI content detectors (ZeroGPT, GPTZero, CopyLeaks) with 100% human score.

YOUR MANDATE: Rewrite the text to sound completely organic, human, and authentic while retaining the exact core message and technical facts.

STRICT HUMANIZATION LAWS (100% HUMAN SCORE):
1. BANNED AI WORDS (NEVER USE):
   Do NOT use words like: 'furthermore', 'consequently', 'imperative', 'paradigm shift', 'leveraging', 'delving', 'testament', 'in conclusion', 'moreover', 'pivotal', 'crucial', 'utilize', 'exponential growth', 'fostering', 'seamless', 'holistic', 'tapestry', 'realm'.

2. EXTREME BURSTINESS (SENTENCE LENGTH DIVERSITY):
   - Mix ultra-short sentences (3-6 words) with medium and long sentences.
   - Start sentences with conjunctions like "And", "But", "So" naturally.
   - Use occasional rhetorical questions or natural transitions.

3. HIGH PERPLEXITY (NATURAL HUMAN EXPRESSIONS):
   - Reframe sentences into direct active voice.
   - Use natural human phrasing, contractions (don't, it's, they're), and realistic phrasing instead of formal academic textbook structure.
   - Avoid monotonous Subject-Verb-Object repeating templates.

4. PRESERVE PLACEHOLDERS:
   - Do NOT alter or translate tags like __PROTECTED_TOKEN_X__. Keep them as-is.

Output ONLY the rewritten humanized version without any extra conversational introductory notes like "Here is your text".`;

        const apiKey = process.env.NVIDIA_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'NVIDIA_API_KEY is missing in .env file' });
        }

        // 3. Request to NVIDIA NIM API
        const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey.trim()}`
            },
            body: JSON.stringify({
                model: 'meta/llama-3.1-8b-instruct',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: placeholderText }
                ],
                temperature: 0.95, // Higher creativity for high perplexity
                top_p: 0.90,
                max_tokens: 2048
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('NVIDIA Error Response:', JSON.stringify(data, null, 2));
            return res.status(500).json({ error: data.error?.message || 'NVIDIA API Request Failed' });
        }

        let humanizedOutput = data?.choices?.[0]?.message?.content ?? null;

        if (!humanizedOutput) {
            return res.status(500).json({ error: 'NVIDIA API returned an empty response payload.' });
        }

        // 4. Restore Protected Tokens Safely
        if (protectedTokens.length > 0 && typeof humanizedOutput === 'string') {
            protectedTokens.forEach((token, index) => {
                const tokenPlaceholder = `__PROTECTED_TOKEN_${index}__`;
                if (humanizedOutput.includes(tokenPlaceholder)) {
                    humanizedOutput = humanizedOutput.replaceAll(tokenPlaceholder, token);
                }
            });
        }

        res.json({
            success: true,
            result: humanizedOutput,
            protectedCount: protectedTokens.length
        });

    } catch (error) {
        console.error('Server Error:', error);
        res.status(500).json({ error: error.message || 'Internal server execution error' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});