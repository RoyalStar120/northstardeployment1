import React from "react";
import { AbsoluteFill, Easing, interpolate, useVideoConfig } from "remotion";
import { Phone, phoneHeight, Screen } from "../components";
import { C, clamp, easeInOut, easeOut, fontFamily, useT } from "../theme";
import { TouchDot } from "../v4/kit";
import { Burst, GuideArrow, GuideRing, pressed, Ripple } from "./kit";

// S6 ⭐ The step-by-step job guide, one continuous close-up take.
// Rebuilt from expo-app/JobGuide.js + guideScript.js: same arrow, ring, card styles and step copy (verbatim).
// The post and the compose sheet are deliberately plain and unbranded.
export const GUIDE_FRAMES = 138;

// Phone geometry for 16:9 or the 9:16 reel. The reel phone is already large, so its close-ups zoom less.
const layout = (W: number, H: number) => {
  const reel = H > W;
  const PHONE_W = reel ? 640 : 430;
  const PH = phoneHeight(PHONE_W);
  const LEFT = W / 2 - PHONE_W / 2;
  const TOP = reel ? (H - PH) / 2 : H / 2 - PH / 2 + 20;
  const SX = LEFT + PHONE_W * 0.035;
  const SY = TOP + PHONE_W * 0.1 + PHONE_W * 0.035 * 0.3;
  const K = (PHONE_W - PHONE_W * 0.07) / 390;
  return {
    reel,
    PHONE_W,
    LEFT,
    TOP,
    fx: (x: number) => SX + x * K,
    fy: (y: number) => SY + y * K,
    zoom: reel ? { start: 1.06, close: 1.16, card: 1.12 } : { start: 1.25, close: 1.45, card: 1.32 },
  };
};

const ADDRESS = "movinghelp.reply@example.com";
const MESSAGE =
  "Hi, I'm Sam. I saw your post for moving help. I've unloaded trucks and prepped meals, and I can start today. My phone is (206) 555-0142.";

// Targets in app px (390x844).
const REPLY = { x: 290, y: 150, w: 80, h: 36 };
const EMAIL = { x: 214, y: 206, w: 142, h: 34 };
const VIEW_LISTING = { x: 172, y: 443 };
const OPEN_GMAIL = { x: 118, y: 729 };
const SEND = { x: 336, y: 86 };

// Step copy, verbatim from guideScript.js stepCopy().
const STEPS = [
  { tag: "First", title: "Tap “reply”", detail: "The yellow arrow shows you where.", h: 178 },
  { tag: "Next", title: "Tap “email”", detail: "This shows their email address.", h: 178 },
  { tag: "Finally", title: "Open Gmail and send it", detail: "Your message is already written. Send it to:", h: 430 },
  { tag: "Done", title: "You applied!", detail: "Nice work. Keep an eye on your phone and email.", h: 212 },
];
const STEP_AT = [22, 56, 76, 114];

const ease = Easing.out(Easing.cubic);
const T = (frame: number, a: number, b: number, e = easeInOut) => interpolate(frame, [a, b], [0, 1], { ...clamp, easing: e });

const Btn: React.FC<{ readonly label: string; readonly tone: "yellow" | "light" | "dark"; readonly big?: boolean; readonly style?: React.CSSProperties }> = ({
  label,
  tone,
  big,
  style,
}) => (
  <div
    style={{
      flex: big ? 1.4 : 1,
      height: big ? 56 : 52,
      borderRadius: big ? 28 : 26,
      background: tone === "yellow" ? "#FFD43B" : tone === "dark" ? "#111111" : "#F2F2F2",
      color: tone === "dark" ? "#FFFFFF" : "#111111",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: big ? 18 : 16,
      fontWeight: big ? 800 : 700,
      ...style,
    }}
  >
    {label}
  </div>
);

