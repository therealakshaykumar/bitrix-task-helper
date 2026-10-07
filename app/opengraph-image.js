import { ImageResponse } from "next/og";

export const alt = "Bitrix Task Helper";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center",
          padding: 80, background: "linear-gradient(135deg,#1d4ed8,#2563eb 55%,#3b82f6)", color: "#fff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ width: 96, height: 96, borderRadius: 24, background: "#fff", color: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 64, fontWeight: 800 }}>B</div>
          <div style={{ fontSize: 64, fontWeight: 800 }}>Bitrix Task Helper</div>
        </div>
        <div style={{ marginTop: 40, fontSize: 38, lineHeight: 1.3, opacity: 0.92, maxWidth: 900 }}>
          Summarize Bitrix24 tasks and turn them into ready-to-use AI coding prompts.
        </div>
      </div>
    ),
    size
  );
}
