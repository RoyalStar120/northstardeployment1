import { loadFont } from "@remotion/google-fonts/Montserrat";
import React from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

// Round 5 (docs/style_guide.md): VSL edit grammar. All timing in continuous seconds → true 60 fps overlays.

export const { fontFamily: mont } = loadFont("normal", { weights: ["800", "900"], subsets: ["latin"] });

export const V = {
  cyan: "#0FBCF4",
  white: "#FFFFFF",
  red: "#FF2B2B",
  green: "#14FF75",
  badgeA: "#3352C2",
  badgeB: "#1E2F78",
  amber: "#FFB23F",
};

export const eOut = Easing.bezier(0.16, 1, 0.3, 1);
export const eInOut = Easing.bezier(0.65, 0, 0.35, 1);
const cl = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const useSec = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return frame / fps;
};

export const tw = (s: number, a: number, b: number, easing = eOut) => interpolate(s, [a, b], [0, 1], { ...cl, easing });

/** Visibility envelope for a graphic: pops in at `at`, scales down + blurs out at `out` (0.2 s). */
export const life = (s: number, at: number, out: number, inDur = 0.25) => {
  const i = tw(s, at, at + inDur);
  const o = tw(s, out, out + 0.2, eInOut);
  return { i, o, on: s >= at && s < out + 0.2 };
};

/** Small spring with ≤6% overshoot, for badges and icons. */
export const pop = (s: number, at: number, dur = 0.32) =>
  interpolate(s, [at, at + dur], [0, 1], { ...cl, easing: Easing.bezier(0.34, 1.3, 0.64, 1) });

const glow = (c: string) => `0 0 6px ${c}, 0 0 18px ${c}99, 0 0 36px ${c}66`;

/** Neon keyword: letters fly in one by one (35 ms apart) from scale 1.6, blur 12, rotateY 35° → settled; glow blooms after. */
export const Neon: React.FC<{
  readonly text: string;
  readonly s: number;
  readonly at: number;
  readonly out: number;
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly color?: string;
  readonly anchor?: "left" | "center";
}> = ({ text, s, at, out, x, y, size, color = V.cyan, anchor = "left" }) => {
  const { o, on } = life(s, at, out);
  if (!on) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        translate: anchor === "center" ? "-50% 0" : undefined,
        display: "flex",
        perspective: 600,
        fontFamily: mont,
        fontWeight: 900,
        fontSize: size,
        lineHeight: 1,
        letterSpacing: "0.005em",
        whiteSpace: "pre",
        opacity: 1 - o,
        filter: `blur(${o * 10}px)`,
        scale: String(1 - o * 0.15),
      }}
    >
      {text.split("").map((ch, k) => {
        const t = tw(s, at + k * 0.035, at + k * 0.035 + 0.25);
        const g = tw(s, at + k * 0.035 + 0.12, at + k * 0.035 + 0.4);
        return (
          <span
            key={k}
            style={{
              display: "inline-block",
              color: "#EFFBFF",
              opacity: t,
              scale: String(1.6 - 0.6 * t),
              filter: `blur(${(1 - t) * 12}px)`,
              transform: `rotateY(${(1 - t) * 35}deg)`,
              textShadow: g > 0 ? glow(color).replace(/(\d+)px/g, (m, n) => `${Number(n) * g}px`) : undefined,
              WebkitTextStroke: `1px ${color}`,
            }}
          >
            {ch}
          </span>
        );
      })}
    </div>
  );
};

/** Lower caption: one phrase, ALL CAPS ExtraBold, soft black shadow. Pops in 0.12 s; exits with a glitch smear. */
export type Phrase = { t0: number; t1: number; text: string; hi?: string; hiColor?: string; hiAt?: number };

