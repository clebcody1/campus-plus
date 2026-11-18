import { ImageResponse } from "next/og";

export const alt = "Campus Plus — your campus community";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0B1F3A",
          fontFamily: "sans-serif",
        }}
      >
        <img
          src="https://campusplus.com.ng/icons/icon-512.png"
          width={180}
          height={180}
          style={{ borderRadius: 40 }}
          alt=""
        />
        <div
          style={{
            display: "flex",
            marginTop: 40,
            fontSize: 84,
            fontWeight: 800,
            color: "#ffffff",
            letterSpacing: -2,
          }}
        >
          Campus&nbsp;<span style={{ color: "#FF7900" }}>Plus</span>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 16,
            fontSize: 32,
            color: "rgba(255,255,255,0.72)",
          }}
        >
          Your campus. Your people. Your life.
        </div>
      </div>
    ),
    size
  );
}