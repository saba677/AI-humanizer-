# Human Text Studio

An Express full-stack app that refines writing through a multi-model NVIDIA API pipeline while protecting facts, figures, technical vocabulary, URLs, code-like tokens, and the source's meaning.

## Start

1. Install Node.js 18+.
2. Run `npm install`.
3. Copy `.env.example` to `.env`, then add an NVIDIA API key from [build.nvidia.com](https://build.nvidia.com).
4. Double-click `start-app.bat` and open `http://localhost:3000`. Keep the command window open while using the app.

Alternatively, run `node server.js` (or `npm.cmd run dev`) in a terminal in this folder.

## Pipeline

The server cycles selected models through up to four passes:

1. Clarity and structure
2. Voice and flow
3. Technical integrity
4. Final fidelity edit

Every pass receives both the immutable original and the current draft. Prompts instruct the model to preserve technical terms, facts, numbers, scope, and uncertainty; detected tokens are explicitly locked. NVIDIA's hosted NIM chat endpoint is OpenAI-compatible, so the integration uses `POST https://integrate.api.nvidia.com/v1/chat/completions`.

The approach reflects revision at structural and sentence levels, clarity/coherence/consistency in copy editing, and concision without meaning loss. It does not claim to determine authorship or bypass AI-detection systems.
