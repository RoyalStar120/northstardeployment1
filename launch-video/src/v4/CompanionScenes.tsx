import React from "react";
import { AbsoluteFill } from "remotion";
import { Phone, phoneHeight, Screen } from "../components";
import { fontFamily } from "../theme";
import {
  blurIn,
  blurOut,
  caps,
  eInOut,
  Icon,
  N,
  NSMark,
  TouchDot,
  tw,
  TypeOn,
  useSec,
  useStage,
} from "./kit";

const Pill: React.FC<{
  readonly w: number;
  readonly h: number;
  readonly font: number;
  readonly children?: React.ReactNode;
  readonly sendScale?: string;
}> = ({ w, h, font, children, sendScale }) => (
  <div
    style={{
      width: w,
      height: h,
      display: "flex",
      alignItems: "center",
      gap: h * 0.16,
    }}
  >
    <div
      style={{
        flex: 1,
        height: "100%",
        borderRadius: h / 2,
        background: "#FFFFFF",
        border: "1px solid #E8E8E8",
        display: "flex",
        alignItems: "center",
        padding: `0 ${h * 0.38}px`,
        fontFamily,
        fontWeight: 500,
        fontSize: font,
        letterSpacing: "-0.01em",
        color: N.ink,
        whiteSpace: "pre",
        overflow: "hidden",
        boxShadow: "0 18px 50px rgba(17,17,17,0.08)",
      }}
    >
      {children ?? <span style={{ color: "#9A9A9A" }}>Ask Companion</span>}
    </div>
    <div
      style={{
        width: h,
        height: h,
        borderRadius: "50%",
        background: N.ink,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        scale: sendScale,
      }}
    >
      <Icon name="arrow_upward" size={h * 0.5} color="#FFFFFF" />
    </div>
  </div>
);

// S4 · NO TECH SKILLS REQUIRED (1.2 s): the dark panel slides in; caps lines blur in (REQUIRED. in amber);
// the real Companion input settles from a tilt, then grows toward center to hand off to the macro shot.
export const NOTECH_SEC = 1.2;

