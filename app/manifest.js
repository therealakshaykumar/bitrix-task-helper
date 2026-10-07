import { SITE_DESC, SITE_NAME } from "@/lib/site";

export default function manifest() {
  return {
    name: SITE_NAME,
    short_name: "Task Helper",
    description: SITE_DESC,
    start_url: "/",
    display: "standalone",
    background_color: "#0e1217",
    theme_color: "#2563eb",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
