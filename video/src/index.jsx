import { Composition, registerRoot } from "remotion";

import { FPS, Promo, TAIL } from "./Promo.jsx";
import timeline from "./timeline.json";

const frames = Math.round((timeline.reduce((s, x) => s + x.dur, 0) + TAIL) * FPS);

function Root() {
  return <Composition id="TeluPromo" component={Promo} durationInFrames={frames} fps={FPS} width={1080} height={1920} />;
}

registerRoot(Root);
