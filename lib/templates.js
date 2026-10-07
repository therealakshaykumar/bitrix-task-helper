// Shared by the UI (labels) and the server (instructions that shape the generated prompt).
export const TEMPLATES = {
  general: {
    label: "General",
    instructions: "Write a general-purpose implementation prompt.",
  },
  bug: {
    label: "Bug fix",
    instructions:
      "This is a bug fix. The prompt must state the observed vs expected behaviour, steps to reproduce (if known), likely areas to investigate, and ask the assistant to find the root cause before patching. Ask for a minimal fix and a regression check.",
  },
  feature: {
    label: "New feature",
    instructions:
      "This is a new feature. The prompt must state the user-facing goal, acceptance criteria, UI/data/API changes likely needed, edge cases, and ask the assistant to follow existing patterns in the codebase.",
  },
  refactor: {
    label: "Refactor",
    instructions:
      "This is a refactor. The prompt must stress that behaviour must not change, name what should be simplified or restructured, and ask for small reviewable steps.",
  },
  review: {
    label: "Code review",
    instructions:
      "The prompt should ask the assistant to review the relevant code/changes against this task's requirements, listing correctness issues, missed requirements and risks, most severe first. Do not ask it to modify code.",
  },
};
