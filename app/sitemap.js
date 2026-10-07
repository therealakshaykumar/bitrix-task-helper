import { ALLOW_INDEXING, SITE_URL } from "@/lib/site";

export default function sitemap() {
  return ALLOW_INDEXING ? [{ url: SITE_URL, changeFrequency: "monthly", priority: 1 }] : [];
}