const CardBody: React.FC<{ readonly i: number; readonly frame: number; readonly stream?: boolean }> = ({ i, frame, stream = false }) => {
  const s = STEPS[i];
  const done = i === 3;
  return (
    <div style={{ padding: "18px 18px 0" }}>
      <div style={{ display: "inline-block", background: done ? "#DDF3E4" : "#FFD43B", borderRadius: 999, padding: "4px 12px", fontSize: 13, fontWeight: 800, letterSpacing: 0.3, color: "#111" }}>
        {s.tag}
      </div>
      <div style={{ marginTop: 10, fontSize: 26, lineHeight: "31px", fontWeight: 800, letterSpacing: -0.4, color: "#111" }}>{s.title}</div>
      <div style={{ marginTop: 4, fontSize: 16, lineHeight: "22px", color: "#555" }}>{s.detail}</div>
      {i === 2 ? (
        <>
          <div style={{ marginTop: 10, padding: "12px 14px", borderRadius: 14, background: "#F2F2F2", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: "#111" }}>{ADDRESS}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>Copy</span>
          </div>
          <div style={{ marginTop: 12, padding: 12, borderRadius: 14, background: "#FFF7D1", border: "1px solid #F2DC7A", fontSize: 14, lineHeight: "20px", color: "#3F3F3F" }}>
            {stream
              ? MESSAGE.split(/(?<=\.) /).map((line, k) => {
                  const t = interpolate(frame, [79 + k * 3, 84 + k * 3], [0, 1], { ...clamp, easing: ease });
                  return (
                    <span key={k} style={{ opacity: t, filter: `blur(${(1 - t) * 6}px)` }}>
                      {line}{" "}
                    </span>
                  );
                })
              : MESSAGE}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
            <Btn label="Open Gmail" tone="yellow" big style={{ scale: pressed(frame, 86) }} />
            <Btn label="Copy message" tone="light" />
          </div>
        </>
      ) : done ? (
        <div style={{ display: "flex", marginTop: 16 }}>
          <Btn label="I’m done" tone="dark" />
        </div>
      ) : (
        <div style={{ display: "flex", marginTop: 16 }}>
          <Btn label="See my message" tone="light" />
        </div>
      )}
    </div>
  );
};

