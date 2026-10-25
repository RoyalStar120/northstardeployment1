import React from "react";
import { Series, useVideoConfig } from "remotion";
import { COMPANION_SEC, CompanionScene, NOTECH_SEC, NoTechScene } from "./CompanionScenes";
import { GETJOB_SEC, GetJobScene, GUIDE4_SEC, GuideScene } from "./JobScenes";
import { HOOK_SEC, HookScene, LOCKUP4_SEC, LockupScene } from "./LogoScenes";
import { MAP4_SEC, MapScene, WIFI_SEC, WifiScene } from "./MapScenes";

// Round-4 15 s film (docs/shotlist.md): three ALL-CAPS promises, each proven right away in the app.
// Scenes are timed in seconds, so the same timeline renders 16:9 and the 9:16 reel at 60 fps.
export const NorthstarLaunch4: React.FC = () => {
  const { fps } = useVideoConfig();
  const f = (sec: number) => Math.round(sec * fps);
  return (
    <Series>
      <Series.Sequence name="S1 Logo hook" durationInFrames={f(HOOK_SEC)}>
        <HookScene />
      </Series.Sequence>
      <Series.Sequence name="S2 GET A JOB" durationInFrames={f(GETJOB_SEC)}>
        <GetJobScene />
      </Series.Sequence>
      <Series.Sequence name="S3 Job guide" durationInFrames={f(GUIDE4_SEC)}>
        <GuideScene />
      </Series.Sequence>
      <Series.Sequence name="S4 NO TECH SKILLS REQUIRED" durationInFrames={f(NOTECH_SEC)}>
        <NoTechScene />
      </Series.Sequence>
      <Series.Sequence name="S5 Companion" durationInFrames={f(COMPANION_SEC)}>
        <CompanionScene />
      </Series.Sequence>
      <Series.Sequence name="S6 WIFI INCLUDED" durationInFrames={f(WIFI_SEC)}>
        <WifiScene />
      </Series.Sequence>
      <Series.Sequence name="S7 Map: Wi-Fi + offline" durationInFrames={f(MAP4_SEC)}>
        <MapScene />
      </Series.Sequence>
      <Series.Sequence name="S8 Lockup" durationInFrames={f(LOCKUP4_SEC)}>
        <LockupScene />
      </Series.Sequence>
    </Series>
  );
};
