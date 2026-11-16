import React from "react"
import ReactDOM from "react-dom/client"
import {
  CatChip,
  CatHead,
  LoungePose,
  RunPose,
  SitPose,
  SleepPose,
  Thread,
  YarnArt,
} from "./components/CatPoses"
import "./index.css"

const stageBg: React.CSSProperties = {
  background:
    "radial-gradient(circle at center, rgba(17,17,17,.09) 1px, transparent 1.5px) 0 0 / 24px 24px, #fbfaf7",
  border: "1px solid #E4E2DC",
  borderRadius: 12,
}

function Scene({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox="0 0 360 200" width="100%" style={stageBg} role="img" aria-label={label}>
        <line x1="0" y1="190.5" x2="360" y2="190.5" stroke="#E4E2DC" />
        {children}
      </svg>
      <figcaption style={{ font: "500 13px var(--font-sans)", marginTop: 6 }}>{label}</figcaption>
    </figure>
  )
}

function Gallery() {
  return (
    <div style={{ background: "#F7F6F3", minHeight: "100vh", padding: 24, color: "#111", fontFamily: "var(--font-sans)" }}>
      <h1 style={{ font: "600 18px var(--font-sans)", margin: "0 0 4px" }}>Mascot gallery (static, no animation)</h1>
      <p style={{ color: "#6B6862", font: "400 13px var(--font-sans)", margin: "0 0 20px" }}>
        Same head in every pose. Gradient only on the yarn.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(540px, 1fr))", gap: 20, maxWidth: 1000 }}>
        <Scene label="1  Idle: sitting beside tangled yarn">
          <Thread d="M284 178 C244 196 200 192 160 188" />
          <SitPose />
          <YarnArt kind="tangled" x={304} y={166} />
        </Scene>
        <Scene label="2  Thinking: head tilts, eyes look to the comment">
          <Thread d="M284 178 C244 196 200 192 160 188" />
          <SitPose thinking />
          <YarnArt kind="tangled" x={304} y={166} />
        </Scene>
        <Scene label="3  Running: toward the feedback comment">
          <Thread d="M284 170 C256 182 236 154 218 146" />
          <RunPose />
          <YarnArt kind="tangled" x={306} y={158} />
        </Scene>
        <Scene label="4  Untangling: eyes locked on the thread">
          <Thread d="M200 182 C232 194 252 186 280 176" />
          <LoungePose />
          <YarnArt kind="tangled" x={304} y={164} />
        </Scene>
        <Scene label="5  Sleeping: beside neatly wound yarn">
          <Thread d="M272 178 C250 192 232 194 214 191" />
          <SleepPose />
          <YarnArt kind="wound" x={296} y={168} />
        </Scene>
      </div>

      <h2 style={{ font: "500 14px var(--font-sans)", margin: "28px 0 10px" }}>Header icon at 56, 40 and 28px</h2>
      <div style={{ display: "flex", alignItems: "center", gap: 24, background: "#fff", border: "1px solid #E4E2DC", borderRadius: 12, padding: 16, maxWidth: 480 }}>
        <CatChip size={56} />
        <CatChip size={40} />
        <CatChip size={28} />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <CatChip size={40} />
          <div>
            <div style={{ font: "600 14px var(--font-sans)" }}>Vague Comments Decoder</div>
            <div style={{ font: "400 12px var(--font-sans)", color: "#6B6862" }}>Read between the lines</div>
          </div>
        </div>
      </div>

      <h2 style={{ font: "500 14px var(--font-sans)", margin: "28px 0 10px" }}>Head close-up</h2>
      <svg viewBox="-40 -52 96 90" width={260} style={{ background: "#fff", border: "1px solid #E4E2DC", borderRadius: 12 }}>
        <CatHead look={[2, 1]} />
      </svg>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById("root")!).render(<Gallery />)
