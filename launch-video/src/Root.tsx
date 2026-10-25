import { Composition, Folder } from "remotion";
import { NorthstarLaunch } from "./NorthstarLaunch";
import { AskScene } from "./scenes/AskScene";
import { GatherScene } from "./scenes/GatherScene";
import { LockupScene } from "./scenes/LockupScene";
import { MapScene } from "./scenes/MapScene";
import { OfflineScene } from "./scenes/OfflineScene";
import { OpenScene } from "./scenes/OpenScene";
import { RollScene } from "./scenes/RollScene";
import { StoryScene } from "./scenes/StoryScene";
import { AskScene as V2Ask } from "./v2/AskScene";
import { FlashScene as V2Flash } from "./v2/FlashScene";
import { HelpWithScene as V2HelpWith } from "./v2/HelpWithScene";
import { LockupScene as V2Lockup } from "./v2/LockupScene";
import { NearYouScene as V2NearYou } from "./v2/NearYouScene";
import { NextStepScene as V2NextStep } from "./v2/NextStepScene";
import { NorthstarLaunch2 } from "./v2/NorthstarLaunch2";
import { TitleScene as V2Title } from "./v2/TitleScene";
import { CarouselScene as V3Carousel } from "./v3/CarouselScene";
import { DawnScene as V3Dawn } from "./v3/DawnScene";
import { JobGuideScene as V3JobGuide } from "./v3/JobGuideScene";
import { NorthstarLaunch3 } from "./v3/NorthstarLaunch3";
import { RightNowScene as V3RightNow } from "./v3/RightNowScene";
import { SayScene as V3Say, TurnScene as V3Turn } from "./v3/SayScenes";
import { NorthstarLaunch4 } from "./v4/NorthstarLaunch4";
import { VslEdit } from "./v5/VslEdit";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="NorthstarLaunch" component={NorthstarLaunch} durationInFrames={450} fps={30} width={1920} height={1080} />
      <Folder name="Launch-Scenes">
        <Composition id="Open" component={OpenScene} durationInFrames={96} fps={30} width={1920} height={1080} />
        <Composition id="Ask" component={AskScene} durationInFrames={78} fps={30} width={1920} height={1080} />
        <Composition id="Map" component={MapScene} durationInFrames={42} fps={30} width={1920} height={1080} />
        <Composition id="Roll" component={RollScene} durationInFrames={60} fps={30} width={1920} height={1080} />
        <Composition id="Story" component={StoryScene} durationInFrames={54} fps={30} width={1920} height={1080} />
        <Composition id="Offline" component={OfflineScene} durationInFrames={36} fps={30} width={1920} height={1080} />
        <Composition id="Gather" component={GatherScene} durationInFrames={30} fps={30} width={1920} height={1080} />
        <Composition id="Lockup" component={LockupScene} durationInFrames={54} fps={30} width={1920} height={1080} />
      </Folder>
      <Composition id="NorthstarLaunch2" component={NorthstarLaunch2} durationInFrames={450} fps={40} width={1920} height={1080} />
      <Folder name="Launch2-Scenes">
        <Composition id="V2-Title" component={V2Title} durationInFrames={69} fps={30} width={1920} height={1080} />
        <Composition id="V2-Ask" component={V2Ask} durationInFrames={81} fps={30} width={1920} height={1080} />
        <Composition id="V2-Flash" component={V2Flash} durationInFrames={15} fps={30} width={1920} height={1080} defaultProps={{ closer: false }} />
        <Composition id="V2-NearYou" component={V2NearYou} durationInFrames={81} fps={30} width={1920} height={1080} />
        <Composition id="V2-NextStep" component={V2NextStep} durationInFrames={90} fps={30} width={1920} height={1080} />
        <Composition id="V2-HelpWith" component={V2HelpWith} durationInFrames={57} fps={30} width={1920} height={1080} />
        <Composition id="V2-Lockup" component={V2Lockup} durationInFrames={45} fps={30} width={1920} height={1080} />
      </Folder>
      <Composition id="NorthstarLaunch3" component={NorthstarLaunch3} durationInFrames={450} fps={30} width={1920} height={1080} />
      <Folder name="Launch3-Scenes">
        <Composition id="V3-Dawn" component={V3Dawn} durationInFrames={45} fps={30} width={1920} height={1080} />
        <Composition id="V3-Say" component={V3Say} durationInFrames={27} fps={30} width={1920} height={1080} />
        <Composition id="V3-RightNow" component={V3RightNow} durationInFrames={108} fps={30} width={1920} height={1080} />
        <Composition id="V3-Turn" component={V3Turn} durationInFrames={30} fps={30} width={1920} height={1080} />
        <Composition id="V3-JobGuide" component={V3JobGuide} durationInFrames={138} fps={30} width={1920} height={1080} />
        <Composition id="V3-Carousel" component={V3Carousel} durationInFrames={42} fps={30} width={1920} height={1080} />
      </Folder>
      {/* 9:16 reel of round 3 at 60 fps (scenes are authored in 30 fps frames and scale via useT). */}
      <Composition id="NorthstarLaunch3Reel" component={NorthstarLaunch3} durationInFrames={900} fps={60} width={1080} height={1920} />
      <Folder name="Launch3-Reel-Scenes">
        <Composition id="V3R-Dawn" component={V3Dawn} durationInFrames={90} fps={60} width={1080} height={1920} />
        <Composition id="V3R-Say" component={V3Say} durationInFrames={54} fps={60} width={1080} height={1920} />
        <Composition id="V3R-RightNow" component={V3RightNow} durationInFrames={216} fps={60} width={1080} height={1920} />
        <Composition id="V3R-Turn" component={V3Turn} durationInFrames={60} fps={60} width={1080} height={1920} />
        <Composition id="V3R-JobGuide" component={V3JobGuide} durationInFrames={276} fps={60} width={1080} height={1920} />
        <Composition id="V3R-Carousel" component={V3Carousel} durationInFrames={84} fps={60} width={1080} height={1920} />
      </Folder>
      {/* Round 4: GET A JOB / NO TECH SKILLS REQUIRED / WIFI INCLUDED. 60 fps, timed in seconds. */}
      <Composition id="NorthstarLaunch4" component={NorthstarLaunch4} durationInFrames={900} fps={60} width={1920} height={1080} />
      <Composition id="NorthstarLaunch4Reel" component={NorthstarLaunch4} durationInFrames={900} fps={60} width={1080} height={1920} />
      {/* Round 5: VSL-style edit of the iPhone talking-head clip (not Northstar). 60 fps, original audio. */}
      <Composition id="VslEdit" component={VslEdit} durationInFrames={900} fps={60} width={1920} height={1080} />
    </>
  );
};
