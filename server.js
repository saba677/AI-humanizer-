import express from 'express';
import cors from 'cors';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize Groq client
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

// Advanced Post-Processor to strip AI signatures
function academicPostProcessor(text) {
    if (!text) return '';
    
    let processed = text
        .replace(/\bFurthermore,\b/gi, 'Additionally,')
        .replace(/\bMoreover,\b/gi, 'Besides that,')
        .replace(/\bIn conclusion,\b/gi, 'Ultimately,')
        .replace(/\bIt is important to note that\b/gi, 'Crucially,')
        .replace(/\bdelve into\b/gi, 'explore')
        .replace(/\btestament to\b/gi, 'clear sign of')
        .replace(/\bin today's fast-paced world\b/gi, 'currently')
        .replace(/\baforementioned\b/gi, 'this')
        .replace(/\bnot only ... but also\b/gi, 'both ... and');

    processed = processed.replace(/\s{2,}/g, ' ').trim();
    return processed;
}

// Humanizer API Endpoint
app.post('/api/humanize', async (req, res) => {
    try {
        const { text, mode = 'academic' } = req.body;

        if (!text || text.trim() === '') {
            return res.status(400).json({ error: 'Please provide text to humanize.' });
        }

        if (!process.env.GROQ_API_KEY) {
            return res.status(500).json({ error: 'Groq API key is missing in environment variables.' });
        }

        const systemPrompt = `You are an expert human academic researcher and writer. Your task is to rewrite the user's provided text so that it reads 100% naturally, mimicking organic human writing style.
CRITICAL INSTRUCTIONS:
1. Completely eliminate robotic transitions (e.g., "Furthermore", "Moreover", "In conclusion", "It is important to note").
2. Vary sentence lengths drastically: mix punchy, short sentences with longer, complex analytical thoughts.
3. Eliminate rigid patterns, predictable triads (lists of three balanced items), and cliché AI phrasing.
4. Maintain the exact academic depth, subject meaning, and technical accuracy, but completely randomize the syntax and phrasing flow to bypass AI detectors like Turnitin and StealthWriter.`;

        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Rewrite the following text to make it sound entirely human-written and undetectable by AI detectors:\n\n${text}` }
            ],
            model: 'llama-3.1-70b-versatile',
            temperature: 0.85,
            max_tokens: 2048,
            top_p: 0.92,
        });

        const rawOutput = chatCompletion.choices[0]?.message?.content || '';
        const finalHumanizedText = academicPostProcessor(rawOutput);

        res.json({ 
            success: true, 
            humanizedText: finalHumanizedText 
        });

    } catch (error) {
        console.error('Groq API Error:', error);
        res.status(500).json({ 
            error: 'Failed to humanize text. Please check your API key or try again later.',
            details: error.message 
        });
    }
});

// Start server
app.listen(port, () => {
    console.log(`AI Humanizer server running on port ${port}`);
});