// Round 4 options (all off by default, so round 3 is unchanged): `speed` retimes the take, `touch` adds the
// gliding touch dot, `stream` writes the message in line by line.
export const JobGuideScene: React.FC<{ readonly speed?: number; readonly touch?: boolean; readonly stream?: boolean }> = ({
  speed = 1,
  touch = false,
  stream = false,
}) => {
  const frame = useT() * speed;
  const { width: W, height: H } = useVideoConfig();
  const { reel, PHONE_W, LEFT, TOP, fx, fy, zoom: Z } = layout(W, H);

  // Which step the card shows, and a 10-frame rise/crossfade on each change (JobGuide.js cardIn: 320 ms).
  const step = STEP_AT.reduce((acc, a, i) => (frame >= a ? i : acc), -1);
  const since = step >= 0 ? frame - STEP_AT[step] : 0;
  const cardIn = interpolate(since, [0, 10], [0, 1], { ...clamp, easing: ease });
  const prevH = step > 0 ? STEPS[step - 1].h : STEPS[0].h;
  const cardH = step >= 0 ? interpolate(cardIn, [0, 1], [prevH, STEPS[step].h]) : STEPS[0].h;

  const listingIn = T(frame, 15, 24, ease);
  const options = T(frame, 54, 60, ease);
  const glide = T(frame, 58, 70);
  const compose = T(frame, 93, 102, ease) * (1 - T(frame, 111, 118, Easing.in(Easing.cubic)));

  // Arrow target: reply → email, gone once Gmail opens.
  const target = {
    x: interpolate(glide, [0, 1], [REPLY.x + REPLY.w / 2, EMAIL.x + EMAIL.w / 2]),
    y: interpolate(glide, [0, 1], [REPLY.y, EMAIL.y]),
  };
  const ring = {
    x: interpolate(glide, [0, 1], [REPLY.x, EMAIL.x]),
    y: interpolate(glide, [0, 1], [REPLY.y, EMAIL.y]),
    w: interpolate(glide, [0, 1], [REPLY.w, EMAIL.w]),
    h: interpolate(glide, [0, 1], [REPLY.h, EMAIL.h]),
  };
  const guideOn = interpolate(frame, [26, 30, 74, 78], [0, 1, 1, 0], clamp);

  // Camera: close on the post (top), then down to the card, then pull back for "You applied!".
  const toCard = T(frame, 74, 90);
  const back = T(frame, 118, 134);
  const zoom = interpolate(frame, [0, 20], [Z.start, Z.close], { ...clamp, easing: easeOut }) * (1 - toCard) + Z.card * toCard;
  const scale = zoom + (1 - zoom) * back;
  const ox = fx(interpolate(toCard, [0, 1], [frame < 15 ? VIEW_LISTING.x : 250, 195]));
  const oy = fy(interpolate(toCard, [0, 1], [frame < 15 ? VIEW_LISTING.y : 430, 640]));

  return (
    <AbsoluteFill style={{ background: C.field }}>
      <AbsoluteFill style={{ scale: String(scale), transformOrigin: `${ox}px ${oy}px` }}>
        <Phone width={PHONE_W} style={{ left: LEFT, top: TOP }}>
          <div style={{ position: "absolute", inset: 0, fontFamily }}>
            {/* Real gig card; View listing is tapped */}
            <div style={{ position: "absolute", inset: 0, translate: `${-listingIn * 120}px 0`, opacity: 1 - listingIn }}>
              <Screen name="gigs" />
              <Ripple frame={frame} at={7} x={VIEW_LISTING.x} y={VIEW_LISTING.y} size={90} />
            </div>

            {/* The listing, inside Northstar */}
            <div style={{ position: "absolute", inset: 0, background: "#FFFFFF", translate: `${(1 - listingIn) * 390}px 0` }}>
              <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 60, display: "flex", alignItems: "center", gap: 10, padding: "0 14px", borderBottom: "1px solid #E8E8E8" }}>
                <div style={{ height: 40, padding: "0 14px 0 10px", borderRadius: 20, background: "#FFD43B", display: "flex", alignItems: "center", gap: 2 }}>
                  <span style={{ fontSize: 28, lineHeight: "30px", fontWeight: 700, marginTop: -2 }}>‹</span>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>Northstar</span>
                </div>
                <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: "#3F3F3F", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  Get Paid to Lift
                </span>
              </div>
              {/* A plain, unbranded post */}
              <div style={{ position: "absolute", left: 20, right: 20, top: 78 }}>
                <div style={{ fontSize: 21, lineHeight: "26px", fontWeight: 700, color: "#111", width: 250 }}>Get Paid to Lift: Earn Daily Cash as a Mover</div>
                <div style={{ marginTop: 10, fontSize: 14, color: "#737373" }}>$25/hr · cash · today</div>
                <div style={{ marginTop: 26, fontSize: 15, lineHeight: "22px", color: "#3F3F3F" }}>
                  Casual daily labor unloading trucks and moving items. Cash paid the same day. Wear closed shoes.
                </div>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} style={{ marginTop: 12, height: 10, borderRadius: 5, background: "#EEEEEE", width: `${[92, 80, 86, 54][i]}%` }} />
                ))}
              </div>
              <div
                style={{
                  position: "absolute",
                  left: REPLY.x,
                  top: REPLY.y,
                  width: REPLY.w,
                  height: REPLY.h,
                  borderRadius: 8,
                  background: "#F2F2F2",
                  border: "1px solid #DADADA",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#111",
                  scale: pressed(frame, 50),
                }}
              >
                reply
              </div>
              <Ripple frame={frame} at={50} x={REPLY.x + REPLY.w / 2} y={REPLY.y + REPLY.h / 2} />
              {/* Reply options */}
              <div
                style={{
                  position: "absolute",
                  left: 204,
                  top: 196,
                  width: 166,
                  padding: "6px 0",
                  borderRadius: 12,
                  background: "#FFFFFF",
                  boxShadow: "0 10px 30px rgba(17,17,17,0.14), 0 0 0 1px rgba(17,17,17,0.06)",
                  opacity: options,
                  translate: `0 ${(1 - options) * -8}px`,
                }}
              >
                {["email", "call", "text"].map((o) => (
                  <div key={o} style={{ height: 40, display: "flex", alignItems: "center", padding: "0 16px", fontSize: 16, fontWeight: 600, color: "#111" }}>
                    {o}
                  </div>
                ))}
              </div>
              <Ripple frame={frame} at={72} x={EMAIL.x + EMAIL.w / 2} y={EMAIL.y + EMAIL.h / 2} />

              <GuideRing frame={frame} box={ring} opacity={guideOn} />
              <GuideArrow frame={frame} x={target.x} y={target.y} opacity={guideOn} />

              {/* Guide card */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: 844 - cardH,
                  height: cardH,
                  background: "#FFFFFF",
                  borderTopLeftRadius: 20,
                  borderTopRightRadius: 20,
                  boxShadow: "0 -8px 30px rgba(17,17,17,0.12)",
                  overflow: "hidden",
                  translate: `0 ${(1 - T(frame, 22, 32, ease)) * 220}px`,
                }}
              >
                {step >= 0 ? (
                  <div style={{ opacity: cardIn, translate: `0 ${(1 - cardIn) * 12}px` }}>
                    <CardBody i={step} frame={frame} stream={stream} />
                  </div>
                ) : null}
              </div>
              <Ripple frame={frame} at={86} x={OPEN_GMAIL.x} y={OPEN_GMAIL.y} size={100} />

              {/* A neutral compose sheet, already filled in */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: 60,
                  bottom: 0,
                  background: "#FFFFFF",
                  borderTopLeftRadius: 18,
                  borderTopRightRadius: 18,
                  boxShadow: "0 -10px 40px rgba(17,17,17,0.18)",
                  translate: `0 ${(1 - compose) * 800}px`,
                }}
              >
                <div style={{ height: 52, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px 0 18px" }}>
                  <span style={{ fontSize: 15, color: "#737373", fontWeight: 600 }}>Cancel</span>
                  <span style={{ fontSize: 17, fontWeight: 700, color: "#111" }}>New message</span>
                  <div style={{ height: 34, padding: "0 16px", borderRadius: 17, background: "#111", color: "#fff", display: "flex", alignItems: "center", fontSize: 15, fontWeight: 700, scale: pressed(frame, 106) }}>
                    Send
                  </div>
                </div>
                {[
                  ["To", ADDRESS],
                  ["Subject", "Moving help"],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", gap: 10, padding: "12px 18px", borderTop: "1px solid #E8E8E8", fontSize: 15 }}>
                    <span style={{ color: "#737373", width: 60 }}>{k}</span>
                    <span style={{ color: "#111", fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
                <div style={{ padding: "14px 18px", borderTop: "1px solid #E8E8E8", fontSize: 16, lineHeight: "24px", color: "#111" }}>{MESSAGE}</div>
              </div>
              <Ripple frame={frame} at={106} x={SEND.x} y={SEND.y} dark />
              {touch ? (
                // Times are guide units (30/s), so the dot runs on the same retimed clock as the take.
                <TouchDot
                  s={frame / 30}
                  from={0.05}
                  to={112 / 30}
                  stops={[
                    { t: 0, x: 250, y: 560 },
                    { t: 7 / 30, x: VIEW_LISTING.x, y: VIEW_LISTING.y, tap: true },
                    { t: 50 / 30, x: REPLY.x + REPLY.w / 2, y: REPLY.y + REPLY.h / 2, tap: true },
                    { t: 72 / 30, x: EMAIL.x + EMAIL.w / 2, y: EMAIL.y + EMAIL.h / 2, tap: true },
                    { t: 86 / 30, x: OPEN_GMAIL.x, y: OPEN_GMAIL.y, tap: true },
                    { t: 106 / 30, x: SEND.x, y: SEND.y, tap: true },
                  ]}
                />
              ) : null}
            </div>
          </div>
        </Phone>
      </AbsoluteFill>
      <Burst frame={frame} at={114} hold={9} reel={reel} />
    </AbsoluteFill>
  );
};