export const Caption: React.FC<{ readonly p: Phrase; readonly s: number; readonly H: number; readonly size?: number }> = ({ p, s, H, size = 46 }) => {
  if (s < p.t0 || s > p.t1 + 0.15) return null;
  const i = tw(s, p.t0, p.t0 + 0.12);
  const o = tw(s, p.t1, p.t1 + 0.15, eInOut);
  return (
    <div
      style={{
        position: "absolute",
        top: H * 0.78,
        width: "100%",
        textAlign: "center",
        fontFamily: mont,
        fontWeight: 800,
        fontSize: size,
        letterSpacing: "0.01em",
        color: V.white,
        textShadow: "0 2px 0 rgba(0,0,0,0.55), 0 4px 18px rgba(0,0,0,0.65)",
        opacity: i * (1 - o),
        scale: `${(0.92 + 0.08 * i) * (1 + o * 0.12)} ${0.92 + 0.08 * i}`,
        filter: o > 0 ? `blur(${o * 6}px)` : undefined,
        whiteSpace: "pre",
      }}
    >
      {p.text.split(" ").map((w, k, arr) => {
        const isHi = p.hi && w.replace(/[^A-Z0-9:']/g, "") === p.hi;
        const on = isHi && s >= (p.hiAt ?? p.t0);
        return (
          <span key={k} style={{ color: on ? p.hiColor ?? V.red : undefined, textShadow: on ? `0 0 14px ${p.hiColor ?? V.red}88, 0 2px 0 rgba(0,0,0,0.55)` : undefined }}>
            {w}
            {k < arr.length - 1 ? " " : ""}
          </span>
        );
      })}
    </div>
  );
};

/** Stat badge: deep-blue gradient pill with a bright edge; slides up and pops; icon pops at its edge a beat later. */
export const Badge: React.FC<{
  readonly text: string;
  readonly s: number;
  readonly at: number;
  readonly out: number;
  readonly x: number;
  readonly y: number;
  readonly icon?: React.ReactNode;
}> = ({ text, s, at, out, x, y, icon }) => {
  const { o, on } = life(s, at, out);
  if (!on) return null;
  const p = pop(s, at);
  const ip = pop(s, at + 0.1);
  return (
    <div style={{ position: "absolute", left: x, top: y, translate: "-50% -50%", opacity: Math.min(1, p * 2) * (1 - o), filter: `blur(${o * 10}px)` }}>
      <div
        style={{
          position: "relative",
          padding: "22px 46px",
          borderRadius: 26,
          background: `linear-gradient(180deg, ${V.badgeA} 0%, ${V.badgeB} 100%)`,
          border: "2px solid rgba(140,190,255,0.85)",
          boxShadow: "0 0 24px rgba(60,130,255,0.55), inset 0 2px 0 rgba(255,255,255,0.25), 0 18px 40px rgba(0,0,0,0.35)",
          fontFamily: mont,
          fontWeight: 800,
          fontSize: 34,
          letterSpacing: "0.02em",
          color: V.white,
          whiteSpace: "nowrap",
          translate: `0 ${(1 - Math.min(p, 1)) * 30}px`,
          scale: String((0.85 + 0.15 * p) * (1 - o * 0.15)),
        }}
      >
        {text}
        {icon ? <div style={{ position: "absolute", right: -46, top: -40, scale: String(ip), rotate: `${(1 - ip) * -20}deg` }}>{icon}</div> : null}
      </div>
    </div>
  );
};

/** Glass card (dark translucent blue, bright border + dashed glow). */
export const Glass: React.FC<{ readonly w: number; readonly children: React.ReactNode; readonly style?: React.CSSProperties }> = ({ w, children, style }) => (
  <div
    style={{
      width: w,
      padding: 22,
      borderRadius: 22,
      background: "rgba(22,40,110,0.62)",
      backdropFilter: "blur(14px)",
      border: "1.5px solid rgba(150,200,255,0.8)",
      outline: "2px dashed rgba(90,170,255,0.45)",
      outlineOffset: 6,
      boxShadow: "0 0 30px rgba(60,130,255,0.35), 0 18px 40px rgba(0,0,0,0.35)",
      color: V.white,
      fontFamily: mont,
      fontWeight: 800,
      ...style,
    }}
  >
    {children}
  </div>
);

/* ---------- Drawn glossy icons (original vectors) ---------- */

const gloss = (id: string, a: string, b: string) => (
  <defs>
    <linearGradient id={`${id}-g`} x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0" stopColor={a} />
      <stop offset="1" stopColor={b} />
    </linearGradient>
    <radialGradient id={`${id}-h`} cx="0.35" cy="0.25" r="0.5">
      <stop offset="0" stopColor="#fff" stopOpacity="0.75" />
      <stop offset="1" stopColor="#fff" stopOpacity="0" />
    </radialGradient>
  </defs>
);

export const ClockIcon: React.FC<{ readonly size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ filter: "drop-shadow(0 0 14px rgba(15,188,244,0.6))" }}>
    {gloss("clk", "#7FE3FF", "#0B7FB8")}
    <circle cx="50" cy="50" r="44" fill="url(#clk-g)" />
    <circle cx="50" cy="50" r="34" fill="#E9FAFF" />
    <path d="M50 26 V50 L66 60" stroke="#0B4F75" strokeWidth="7" strokeLinecap="round" fill="none" />
    <circle cx="50" cy="50" r="44" fill="url(#clk-h)" />
  </svg>
);

