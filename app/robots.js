import { ALLOW_INDEXING, SITE_URL } from "@/lib/site";

export default function robots() {
  return ALLOW_INDEXING
    ? { rules: { userAgent: "*", allow: "/", disallow: "/api/" }, sitemap: `${SITE_URL}/sitemap.xml` }
    : { rules: { userAgent: "*", disallow: "/" } };
}
