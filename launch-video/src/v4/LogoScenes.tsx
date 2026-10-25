import React from "react";
import { AbsoluteFill } from "remotion";
import { blurIn, blurOut, eInOut, N, NSMark, statement, tw, TypeOn, useSec, useStage } from "./kit";
import { fontFamily } from "../theme";

// S1 · Logo hook (1.4 s): soft aura, the N★ tile blurs in, "Northstar" types on beside it, then blurs out.
export const HOOK_SEC = 1.4;

export const HookScene: React.FC = () => {
  const s = useSec();
  const { reel } = useStage();
  const mark = reel ? 150 : 160;
  const size = reel ? 104 : 128;
  const markIn = tw(s, 0.1, 0.6);
  const out = blurOut(s, 1.15, 0.25);
  return (
    <AbsoluteFill style={{ background: N.warm, overflow: "hidden" }}>
      {/* Aura: one amber glow and one navy glow, drifting slowly */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(40% 45% at ${38 + s * 6}% 42%, rgba(255,212,59,0.28) 0%, rgba(255,212,59,0) 70%),
                       radial-gradient(45% 50% at ${66 - s * 5}% 62%, rgba(27,39,62,0.12) 0%, rgba(27,39,62,0) 70%)`,
          filter: "blur(20px)",
        }}
      />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", scale: String(1 + s * 0.022), ...out }}>
        <div style={{ display: "flex", alignItems: "center", gap: mark * 0.22 }}>
          <NSMark size={mark} style={{ opacity: markIn, filter: `blur(${(1 - markIn) * 20}px)`, scale: String(1.2 - 0.2 * markIn) }} />
          <span style={statement(size)}>
            <TypeOn text="Northstar" s={s} at={0.6} hideCaretAt={1.3} />
          </span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// S8 · Lockup (1.2 s): the tile blurs in big, slides left as "Northstar" slides out from behind it; gray subline; hold.
export const LOCKUP4_SEC = 1.2;

export const LockupScene: React.FC = () => {
  const s = useSec();
  const { reel } = useStage();
  const mark = reel ? 150 : 150;
  const size = reel ? 92 : 104;
  const markIn = tw(s, 0, 0.4);
  const open = tw(s, 0.32, 0.75, eInOut);
  return (
    <AbsoluteFill style={{ background: N.bright, justifyContent: "center", alignItems: "center", scale: String(1 + s * 0.0125) }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <NSMark size={mark} style={{ opacity: markIn, filter: `blur(${(1 - markIn) * 20}px)`, scale: String(1.4 - 0.4 * markIn) }} />
        {/* Width-driven reveal keeps the pair centered as the word slides out */}
        <div style={{ overflow: "hidden", maxWidth: open * (reel ? 560 : 640) }}>
          <span style={{ ...statement(size), display: "inline-block", paddingLeft: mark * 0.22, translate: `${(1 - open) * -60}px 0`, opacity: open }}>Northstar</span>
        </div>
      </div>
      <div style={{ position: "absolute", top: "50%", marginTop: mark * 0.75, fontFamily, fontWeight: 500, fontSize: reel ? 34 : 30, color: N.gray, ...blurIn(s, 0.6, 0.4) }}>
        Help is closer than you think.
      </div>
    </AbsoluteFill>
  );
};