export const NoTechScene: React.FC = () => {
  const s = useSec();
  const { W, H, reel, cx, cy } = useStage();
  const slide = tw(s, 0, 0.45);
  const settle = tw(s, 0.3, 1.0);
  const hand = tw(s, 0.9, 1.2, eInOut);
  const size = reel ? 128 : 118;
  // Pill home position (right half on 16:9, lower half on the reel) → center as it hands off.
  const home = reel
    ? { x: cx, y: H * 0.74 }
    : { x: W * 0.45 + (W * 0.55) / 2, y: cy };
  const px = home.x + (cx - home.x) * hand;
  const py = home.y + (cy - home.y) * hand;
  const pw = reel ? 900 : 780;
  return (
    <AbsoluteFill
      style={{ background: N.warm, overflow: "hidden", perspective: 1800 }}
    >
      <div
        style={{
          position: "absolute",
          background: N.dark,
          ...(reel
            ? {
                left: 0,
                top: 0,
                width: W,
                height: H * 0.5,
                translate: `0 ${(-(1 - slide) - hand) * H * 0.5}px`,
              }
            : {
                left: 0,
                top: 0,
                width: W * 0.45,
                height: H,
                translate: `${(-(1 - slide) - hand) * W * 0.45}px 0`,
              }),
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: reel ? "0 90px" : "0 110px",
          gap: size * 0.08,
        }}
      >
        <div style={{ ...caps(size, "#FFFFFF"), ...blurIn(s, 0.22, 0.4) }}>
          No tech
        </div>
        <div style={{ ...caps(size, "#FFFFFF"), ...blurIn(s, 0.32, 0.4) }}>
          skills
        </div>
        <div style={{ ...caps(size, N.amber), ...blurIn(s, 0.42, 0.4) }}>
          required.
        </div>
      </div>
      {/* Centering lives on the wrapper: blurIn sets its own `translate` (the rise), which would override it. */}
      <div
        style={{
          position: "absolute",
          left: px,
          top: py,
          translate: "-50% -50%",
        }}
      >
        <div
          style={{
            transform: `rotateZ(${(1 - settle) * 8}deg) rotateX(${(1 - settle) * 14}deg)`,
            scale: String(1 + hand * 0.9),
            ...blurIn(s, 0.3, 0.45, 20, 12),
          }}
        >
          <Pill w={pw} h={reel ? 120 : 108} font={reel ? 44 : 40} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

// S5 · Companion (2.8 s): macro typing in the giant input → tap send → pull back to the real Companion screen →
// the answer streams in → tap "Start my resume" → the real Resume step 1.
export const COMPANION_SEC = 2.8;

const QUESTION = "how do i make a resume?";
const ANSWER = [
  "Easy. Tap Resume and answer 5 short questions.",
  "I'll turn them into a clean resume for you.",
];
const START_BTN = { x: 58, y: 334, w: 196, h: 46 };

export const CompanionScene: React.FC = () => {
  const s = useSec();
  const { H, reel, cx, cy } = useStage();
  const pull = tw(s, 0.95, 1.35, eInOut);
  const phoneW = reel ? 640 : 430;
  const PH = phoneHeight(phoneW);
  const pLeft = cx - phoneW / 2;
  const pTop = reel ? (H - PH) / 2 - 90 : cy - PH / 2 + 20;
  const toResume = tw(s, 2.25, 2.55, eInOut);
  const pw = reel ? 1000 : 1700;
  // Combine the pull-in fade with the exit blur (spreading blurOut would overwrite the fade).
  const out = blurOut(s, 2.58, 0.22);
  const ph = reel ? 150 : 200;
  return (
    <AbsoluteFill style={{ background: N.warm, overflow: "hidden" }}>
      {/* Macro: the camera is pushed deep into the input, so typing fills the frame */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          scale: String(1.04 - s * 0.03 - pull * 0.55),
          opacity: 1 - pull,
          filter: `blur(${pull * 10}px)`,
        }}
      >
        <Pill
          w={pw}
          h={ph}
          font={reel ? 60 : 92}
          sendScale={String(
            1 - 0.08 * Math.max(0, 1 - Math.abs(s - 0.95) / 0.12),
          )}
        >
          <TypeOn text={QUESTION} s={s} at={0.05} cps={30} hideCaretAt={0.95} />
        </Pill>
      </AbsoluteFill>
      <TouchDot
        s={s}
        from={0.6}
        to={1.05}
        size={reel ? 70 : 84}
        stops={[
          { t: 0.6, x: cx + pw / 2 + 120, y: cy + 260 },
          { t: 0.95, x: cx + pw / 2 - ph / 2, y: cy, tap: true },
        ]}
      />

      {/* Pull back to the phone */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: pull * (out.opacity as number),
          filter: out.filter,
          scale: String(1.2 - 0.2 * pull),
        }}
      >
        <Phone width={phoneW} style={{ left: pLeft, top: pTop }}>
          <div style={{ position: "absolute", inset: 0, fontFamily }}>
            <div
              style={{ position: "absolute", inset: 0, opacity: 1 - toResume }}
            >
              <Screen name="companion-v4" />
              {/* Clear the empty state so the conversation sits in the real chat surface */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 78,
                  width: 390,
                  height: 612,
                  background: "#FFFFFF",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  right: 16,
                  top: 104,
                  background: N.ink,
                  color: "#FFFFFF",
                  fontSize: 15,
                  fontWeight: 600,
                  padding: "10px 16px",
                  borderRadius: 22,
                  ...blurIn(s, 1.05, 0.35),
                }}
              >
                {QUESTION}
              </div>
              <div
                style={{
                  position: "absolute",
                  left: 16,
                  top: 166,
                  display: "flex",
                  gap: 8,
                  alignItems: "flex-start",
                  ...blurIn(s, 1.2, 0.3),
                }}
              >
                <NSMark size={28} style={{ boxShadow: "none" }} />
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: N.gray,
                      marginBottom: 4,
                    }}
                  >
                    Companion
                  </div>
                  <div
                    style={{
                      background: "#F2F2F2",
                      color: N.ink,
                      fontSize: 15,
                      lineHeight: 1.4,
                      padding: "10px 14px",
                      borderRadius: 18,
                      borderTopLeftRadius: 6,
                      width: 268,
                    }}
                  >
                    {ANSWER.map((line, i) => (
                      <div
                        key={i}
                        style={{
                          ...blurIn(s, 1.3 + i * 0.25, 0.35, 6, 6),
                          marginTop: i ? 6 : 0,
                        }}
                      >
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div
                style={{
                  position: "absolute",
                  left: START_BTN.x,
                  top: START_BTN.y,
                  height: START_BTN.h,
                  padding: "0 20px",
                  borderRadius: 23,
                  background: N.amber,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 16,
                  fontWeight: 800,
                  color: N.ink,
                  ...blurIn(s, 1.85, 0.35),
                  scale: String(
                    1 - 0.06 * Math.max(0, 1 - Math.abs(s - 2.15) / 0.1),
                  ),
                }}
              >
                <Icon name="description" size={20} /> Start my resume
              </div>
            </div>
            <div
              style={{
                position: "absolute",
                inset: 0,
                opacity: toResume,
                scale: String(1.04 - 0.04 * toResume),
              }}
            >
              <Screen name="resume" />
            </div>
            <TouchDot
              s={s}
              from={1.85}
              to={2.35}
              stops={[
                { t: 1.85, x: 300, y: 520 },
                {
                  t: 2.15,
                  x: START_BTN.x + START_BTN.w / 2,
                  y: START_BTN.y + START_BTN.h / 2,
                  tap: true,
                },
              ]}
            />
          </div>
        </Phone>
        {/* Floating chip (reference's floating labels). Position on the wrapper: blurIn's rise `translate`
            would override the reel centering. */}
        <div
          style={{
            position: "absolute",
            ...(reel
              ? { left: cx, top: pTop + PH + 40, translate: "-50% 0" }
              : { left: pLeft + phoneW + 60, top: cy - 30 }),
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "14px 22px",
              borderRadius: 999,
              background: "#FFFFFF",
              boxShadow: "0 14px 40px rgba(17,17,17,0.12)",
              fontFamily,
              fontWeight: 700,
              fontSize: reel ? 38 : 32,
              color: N.ink,
              ...blurIn(s, 2.3, 0.4),
            }}
          >
            <Icon name="work" size={reel ? 38 : 32} color={N.amberDeep} />{" "}
            Everyday work counts.
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
