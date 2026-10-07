export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3100").replace(/\/+$/, "");
export const SITE_NAME = "Bitrix Task Helper";
export const SITE_DESC =
  "Review Bitrix24 tasks, summarize the requirement with Gemini and copy a ready-to-use AI coding prompt.";
// The app has no login of its own, so it is not indexable unless you opt in.
export const ALLOW_INDEXING = process.env.ALLOW_INDEXING === "true";
