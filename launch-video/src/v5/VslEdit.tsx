import { Video } from "@remotion/media";
import React from "react";
import { AbsoluteFill, interpolate, Sequence, staticFile, useVideoConfig } from "remotion";
import {
  Badge,
  Caption,
  ChatIcon,
  CheckStamp,
  ClockIcon,
  eInOut,
  eOut,
  Glass,
  life,
  mont,
  Neon,
  PhoneIcon,
  Phrase,
  PlayCard,
  pop,
  SunriseIcon,
  tw,
  useSec,
  V,
} from "./kit";

// Round-5 VSL edit of Downloads/20261001_054921000_iOS.MOV (docs/shotlist.md). 15 s, 60 fps, original audio.
// Cuts are taken from the local transcript (refs/clip/transcript.json) to remove the stutter and the pause.

type Cut = { name: string; src: number; len: number; z0: number; z1: number };
const CUTS: Cut[] = [
  { name: "A · 10:50 right now", src: 0.74, len: 1.24, z0: 1.16, z1: 1.24 },
  { name: "B1 · I just finished", src: 2.08, len: 0.54, z0: 1.0, z1: 1.04 },
  { name: "B2 · the video", src: 3.14, len: 0.74, z0: 1.08, z1: 1.12 },
  { name: "C · phone / tomorrow", src: 4.36, len: 2.14, z0: 1.16, z1: 1.24 },
  { name: "D · the plan", src: 7.72, len: 5.46, z0: 1.0, z1: 1.14 },
  { name: "E · the grind", src: 14.8, len: 4.88, z0: 1.16, z1: 1.26 },
];
// Output start time of each cut.
const STARTS = CUTS.reduce<number[]>((acc, c, i) => [...acc, i === 0 ? 0 : acc[i - 1] + CUTS[i - 1].len], []);
export const VSL_SEC = CUTS.reduce((a, c) => a + c.len, 0);

// Emphasis punches (+6%, ease-out) on hard words, in output seconds.
const PUNCHES = [6.54, 14.68];

// Face anchor in the source frame (zooms push toward the speaker's face).
const ORIGIN = "48% 30%";

