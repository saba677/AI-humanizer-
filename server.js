import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const MODEL = process.env.NVIDIA_MODEL || "meta/llama-3.1-8b-instruct";
const REQUEST_TIMEOUT_MS = 30_000;

app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

function protectedTokens(text) {
  const patterns = [/`[^`]+`/g, /https?:\/\/[^\s)]+/g, /\b\d+(?:\.\d+)?(?:%|ms|s|MB|GB|TB|x)?\b/g, /\b[A-Z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)+\b/g, /\b(?:API|SQL|JSON|HTTP|HTTPS|CPU|GPU|TLS|JWT|OAuth)\b/g];
  return [...new Set(patterns.flatMap((pattern) => text.match(pattern) || []))];
}

function providerError(status, body) {
  const detail = body?.error?.message || body?.detail || body?.message;
  if (status === 401 || status === 403) return "Your NVIDIA API key was rejected. Check NVIDIA_API_KEY in .env.";
  if (status === 404) return `The configured model (${MODEL}) is unavailable. Set NVIDIA_MODEL in .env to a model enabled for your NVIDIA account.`;
  if (status === 429) return "The NVIDIA API rate limit was reached. Please wait a moment and try again.";
  return detail || `The NVIDIA API returned HTTP ${status}.`;
}

async function refine(text, tone) {
  const tokens = protectedTokens(text);
  let response;
  try {
    response = await fetch(NVIDIA_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.35,
        max_tokens: Math.min(1800, Math.max(256, Math.ceil(text.length / 3))),
        messages: [
          { role: "system", content: "You are a careful editor. Return only the improved text; no title, notes, or markdown. Preserve every fact, name, number, URL, code token, and technical term. Do not add claims." },
          { role: "user", content: `Make this text ${tone}, clear, natural, and concise. Protected strings must remain unchanged: ${tokens.join(" | ") || "none"}.\n\nText:\n${text}` }
        ]
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
  } catch (error) {
    if (error.name === "TimeoutError") throw new Error("The AI provider took longer than 30 seconds. Please try again.");
    throw new Error(`Could not reach the AI provider: ${error.message}`);
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(providerError(response.status, body));
  const result = body?.choices?.[0]?.message?.content?.trim();
  if (!result) throw new Error("The AI provider returned an empty response. Please try again.");
  return { result, tokens };
}

app.post("/api/humanize", async (req, res) => {
  const { text, tone = "natural and professional" } = req.body || {};
  if (!process.env.NVIDIA_API_KEY) return res.status(500).json({ error: "NVIDIA_API_KEY is missing. Add it to the .env file, then restart the app." });
  if (typeof text !== "string" || text.trim().length < 8) return res.status(400).json({ error: "Enter at least 8 characters of text." });
  if (text.length > 25_000) return res.status(400).json({ error: "Please keep input below 25,000 characters." });
  try {
    const { result, tokens } = await refine(text.trim(), tone);
    res.json({ result, model: MODEL, protectedTokens: tokens });
  } catch (error) {
    res.status(502).json({ error: error.message || "The refinement request failed." });
  }
});

app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && "body" in error) return res.status(400).json({ error: "Invalid request data. Please refresh the page and try again." });
  res.status(500).json({ error: "Unexpected server error." });
});

app.listen(PORT, () => console.log(`Human Text Studio is running at http://localhost:${PORT}`));
