import React from "react";
import { AbsoluteFill } from "remotion";
import { fontFamily } from "../theme";
import { JobGuideScene } from "../v3/JobGuideScene";
import { blurIn, blurOut, caps, eInOut, Highlight, Icon, motionBlur, N, tw, useSec, useStage } from "./kit";

// S2 · GET A JOB (1.2 s): scale-contrast caps, an amber highlighter sweeps JOB, real gig cards burst out.
export const GETJOB_SEC = 1.2;

// Real listings from opportunities.html (pay and badges as the app shows them).
const GIGS = [
  { title: "Get Paid to Lift: Daily Cash as a Mover", pay: "$25.00 / hr", noId: true, dx: -560, dy: 230, r: -9 },
  { title: "Start Today $40/HR Handyman | Helper", pay: "$40.00 / hr", noId: false, dx: 540, dy: -230, r: 8 },
  { title: "Can You Lift Heavy Items? Earn Daily Cash", pay: "$22.00 / hr", noId: true, dx: 600, dy: 260, r: -6 },
];

const GigCard: React.FC<{ readonly g: (typeof GIGS)[number]; readonly scale: number }> = ({ g, scale }) => (
  <div
    style={{
      width: 380 * scale,
      padding: `${18 * scale}px ${20 * scale}px`,
      borderRadius: 18 * scale,
      background: "#FFFFFF",
      boxShadow: "0 18px 50px rgba(17,17,17,0.14), 0 0 0 1px rgba(17,17,17,0.05)",
      fontFamily,
    }}
  >
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 * scale, alignItems: "baseline" }}>
      <div style={{ fontSize: 19 * scale, fontWeight: 700, color: N.ink, letterSpacing: "-0.01em", lineHeight: 1.2 }}>{g.title}</div>
      <div style={{ fontSize: 19 * scale, fontWeight: 800, color: N.ink, whiteSpace: "nowrap" }}>{g.pay}</div>
    </div>
    <div style={{ display: "flex", gap: 8 * scale, marginTop: 12 * scale }}>
      <span style={{ background: N.amber, borderRadius: 999, padding: `${4 * scale}px ${12 * scale}px`, fontSize: 14 * scale, fontWeight: 700 }}>Cash</span>
      {g.noId ? (
        <span style={{ border: `2px solid #B9DEC6`, color: "#1E7B45", borderRadius: 999, padding: `${3 * scale}px ${10 * scale}px`, fontSize: 14 * scale, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 * scale }}>
          <Icon name="check" size={15 * scale} color="#1E7B45" /> No ID needed
        </span>
      ) : null}
    </div>
  </div>
);

export const GetJobScene: React.FC = () => {
  const s = useSec();
  const { reel, cx, cy } = useStage();
  const small = reel ? 84 : 76;
  const big = reel ? 300 : 280;
  const k = reel ? 0.9 : 1;
  const push = tw(s, 0.85, 1.2, eInOut);
  return (
    <AbsoluteFill style={{ background: N.bright, overflow: "hidden" }}>
      <AbsoluteFill style={{ scale: String(1 + s * 0.025 + push * 0.18), ...blurOut(s, 0.98, 0.22, 18) }}>
        {GIGS.map((g, i) => {
          const at = 0.55 + i * 0.07;
          const pos = (t: number): [number, number] => {
            const p = tw(t, at, at + 0.55);
            return [g.dx * (reel ? 0.55 : 1) * p, g.dy * (reel ? 1.9 : 1) * p];
          };
          const [x, y] = pos(s);
          const p = tw(s, at, at + 0.55);
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: cx + x,
                top: cy + y,
                translate: "-50% -50%",
                rotate: `${g.r * p}deg`,
                scale: String(0.6 + 0.4 * p),
                opacity: Math.min(1, p * 2.5),
                filter: `blur(${motionBlur(s, pos)}px)`,
              }}
            >
              <GigCard g={g} scale={k} />
            </div>
          );
        })}
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
          <div style={{ ...caps(small), ...blurIn(s, 0.05, 0.4) }}>Get a</div>
          <div style={{ ...caps(big), marginTop: small * 0.2, ...blurIn(s, 0.15, 0.45, 18) }}>
            <Highlight s={s} at={0.4} dur={0.4}>
              Job
            </Highlight>
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// S3 · The job guide (3.6 s): the round-3 take, retimed (4.6 s → 3.6 s), with the touch dot and streaming message;
// the phone enters tilted and settles flat, then drifts down and out.
export const GUIDE4_SEC = 3.6;

export const GuideScene: React.FC = () => {
  const s = useSec();
  const settle = tw(s, 0, 0.8);
  const exit = tw(s, 3.25, 3.6, eInOut);
  return (
    <AbsoluteFill style={{ background: N.bright, perspective: 2200 }}>
      <AbsoluteFill
        style={{
          transform: `rotateX(${(1 - settle) * 18}deg) rotateZ(${(1 - settle) * -6}deg)`,
          scale: String(0.9 + 0.1 * settle),
          opacity: Math.min(1, settle * 3) * (1 - exit),
          filter: `blur(${(1 - Math.min(1, settle * 2)) * 10 + exit * 12}px)`,
          translate: `0 ${exit * 140}px`,
        }}
      >
        <JobGuideScene speed={(138 / 30) / GUIDE4_SEC} touch stream />
      </AbsoluteFill>
      {/* Warm field rises underneath as the phone leaves, handing over to the split screen */}
      <AbsoluteFill style={{ background: N.warm, opacity: exit, pointerEvents: "none", mixBlendMode: "multiply" }} />
    </AbsoluteFill>
  );
};
