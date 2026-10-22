import "@fontsource-variable/inter";

import { useEffect, useState } from "react";
import {
  AbsoluteFill, Audio, continueRender, delayRender, interpolate, Sequence, staticFile, useCurrentFrame,
} from "remotion";

import { EASE_IN_OUT, FPS } from "./kit.jsx";
import { Cta, Devices, Flow, Hook, Intro, Ipb, Privacy, Thesis, Tools } from "./scenes.jsx";
import timeline from "./timeline.json";

export { FPS };
export const TAIL = 2; // seconds after the last line, for the music's final chord

const SCENES = { hook: Hook, ipb: Ipb, intro: Intro, tools: Tools, thesis: Thesis, flow: Flow, privacy: Privacy, devices: Devices, cta: Cta };
const FADE = 12;

// Frame offsets for each scene; the last one also holds the tail.
let cursor = 0;
const PLAN = timeline.map((s, i) => {
  const len = Math.round((s.dur + (i === timeline.length - 1 ? TAIL : 0)) * FPS);
  const item = { ...s, from: cursor, len };
  cursor += len;
  return item;
});

function SceneFrame({ len, last, children }) {
  const f = useCurrentFrame();
  // Every scene dissolves out with a slight blur and push-back, like a keynote cut.
  const out = last ? 0 : interpolate(f, [len - FADE, len], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_IN_OUT });
  const end = last ? interpolate(f, [len - 20, len], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
  return (
    <AbsoluteFill style={{ opacity: (1 - out) * end, filter: `blur(${out * 10}px)`, transform: `scale(${1 - out * 0.03})` }}>
      {children}
    </AbsoluteFill>
  );
}

function Ambient() {
  const f = useCurrentFrame();
  const x = 50 + Math.sin(f / 90) * 20;
  return (
    <AbsoluteFill style={{
      background: `radial-gradient(1200px 900px at ${x}% -5%, rgba(191,90,242,0.13), transparent 60%),
                   radial-gradient(1000px 800px at ${100 - x}% 105%, rgba(255,105,97,0.10), transparent 60%), #000`,
    }} />
  );
}

export function Promo() {
  const [handle] = useState(() => delayRender("fonts"));
  useEffect(() => {
    document.fonts.load('700 100px "Inter Variable"').then(() => continueRender(handle));
  }, [handle]);

  return (
    <AbsoluteFill style={{ background: "#000", color: "#f5f5f7" }}>
      <Ambient />
      <Audio src={staticFile("music.wav")} volume={0.42} />
      {PLAN.map((s, i) => {
        const Scene = SCENES[s.key];
        return (
          <Sequence key={s.key} from={s.from} durationInFrames={s.len} name={s.key}>
            <SceneFrame len={s.len} last={i === PLAN.length - 1}><Scene words={s.words} /></SceneFrame>
            <Audio src={staticFile(`vo/${s.key}.mp3`)} volume={1} />
          </Sequence>
        );
      })}
      {PLAN.slice(1).map((s) => (
        <Sequence key={`w-${s.key}`} from={Math.max(0, s.from - 8)} durationInFrames={20}>
          <Audio src={staticFile("whoosh.wav")} volume={0.22} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
