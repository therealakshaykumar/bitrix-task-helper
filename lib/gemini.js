import { TEMPLATES } from "./templates";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

const BASE_SYSTEM = `You help a software developer turn a Bitrix24 task into an actionable coding prompt.
Given the task title, description, comments and any attached screenshots, respond with ONLY a JSON object (no markdown fences):
{
  "summary": "2-4 sentence plain summary of what is being asked",
  "requirements": ["concise, testable requirement", ...],
  "open_questions": ["ambiguity or missing info worth confirming", ...],
  "prompt": "A ready-to-paste prompt for an AI coding assistant. State the goal, the requirements as a list, constraints/edge cases from the comments, and ask it to inspect the relevant code before changing anything."
}
Use only information in the task and images; do not invent requirements. Later comments override earlier ones.
If screenshots are attached, describe what they show (error text, UI state, values) where it matters for the requirement.`;

// images: [{ name, mime, data(base64) }]
export async function summarizeTask(task, { extraContext = "", projectContext = "", template = "general", images = [] } = {}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set in .env.local");

  const tpl = TEMPLATES[template] || TEMPLATES.general;
  const system =
    BASE_SYSTEM +
    `\n\nPrompt style: ${tpl.instructions}` +
    (projectContext
      ? `\n\nStanding project context (stack, repo, conventions). Reflect it in the generated prompt where relevant:\n${projectContext}`
      : "");

  const text =
    `Task #${task.id}: ${task.title}\nStatus: ${task.status}\nDeadline: ${task.deadline || "none"}\n\n` +
    `Description:\n${task.description || "(empty)"}\n\n` +
    `Comments (oldest first):\n` +
    (task.comments.map((c) => `[${c.date}] ${c.author}: ${c.text}`).join("\n") || "(none)") +
    (extraContext ? `\n\nExtra context from developer:\n${extraContext}` : "") +
    (images.length ? `\n\nAttached images, in order: ${images.map((i) => i.name).join(", ")}` : "");

  const parts = [{ text }, ...images.map((i) => ({ inlineData: { mimeType: i.mime, data: i.data } }))];

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts }],
        generationConfig: { responseMimeType: "application/json", maxOutputTokens: 4000 },
      }),
    }
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || "Gemini HTTP " + res.status);

  const out = (json.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").trim();
  if (!out) throw new Error("Gemini returned no content" + (json.promptFeedback?.blockReason ? ": " + json.promptFeedback.blockReason : ""));
  const match = out.match(/\{[\s\S]*\}/);
  try {
    return JSON.parse(match ? match[0] : out);
  } catch {
    return { summary: out, requirements: [], open_questions: [], prompt: out };
  }
}