export const PlayCard: React.FC<{ readonly w: number }> = ({ w }) => (
  <div
    style={{
      width: w,
      height: w * 0.6,
      borderRadius: w * 0.09,
      background: "linear-gradient(160deg, rgba(110,220,255,0.95), rgba(20,150,210,0.95))",
      boxShadow: "0 0 30px rgba(15,188,244,0.55), inset 0 3px 0 rgba(255,255,255,0.4), 0 18px 40px rgba(0,0,0,0.35)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <svg width={w * 0.24} height={w * 0.24} viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="48" fill="#0B5E86" />
      <path d="M40 30 L72 50 L40 70 Z" fill="#E9FAFF" />
    </svg>
  </div>
);

export const CheckStamp: React.FC<{ readonly size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ filter: "drop-shadow(0 0 14px rgba(20,255,117,0.7))" }}>
    {gloss("chk", "#6BFFB0", "#0BBF55")}
    <circle cx="50" cy="50" r="46" fill="url(#chk-g)" />
    <path d="M28 52 L44 67 L74 35" stroke="#fff" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <circle cx="50" cy="50" r="46" fill="url(#chk-h)" />
  </svg>
);

export const PhoneIcon: React.FC<{ readonly size: number; readonly dot?: number }> = ({ size, dot = 1 }) => (
  <svg width={size} height={size * 1.35} viewBox="0 0 74 100" style={{ filter: "drop-shadow(0 0 14px rgba(15,188,244,0.55))", overflow: "visible" }}>
    {gloss("ph", "#7FE3FF", "#0B7FB8")}
    <rect x="4" y="4" width="66" height="92" rx="13" fill="url(#ph-g)" />
    <rect x="11" y="13" width="52" height="70" rx="6" fill="#E9FAFF" />
    <rect x="27" y="88" width="20" height="3.5" rx="1.8" fill="#E9FAFF" />
    <rect x="4" y="4" width="66" height="92" rx="13" fill="url(#ph-h)" />
    <g style={{ scale: String(dot), transformOrigin: "68px 8px" }}>
      <circle cx="68" cy="8" r="13" fill="#FF2B2B" />
      <text x="68" y="13.5" textAnchor="middle" fontSize="15" fontWeight="900" fill="#fff" fontFamily={mont}>
        1
      </text>
    </g>
  </svg>
);

export const SunriseIcon: React.FC<{ readonly size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ filter: "drop-shadow(0 0 14px rgba(255,178,63,0.7))" }}>
    {gloss("sun", "#FFE08A", "#FF8A1F")}
    <path d="M18 62 A32 32 0 0 1 82 62 Z" fill="url(#sun-g)" />
    {[-60, -30, 0, 30, 60].map((a) => (
      <rect key={a} x="48" y="12" width="4" height="13" rx="2" fill="#FFB23F" style={{ transform: `rotate(${a}deg)`, transformOrigin: "50px 62px" }} />
    ))}
    <rect x="8" y="64" width="84" height="6" rx="3" fill="#FFB23F" />
  </svg>
);

export const ChatIcon: React.FC<{ readonly size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ filter: "drop-shadow(0 0 14px rgba(15,188,244,0.6))" }}>
    {gloss("cht", "#7FE3FF", "#0B7FB8")}
    <path d="M14 22 Q14 10 26 10 H74 Q86 10 86 22 V58 Q86 70 74 70 H44 L24 88 V70 H26 Q14 70 14 58 Z" fill="url(#cht-g)" />
    {[34, 50, 66].map((cx) => (
      <circle key={cx} cx={cx} cy="40" r="6" fill="#E9FAFF" />
    ))}
    <path d="M14 22 Q14 10 26 10 H74 Q86 10 86 22 V58 Q86 70 74 70 H44 L24 88 V70 H26 Q14 70 14 58 Z" fill="url(#cht-h)" />
  </svg>
);