const Footage: React.FC<{ readonly c: Cut; readonly idx: number }> = ({ c, idx }) => {
  const s = useSec();
  const { fps } = useVideoConfig();
  const g = STARTS[idx] + s; // output time
  const push = c.z0 + (c.z1 - c.z0) * tw(s, 0, c.len, eInOut);
  const punch = PUNCHES.reduce((acc, p) => acc + 0.06 * tw(g, p, p + 0.15, eOut), 0);
  // Zoom-blur whip across the D → E cut.
  const whipOut = idx === 4 ? tw(s, c.len - 0.12, c.len, eInOut) : 0;
  const whipIn = idx === 5 ? 1 - tw(s, 0, 0.18, eOut) : 0;
  const whip = Math.max(whipOut, whipIn);
  const scale = push * (1 + punch) + whip * 0.16;
  // Gentle 1.5% pan through the long sentence (D).
  const pan = idx === 4 ? interpolate(s, [0, c.len], [0, -1.5]) : 0;
  const tb = Math.round(c.src * fps);
  const frames = Math.round(c.len * fps);
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#000" }}>
      <AbsoluteFill style={{ scale: String(scale), transformOrigin: ORIGIN, translate: `${pan}% 0`, filter: whip > 0 ? `blur(${whip * 14}px)` : undefined }}>
        <Video
          src={staticFile("clip/vsl-clip.mp4")}
          trimBefore={tb}
          trimAfter={tb + frames}
          // 20 ms fades at each jump cut so the audio doesn't click.
          volume={(f) => Math.min(1, f / (0.02 * fps), (frames - f) / (0.02 * fps))}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const PHRASES: Phrase[] = [
  { t0: 0.05, t1: 1.22, text: "SO 10:50 RIGHT NOW." },
  { t0: 1.26, t1: 2.5, text: "I JUST FINISHED THE VIDEO.", hi: "FINISHED", hiColor: V.green, hiAt: 1.42 },
  { t0: 2.54, t1: 3.62, text: "I SENT IT TO MY PHONE" },
  { t0: 3.62, t1: 4.64, text: "I'LL POST IT TOMORROW MORNING" },
  { t0: 4.68, t1: 5.5, text: "WHAT I'M GONNA DO IS" },
  { t0: 5.5, t1: 6.15, text: "ME AND MY PARTNER" },
  { t0: 6.15, t1: 7.24, text: "RUN A DM SETTING OFFER" },
  { t0: 7.24, t1: 8.85, text: "JUST TO GET SOME CASH", hi: "CASH", hiColor: V.green, hiAt: 8.4 },
  { t0: 8.85, t1: 10.08, text: "TO FUND OUR META AD CAMPAIGNS" },
  { t0: 10.16, t1: 12.7, text: "I'M JUST GONNA SEND THE DAILY DOSE OF DMS" },
  { t0: 12.7, t1: 13.8, text: "UPDATE THE CRM" },
  { t0: 13.8, t1: 15.2, text: "AND I'LL HOP RIGHT INTO SALES", hi: "SALES", hiColor: V.red, hiAt: 14.68 },
];

const Overlays: React.FC = () => {
  const s = useSec();
  const { height: H } = useVideoConfig();

  // B: play card + green check
  const play = life(s, 1.35, 2.42);
  // C: phone, pushed out by the badge
  const phone = life(s, 3.35, 4.02);
  // D: ME + PARTNER chips
  const chips = life(s, 5.5, 6.4);
  // D: trend line draw
  const line = tw(s, 8.85, 9.6, eInOut);
  const lineLife = life(s, 8.85, 10.0);
  // E: DM stack, then CRM checklist
  const dms = life(s, 11.3, 12.6);
  const crm = life(s, 12.7, 13.85);
  // Red light-leak flash on "sales"
  const flash = interpolate(s, [14.58, 14.7, 14.95], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* Grade: soft vignette + faint cool tint (skin stays natural) */}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 75% 70% at 50% 42%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.38) 100%)" }} />
      <AbsoluteFill style={{ background: "#3E4C4F", mixBlendMode: "soft-light", opacity: 0.22 }} />

      {/* A · hook */}
      <Neon text="10:50" s={s} at={0.3} out={1.12} x={110} y={150} size={150} />
      <Neon text="PM" s={s} at={0.5} out={1.12} x={130} y={320} size={64} />
      {life(s, 0.55, 1.12).on ? (
        <div style={{ position: "absolute", left: 250, top: 300, scale: String(pop(s, 0.55)), opacity: 1 - life(s, 0.55, 1.12).o }}>
          <ClockIcon size={130} />
        </div>
      ) : null}

      {/* B · play card + check */}
      {play.on ? (
        <div style={{ position: "absolute", left: 130, top: 230, scale: String(pop(s, 1.35) * (1 - play.o * 0.15)), opacity: 1 - play.o, filter: `blur(${play.o * 10}px)`, rotate: "-4deg" }}>
          <PlayCard w={300} />
          <div style={{ position: "absolute", right: -40, top: -40, scale: String(pop(s, 2.18)) }}>
            <CheckStamp size={110} />
          </div>
        </div>
      ) : null}

      {/* C · phone → badge */}
      {phone.on ? (
        <div style={{ position: "absolute", left: 200, top: 190, scale: String(pop(s, 3.35) * (1 - phone.o * 0.2)), opacity: 1 - phone.o, filter: `blur(${phone.o * 10}px)`, rotate: "6deg" }}>
          <PhoneIcon size={130} dot={pop(s, 3.55)} />
        </div>
      ) : null}
      <Badge text="POSTING TOMORROW AM" s={s} at={4.05} out={4.6} x={420} y={300} icon={<SunriseIcon size={92} />} />

      {/* D · ME + PARTNER → DM SETTING OFFER → CASH → trend line + ADS */}
      {chips.on ? (
        <div style={{ position: "absolute", left: 110, top: 200, opacity: 1 - chips.o, filter: `blur(${chips.o * 10}px)` }}>
          <svg width={360} height={150} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
            <path d="M80 45 C160 45 200 115 280 115" stroke={V.cyan} strokeWidth={3} fill="none" strokeDasharray={260} strokeDashoffset={260 * (1 - tw(s, 5.75, 6.05))} style={{ filter: `drop-shadow(0 0 6px ${V.cyan})` }} />
          </svg>
          {[
            { t: "ME", x: 0, y: 0, at: 5.5 },
            { t: "PARTNER", x: 210, y: 70, at: 5.92 },
          ].map((c) => (
            <div key={c.t} style={{ position: "absolute", left: c.x, top: c.y, scale: String(pop(s, c.at)) }}>
              <Glass w={c.t === "ME" ? 140 : 250} style={{ padding: "16px 0", textAlign: "center", fontSize: 30, outlineOffset: 4 }}>
                {c.t}
              </Glass>
            </div>
          ))}
        </div>
      ) : null}
      <Badge text="DM SETTING OFFER" s={s} at={6.45} out={7.9} x={400} y={300} icon={<ChatIcon size={96} />} />
      <Neon text="CASH" s={s} at={8.3} out={9.0} x={110} y={160} size={150} color={V.green} />
      {lineLife.on ? (
        <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0, opacity: 1 - lineLife.o }}>
          <path
            d="M60 960 C 180 900, 230 760, 330 690 S 470 520, 520 420 S 600 300, 640 250"
            stroke={V.green}
            strokeWidth={10}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={900}
            strokeDashoffset={900 * (1 - line)}
            style={{ filter: `drop-shadow(0 0 10px ${V.green}) drop-shadow(0 0 28px ${V.green}88)` }}
          />
        </svg>
      ) : null}
      <Neon text="ADS" s={s} at={9.5} out={10.0} x={110} y={120} size={140} color={V.green} />

      {/* E · DM stack → CRM checklist → SALES */}
      {dms.on ? (
        <div style={{ position: "absolute", left: 100, top: 160, opacity: 1 - dms.o, filter: `blur(${dms.o * 10}px)` }}>
          {[11.3, 11.5, 11.7].map((at, k) => (
            <div key={k} style={{ marginBottom: 14, marginLeft: k * 26, scale: String(pop(s, at)), opacity: Math.min(1, pop(s, at) * 2) }}>
              <Glass w={340} style={{ padding: 16, display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 22, background: "linear-gradient(160deg,#7FE3FF,#0B7FB8)", flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: 10, width: "70%", borderRadius: 5, background: "rgba(255,255,255,0.85)" }} />
                  <div style={{ height: 8, width: "92%", borderRadius: 4, background: "rgba(255,255,255,0.45)", marginTop: 8 }} />
                </div>
              </Glass>
            </div>
          ))}
          <div style={{ marginLeft: 120, scale: String(pop(s, 11.95)), display: "inline-block" }}>
            <Glass w={190} style={{ padding: "12px 0", textAlign: "center", fontSize: 28, outlineOffset: 4 }}>
              DMs <span style={{ color: V.green }}>✓</span>
            </Glass>
          </div>
        </div>
      ) : null}
      {crm.on ? (
        <div style={{ position: "absolute", left: 120, top: 190, scale: String(pop(s, 12.7) * (1 - crm.o * 0.15)), opacity: 1 - crm.o, filter: `blur(${crm.o * 10}px)` }}>
          <Glass w={360}>
            <div style={{ fontSize: 34, marginBottom: 14, letterSpacing: "0.04em" }}>CRM</div>
            {[12.95, 13.15, 13.35].map((at, k) => {
              const t = pop(s, at, 0.25);
              return (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 14, marginTop: k ? 14 : 0 }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 9,
                      border: "2px solid rgba(150,200,255,0.9)",
                      background: t > 0 ? `rgba(20,255,117,${0.9 * Math.min(1, t)})` : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 24,
                      color: "#06361a",
                    }}
                  >
                    <span style={{ scale: String(t) }}>✓</span>
                  </div>
                  <div style={{ height: 10, flex: 1, borderRadius: 5, background: "rgba(255,255,255,0.7)" }} />
                </div>
              );
            })}
          </Glass>
        </div>
      ) : null}
      <Neon text="SALES" s={s} at={14.62} out={20} x={100} y={150} size={160} />
      <AbsoluteFill
        style={{
          background: `linear-gradient(105deg, rgba(255,43,43,0) ${-30 + flash * 60}%, rgba(255,60,40,0.55) ${flash * 60}%, rgba(255,140,60,0.25) ${10 + flash * 60}%, rgba(255,43,43,0) ${30 + flash * 60}%)`,
          mixBlendMode: "screen",
          opacity: flash,
        }}
      />

      {/* Captions */}
      {PHRASES.map((p, k) => (
        <Caption key={k} p={p} s={s} H={H} />
      ))}
    </AbsoluteFill>
  );
};

export const VslEdit: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: "#000", fontFamily: mont }}>
      {CUTS.map((c, i) => (
        <Sequence key={c.name} name={c.name} from={Math.round(STARTS[i] * fps)} durationInFrames={Math.round((STARTS[i] + c.len) * fps) - Math.round(STARTS[i] * fps)}>
          <Footage c={c} idx={i} />
        </Sequence>
      ))}
      <Overlays />
    </AbsoluteFill>
  );
};
