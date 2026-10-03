import { ImageResponse } from "next/og";
import { getContentSource } from "@/content/source";

export const alt = "Site preview";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const settings = await (await getContentSource()).getSiteSettings();
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: 80,
        background: "#0b0d12",
        color: "#ffffff",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ fontSize: 96, fontWeight: 700, lineHeight: 1.1 }}>{settings.name}</div>
      <div style={{ marginTop: 32, fontSize: 40, lineHeight: 1.3, color: "#a8b0c0" }}>
        {settings.description}
      </div>
    </div>,
    { ...size },
  );
}
