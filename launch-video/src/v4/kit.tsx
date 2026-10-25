import React from "react";
import { Easing, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { fontFamily, ICON_FONT } from "../theme";

// Round 4 (docs/style_guide.md §10): everything is timed in continuous seconds, so each 60 fps frame is a
// distinct position; arrivals ease out, travel eases in-out, nothing pops, and every beat drifts.

export const N = {
  warm: "#F7F6F2",
  bright: "#FFFFFF",
  ink: "#111111",
  dark: "#111111",
  gray: "#737373",
  amber: "#FFD43B",
  amberDeep: "#E9A80F",
  tile: "#0D0F14",
  cream: "#F8F4EC",
};

export const eOut = Easing.bezier(0.16, 1, 0.3, 1);
export const eInOut = Easing.bezier(0.65, 0, 0.35, 1);
const clampOpts = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Seconds since the start of the current sequence. */
export const useSec = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return frame / fps;
};

/** The frame size and whether it's the 9:16 reel. */
export const useStage = () => {
  const { width: W, height: H } = useVideoConfig();
  return { W, H, reel: H > W, cx: W / 2, cy: H / 2 };
};

/** 0 → 1 between seconds a and b. */
export const tw = (s: number, a: number, b: number, easing = eOut) => interpolate(s, [a, b], [0, 1], { ...clampOpts, easing });

/** Blur-in: blur 8px, +12px rise and fade → sharp (0.4 s, ease-out). */
export const blurIn = (s: number, at: number, dur = 0.4, rise = 12, blur = 8): React.CSSProperties => {
  const t = tw(s, at, at + dur);
  return { opacity: t, filter: `blur(${(1 - t) * blur}px)`, translate: `0 ${(1 - t) * rise}px` };
};

/** Blur-out (0.25 s). */
export const blurOut = (s: number, at: number, dur = 0.25, blur = 14): React.CSSProperties => {
  const t = tw(s, at, at + dur, eInOut);
  return { opacity: 1 - t, filter: `blur(${t * blur}px)` };
};

/** Both envelopes on one element. */
export const inOut = (s: number, inAt: number, outAt: number, inDur = 0.4, outDur = 0.25): React.CSSProperties => {
  const a = tw(s, inAt, inAt + inDur);
  const b = tw(s, outAt, outAt + outDur, eInOut);
  return { opacity: a * (1 - b), filter: `blur(${(1 - a) * 8 + b * 14}px)`, translate: `0 ${(1 - a) * 12}px` };
};

/** Velocity-scaled blur (2–8 px) for anything moving fast; `pos` returns [x, y] at time s. */
export const motionBlur = (s: number, pos: (t: number) => [number, number]) => {
  const dt = 1 / 120;
  const [x0, y0] = pos(s - dt);
  const [x1, y1] = pos(s + dt);
  const speed = Math.hypot(x1 - x0, y1 - y0) / (2 * dt); // px/s
  return Math.min(8, Math.max(0, (speed - 1500) / 400));
};

/* ---------- Type ---------- */

export const caps = (size: number, color = N.ink): React.CSSProperties => ({
  fontFamily,
  fontWeight: 800,
  fontSize: size,
  letterSpacing: "-0.02em",
  lineHeight: 0.95,
  textTransform: "uppercase",
  color,
  whiteSpace: "nowrap",
});

export const statement = (size: number, color = N.ink): React.CSSProperties => ({
  fontFamily,
  fontWeight: 700,
  fontSize: size,
  letterSpacing: "-0.03em",
  lineHeight: 1.05,
  color,
  whiteSpace: "pre",
});

/** Type-on with a thick caret (~14 chars/s). The caret blinks twice at the end, then goes. */
export const TypeOn: React.FC<{ readonly text: string; readonly s: number; readonly at: number; readonly cps?: number; readonly caret?: string; readonly hideCaretAt?: number }> = ({
  text,
  s,
  at,
  cps = 14,
  caret = N.ink,
  hideCaretAt,
}) => {
  const n = Math.max(0, Math.min(text.length, Math.floor((s - at) * cps)));
  const done = at + text.length / cps;
  const end = hideCaretAt ?? done + 0.6;
  const blink = s < done || Math.floor((s - done) / 0.15) % 2 === 0;
  return (
    <>
      {text.slice(0, n)}
      <span style={{ display: "inline-block", width: "0.08em", height: "0.9em", marginLeft: "0.04em", translate: "0 0.1em", background: caret, opacity: s >= at && s < end && blink ? 1 : 0 }} />
    </>
  );
};

