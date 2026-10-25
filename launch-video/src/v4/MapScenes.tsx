import React from "react";
import { AbsoluteFill, Easing, interpolate } from "remotion";
import { Phone, phoneHeight, Screen } from "../components";
import { fontFamily } from "../theme";
import {
  blurIn,
  blurOut,
  caps,
  DotGrid,
  eInOut,
  Icon,
  N,
  TouchDot,
  tw,
  useSec,
  useStage,
} from "./kit";

// S6 · WIFI INCLUDED (1.0 s): dot grid; caps with an amber Wi-Fi chip between the words.
export const WIFI_SEC = 1.0;

export const WifiScene: React.FC = () => {
  const s = useSec();
  const { W, H, reel } = useStage();
  const size = reel ? 150 : 150;
  // Small objects may spring once, with ≤4% overshoot (style guide §10.8).
  const chip = interpolate(s, [0.28, 0.62], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.34, 1.25, 0.64, 1),
  });
  const Chip = (
    <div
      style={{
        width: size * 1.05,
        height: size * 0.82,
        borderRadius: size * 0.24,
        background: N.amber,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 14px 34px rgba(233,168,15,0.35)",
        scale: String(0.6 + 0.4 * chip),
        opacity: Math.min(1, chip * 2.5),
        rotate: `${(1 - chip) * -12}deg`,
      }}
    >
      <Icon name="wifi" size={size * 0.62} />
    </div>
  );
  return (
    <AbsoluteFill style={{ background: N.bright, overflow: "hidden" }}>
      <DotGrid s={s} W={W} H={H} />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          scale: String(1 + s * 0.03),
          ...blurOut(s, 0.8, 0.2, 16),
        }}
      >
        {reel ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: size * 0.18,
            }}
          >
            <div
              style={{ display: "flex", alignItems: "center", gap: size * 0.2 }}
            >
              <span style={{ ...caps(size), ...blurIn(s, 0.05, 0.4) }}>
                Wifi
              </span>
              {Chip}
            </div>
            <span style={{ ...caps(size), ...blurIn(s, 0.15, 0.4) }}>
              included
            </span>
          </div>
        ) : (
          <div
            style={{ display: "flex", alignItems: "center", gap: size * 0.2 }}
          >
            <span style={{ ...caps(size), ...blurIn(s, 0.05, 0.4) }}>Wifi</span>
            {Chip}
            <span style={{ ...caps(size), ...blurIn(s, 0.15, 0.4) }}>
              included
            </span>
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// S7 · Map (2.6 s): tap the real Wi-Fi chip → Wi-Fi spots; Filters sheet slides up on Offline →
// Download → "Downloading..." → "Saved" (the app's real button states); "Opens with no signal." chip.
export const MAP4_SEC = 2.6;

// Measured on the 390x844 captures (scripts/capture-screens-v4.mjs + the images).
const WIFI_CHIP = { x: 217, y: 90 };
const OFFLINE_SEG = { x: 313, y: 228 };
const DOWNLOAD = { x: 195, y: 367 };
const SHEET_TOP = 78;
// Wi-Fi pins on map-wifi.png, for the arrival rings.
const PINS = [
  [104, 341],
  [172, 321],
  [156, 354],
  [214, 300],
  [226, 346],
  [267, 309],
  [169, 384],
  [205, 429],
  [95, 468],
  [124, 488],
  [221, 468],
  [243, 543],
  [138, 536],
];

export const MapScene: React.FC = () => {
  const s = useSec();
  const { H, reel, cx, cy } = useStage();
  const phoneW = reel ? 640 : 430;
  const PH = phoneHeight(phoneW);
  const pLeft = cx - phoneW / 2;
  const pTop = reel ? (H - PH) / 2 - 90 : cy - PH / 2 + 20;
  const settle = tw(s, 0, 0.6);
  const wifi = tw(s, 0.6, 0.85, eInOut);
  const sheet = tw(s, 1.15, 1.5);
  const saved = tw(s, 2.05, 2.2, eInOut);
  const downloading = interpolate(s, [1.78, 1.84, 2.05, 2.12], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{ background: N.warm, perspective: 2000, overflow: "hidden" }}
    >
      <AbsoluteFill
        style={{
          transform: `rotateX(${(1 - settle) * 16}deg) rotateZ(${(1 - settle) * 5}deg)`,
          scale: String((0.9 + 0.1 * settle) * (1 + s * 0.012)),
          opacity: Math.min(1, settle * 3),
          filter: `blur(${(1 - Math.min(1, settle * 2)) * 10}px)`,
        }}
      >
        <Phone width={phoneW} style={{ left: pLeft, top: pTop }}>
          <div style={{ position: "absolute", inset: 0 }}>
            <Screen name="map-chips" />
            <div style={{ position: "absolute", inset: 0, opacity: wifi }}>
              <Screen name="map-wifi" />
            </div>
            {/* Wi-Fi spots arrive one by one */}
            {PINS.map(([x, y], i) => {
              const k = tw(s, 0.72 + i * 0.045, 1.12 + i * 0.045);
              return k > 0 && k < 1 ? (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: x - 16,
                    top: y - 16,
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    border: `3px solid ${N.amber}`,
                    scale: String(0.6 + k * 1.2),
                    opacity: 1 - k,
                  }}
                />
              ) : null;
            })}
            {/* Filters sheet (real capture) slides up; the map dims behind it */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                opacity: sheet,
                clipPath: `inset(0 0 ${844 - SHEET_TOP}px 0)`,
              }}
            >
              <Screen name="map-offline" />
            </div>
            <div
              style={{
                position: "absolute",
                inset: 0,
                clipPath: `inset(${SHEET_TOP}px 0 0 0)`,
                translate: `0 ${(1 - sheet) * 780}px`,
              }}
            >
              <Screen name="map-offline" />
              <div style={{ position: "absolute", inset: 0, opacity: saved }}>
                <Screen name="map-saved" />
              </div>
              {/* The app's real "Downloading..." state, held long enough to read */}
              <div
                style={{
                  position: "absolute",
                  left: DOWNLOAD.x - 110,
                  top: DOWNLOAD.y - 18,
                  width: 220,
                  height: 36,
                  background: "#F2F2F2",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily,
                  fontSize: 15,
                  fontWeight: 700,
                  color: N.ink,
                  opacity: downloading,
                }}
              >
                Downloading...
                <div
                  style={{
                    marginTop: 4,
                    width: 120,
                    height: 3,
                    borderRadius: 2,
                    background: "#E2E2E2",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${tw(s, 1.8, 2.05) * 100}%`,
                      height: "100%",
                      background: N.ink,
                    }}
                  />
                </div>
              </div>
            </div>
            <TouchDot
              s={s}
              from={0.3}
              to={2.0}
              stops={[
                { t: 0.3, x: 300, y: 300 },
                { t: 0.55, x: WIFI_CHIP.x, y: WIFI_CHIP.y, tap: true },
                { t: 1.45, x: OFFLINE_SEG.x, y: OFFLINE_SEG.y, tap: true },
                { t: 1.78, x: DOWNLOAD.x, y: DOWNLOAD.y, tap: true },
              ]}
            />
          </div>
        </Phone>
      </AbsoluteFill>
      {/* Floating chip: works with no signal. Position on the wrapper: blurIn's rise `translate` would
          override the reel centering. */}
      <div
        style={{
          position: "absolute",
          ...(reel
            ? { left: cx, top: pTop + PH + 40, translate: "-50% 0" }
            : { left: pLeft + phoneW + 60, top: cy - 36 }),
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "12px 24px 12px 12px",
            borderRadius: 999,
            background: "#FFFFFF",
            boxShadow: "0 14px 40px rgba(17,17,17,0.12)",
            fontFamily,
            fontWeight: 700,
            fontSize: reel ? 38 : 32,
            color: N.ink,
            ...blurIn(s, 2.15, 0.4),
          }}
        >
          <div
            style={{
              width: reel ? 56 : 50,
              height: reel ? 56 : 50,
              borderRadius: 14,
              background: N.tile,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="wifi_off" size={reel ? 34 : 30} color={N.amber} />
          </div>
          Opens with no signal.
        </div>
      </div>
    </AbsoluteFill>
  );
};
