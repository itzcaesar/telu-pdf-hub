import { FileText } from "lucide-react";
import { Easing, interpolate, interpolateColors, useCurrentFrame } from "remotion";

export const FPS = 30;
// Apple-style "expo out": fast start, long soft landing.
export const EASE = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);

export const COLORS = {
  red: "#ff453a", tint: "#c8102e", blue: "#0a84ff", green: "#30d158", orange: "#ff9f0a", indigo: "#5e5ce6",
  purple: "#bf5af2", gray: "#86868b", gray2: "#424245",
};
export const GRADIENT = "linear-gradient(100deg, #ff6961 0%, #ff9f0a 45%, #bf5af2 100%)";
export const FONT = '"Inter Variable", -apple-system, "SF Pro Display", sans-serif';

/** 0 -> 1 progress starting at frame `from`, lasting `dur` frames, eased. */
export function useProgress(from, dur = 24, easing = EASE) {
  const f = useCurrentFrame();
  return interpolate(f, [from, from + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });
}

/** Blur-to-sharp rise, the signature Apple keynote text reveal. Optional exit at `out`. */
export function Reveal({ at = 0, out, dur = 26, y = 46, blur = 18, style, children }) {
  const f = useCurrentFrame();
  const p = useProgress(at, dur);
  const q = out === undefined ? 0 : interpolate(f, [out, out + 14], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_IN_OUT,
  });
  return (
    <div style={{
      opacity: p * (1 - q),
      filter: `blur(${(1 - p) * blur + q * 12}px)`,
      transform: `translateY(${(1 - p) * y - q * 20}px) scale(${1 + (1 - p) * 0.03 - q * 0.02})`,
      ...style,
    }}>
      {children}
    </div>
  );
}

export function Gradient({ children, bg = GRADIENT }) {
  return (
    <span style={{ background: bg, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
      {children}
    </span>
  );
}

export const headline = (size = 120, color = "#f5f5f7") => ({
  fontFamily: FONT, fontSize: size, fontWeight: 700, letterSpacing: "-0.045em", lineHeight: 1.04,
  color, textAlign: "center", margin: 0,
});

export function Center({ children, style }) {
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", gap: 18, padding: "0 80px", ...style }}>
      {children}
    </div>
  );
}

export function Logo({ size = 200 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.27, display: "grid", placeItems: "center", color: "#fff",
      background: "linear-gradient(160deg, #e8354f, #b00d27)",
      boxShadow: `inset 0 ${size * 0.012}px 0 rgba(255,255,255,0.35), 0 ${size * 0.15}px ${size * 0.5}px rgba(200,16,46,0.45)`,
    }}>
      <FileText size={size * 0.52} strokeWidth={2.1} />
    </div>
  );
}

export function Tile({ color, Icon, size = 120 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.26, display: "grid", placeItems: "center", color: "#fff",
      background: `linear-gradient(160deg, ${color}dd, ${color})`, boxShadow: "inset 0 2px 0 rgba(255,255,255,0.3)",
    }}>
      <Icon size={size * 0.5} strokeWidth={2.2} />
    </div>
  );
}

/** Theme colours for the mini app UI; `dark` is 0..1 so the switch can animate. */
export function theme(dark) {
  const mix = (a, b) => interpolateColors(dark, [0, 1], [a, b]);
  return {
    bg: mix("#f2f2f7", "#000000"), surface: mix("#ffffff", "#1c1c1e"), label: mix("#000000", "#ffffff"),
    label2: mix("#6c6c70", "#aeaeb2"), sep: mix("rgba(60,60,67,0.18)", "rgba(84,84,88,0.5)"), fill: mix("#e3e3e8", "#2c2c2e"),
  };
}

/** A miniature of the real app's home screen. */
export function AppUI({ dark = 1, rows, scale = 1, wide = false }) {
  const c = theme(dark);
  return (
    <div style={{ width: "100%", height: "100%", background: c.bg, fontFamily: FONT, padding: `${70 * scale}px ${22 * scale}px`,
      overflow: "hidden", color: c.label }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 * scale, marginBottom: 18 * scale }}>
        <Logo size={44 * scale} />
        <div style={{ fontSize: 34 * scale, fontWeight: 700, letterSpacing: "-0.03em" }}>TelU PDF Hub</div>
      </div>
      <div style={{ height: 40 * scale, borderRadius: 20 * scale, background: c.fill, marginBottom: 22 * scale,
        display: "flex", alignItems: "center", padding: `0 ${14 * scale}px`, color: c.label2, fontSize: 17 * scale }}>
        Cari alat
      </div>
      <div style={{ display: wide ? "grid" : "block", gridTemplateColumns: "1fr 1fr", gap: 14 * scale }}>
        {rows.map((group) => (
          <div key={group.title} style={{ marginBottom: 20 * scale }}>
            <div style={{ fontSize: 15 * scale, fontWeight: 600, color: c.label2, margin: `0 ${12 * scale}px ${8 * scale}px` }}>
              {group.title}
            </div>
            <div style={{ background: c.surface, borderRadius: 20 * scale, overflow: "hidden" }}>
              {group.items.map(([name, color, Icon], i) => (
                <div key={name} style={{ display: "flex", alignItems: "center", gap: 12 * scale, padding: `${10 * scale}px ${14 * scale}px`,
                  borderTop: i ? `1px solid ${c.sep}` : "none" }}>
                  <Tile color={color} Icon={Icon} size={34 * scale} />
                  <div style={{ fontSize: 17 * scale, fontWeight: 500 }}>{name}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Phone({ children, width = 430 }) {
  const h = width * 2.06;
  return (
    <div style={{ width, height: h, borderRadius: width * 0.16, background: "#1d1d1f", padding: width * 0.03,
      boxShadow: "0 0 0 2px #3a3a3c, 0 60px 120px rgba(0,0,0,0.6)", position: "relative" }}>
      <div style={{ width: "100%", height: "100%", borderRadius: width * 0.135, overflow: "hidden", position: "relative" }}>
        {children}
        <div style={{ position: "absolute", top: width * 0.03, left: "50%", transform: "translateX(-50%)", width: width * 0.3,
          height: width * 0.085, borderRadius: 99, background: "#000" }} />
      </div>
    </div>
  );
}

export function Laptop({ children, width = 900 }) {
  const h = width * 0.62;
  return (
    <div style={{ width: width * 1.12, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ width, height: h, borderRadius: 26, background: "#1d1d1f", padding: 16,
        boxShadow: "0 0 0 2px #3a3a3c, 0 60px 120px rgba(0,0,0,0.6)" }}>
        <div style={{ width: "100%", height: "100%", borderRadius: 10, overflow: "hidden" }}>{children}</div>
      </div>
      <div style={{ width: "100%", height: 26, borderRadius: "0 0 30px 30px",
        background: "linear-gradient(#d1d1d6, #8e8e93)", boxShadow: "0 30px 60px rgba(0,0,0,0.5)" }} />
    </div>
  );
}