/** Amber highlighter that sweeps left → right behind a word (amber text on white fails contrast). */
export const Highlight: React.FC<{ readonly s: number; readonly at: number; readonly dur?: number; readonly children: React.ReactNode }> = ({ s, at, dur = 0.45, children }) => {
  const t = tw(s, at, at + dur, eInOut);
  return (
    <span
      style={{
        backgroundImage: `linear-gradient(${N.amber}, ${N.amber})`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${t * 100}% 78%`,
        backgroundPosition: "0 62%",
        padding: "0 0.06em",
        margin: "0 -0.06em",
      }}
    >
      {children}
    </span>
  );
};

/* ---------- Background ---------- */

/** Dot grid (style guide §9): gray dots on a 16px grid plus a few amber dots twinkling like map spots. */
export const DotGrid: React.FC<{ readonly s: number; readonly W: number; readonly H: number }> = ({ s, W, H }) => (
  <>
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage: "radial-gradient(circle, rgba(17,17,17,0.11) 1.3px, transparent 1.8px)",
        backgroundSize: "16px 16px",
        translate: `0 ${-s * 12}px`,
      }}
    />
    {Array.from({ length: 34 }).map((_, i) => {
      const x = Math.floor(random(`dx${i}`) * (W / 16)) * 16 + 8;
      const y = Math.floor(random(`dy${i}`) * (H / 16)) * 16 + 8 - s * 12;
      const tw2 = 0.5 + 0.5 * Math.sin(s * 3 + random(`dp${i}`) * 6.28);
      return <div key={i} style={{ position: "absolute", left: x - 3, top: y - 3, width: 6, height: 6, borderRadius: 3, background: N.amber, opacity: 0.35 + 0.65 * tw2 }} />;
    })}
  </>
);

/* ---------- Logo: the new N★ mark (assets/brand/northstar-mark.svg) on its dark tile ---------- */

export const NSMark: React.FC<{ readonly size: number; readonly style?: React.CSSProperties }> = ({ size, style }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.23,
      background: N.tile,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      boxShadow: `0 ${size * 0.1}px ${size * 0.3}px rgba(17,17,17,0.18)`,
      ...style,
    }}
  >
    <svg viewBox="236 40 1090 966" width={size * 0.66} height={size * 0.58}>
      <path fill={N.cream} d="M250 340 L752 737 L752 405 L881 493 L881 991 L381 597 L381 991 L250 905 Z" />
      <path
        fill="#F3B43C"
        d="M1062 55 C1072 150 1088 225 1120 250 C1152 282 1215 290 1310 300 C1215 310 1152 318 1120 350 C1088 375 1072 450 1062 548 C1052 450 1036 375 1004 350 C972 318 909 310 813 300 C909 290 972 282 1004 250 C1036 225 1052 150 1062 55 Z"
      />
    </svg>
  </div>
);

/* ---------- Touch dot: the phone version of the reference's gliding pointer ---------- */

export type Stop = { t: number; x: number; y: number; tap?: boolean };

/** Position along the stops: holds at each stop, glides (ease in-out, ≥0.35 s) to the next. */
export const touchPos = (stops: Stop[], s: number, glide = 0.4): [number, number] => {
  let p: [number, number] = [stops[0].x, stops[0].y];
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1];
    const b = stops[i];
    const start = b.t - glide;
    if (s <= start) break;
    const k = tw(s, start, b.t, eInOut);
    p = [a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k];
  }
  return p;
};

/** Draw the dot in the coordinate space it's placed in (app px inside a phone, or frame px). */
export const TouchDot: React.FC<{ readonly stops: Stop[]; readonly s: number; readonly from: number; readonly to: number; readonly size?: number }> = ({
  stops,
  s,
  from,
  to,
  size = 44,
}) => {
  const [x, y] = touchPos(stops, s);
  const blur = motionBlur(s, (t) => touchPos(stops, t)) * 0.6;
  const tapS = stops.filter((st) => st.tap).map((st) => st.t);
  const dip = tapS.reduce((acc, t) => acc + interpolate(s, [t - 0.02, t + 0.06, t + 0.22], [0, 1, 0], clampOpts), 0);
  const ring = tapS.map((t, i) => {
    const k = tw(s, t, t + 0.45);
    return s >= t && k < 1 ? (
      <div key={i} style={{ position: "absolute", left: x - size, top: y - size, width: size * 2, height: size * 2, borderRadius: "50%", border: "2px solid rgba(17,17,17,0.35)", scale: String(0.4 + k * 0.8), opacity: 1 - k }} />
    ) : null;
  });
  const vis = tw(s, from, from + 0.25) * (1 - tw(s, to - 0.25, to, eInOut));
  return (
    <>
      {ring}
      <div
        style={{
          position: "absolute",
          left: x - size / 2,
          top: y - size / 2,
          width: size,
          height: size,
          borderRadius: "50%",
          background: "rgba(17,17,17,0.22)",
          border: "3px solid rgba(255,255,255,0.95)",
          boxShadow: "0 4px 14px rgba(17,17,17,0.25)",
          scale: String(1 - 0.1 * Math.min(1, dip)),
          opacity: vis,
          filter: `blur(${blur}px)`,
          pointerEvents: "none",
        }}
      />
    </>
  );
};

/** Material Symbols glyph (the app's own icon font). */
export const Icon: React.FC<{ readonly name: string; readonly size: number; readonly color?: string; readonly style?: React.CSSProperties }> = ({ name, size, color = N.ink, style }) => (
  <span style={{ fontFamily: ICON_FONT, fontSize: size, lineHeight: 1, color, fontVariationSettings: "'FILL' 1", display: "inline-block", ...style }}>{name}</span>
);
