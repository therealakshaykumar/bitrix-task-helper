const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

const SYSTEM = `You help a software developer turn a Bitrix24 task into an actionable coding prompt.
Given the task title, description and comments, respond with ONLY a JSON object (no markdown fences):
{
  "summary": "2-4 sentence plain summary of what is being asked",
  "requirements": ["concise, testable requirement", ...],
  "open_questions": ["ambiguity or missing info worth confirming", ...],
  "prompt": "A ready-to-paste prompt for an AI coding assistant. State the goal, the requirements as a list, constraints/edge cases from the comments, and ask it to inspect the relevant code before changing anything."
}
Use only information in the task; do not invent requirements. Later comments override earlier ones.`;

export async function summarizeTask(task, extraContext = "") {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set in .env.local");

  const body =
    `Task #${task.id}: ${task.title}\nStatus: ${task.status}\nDeadline: ${task.deadline || "none"}\n\n` +
    `Description:\n${task.description || "(empty)"}\n\n` +
    `Comments (oldest first):\n` +
    (task.comments.map((c) => `[${c.date}] ${c.author}: ${c.text}`).join("\n") || "(none)") +
    (extraContext ? `\n\nExtra context from developer:\n${extraContext}` : "");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      system: SYSTEM,
      messages: [{ role: "user", content: body }],
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || "Anthropic HTTP " + res.status);

  const text = json.content.map((b) => b.text || "").join("").trim();
  const match = text.match(/\{[\s\S]*\}/);
  try {
    return JSON.parse(match ? match[0] : text);
  } catch {
    return { summary: text, requirements: [], open_questions: [], prompt: text };
  }
}
