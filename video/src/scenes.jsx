import {
  ArrowRight, Check, Combine, FileArchive, FileDown, FileText, Image, Lock, Merge, PenLine, Presentation,
  ScanText, Scissors, Stamp,
} from "lucide-react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import {
  AppUI, Center, COLORS, EASE, EASE_IN_OUT, FONT, FPS, Gradient, GRADIENT, headline, Laptop, Logo, Phone, Reveal,
  Tile, useProgress,
} from "./kit.jsx";

const at = (words, i) => Math.round(words[i].t * FPS);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };

const HOME_ROWS = [
  { title: "Konversi ke PDF", items: [["Word ke PDF", COLORS.blue, FileText], ["Gambar ke PDF", COLORS.blue, Image],
    ["PowerPoint ke PDF", COLORS.blue, Presentation]] },
  { title: "Halaman", items: [["Gabung PDF", COLORS.orange, Merge], ["Pisah PDF", COLORS.orange, Scissors],
    ["Watermark PDF", COLORS.orange, Stamp]] },
  { title: "Optimasi & Analisis", items: [["Kompres PDF", COLORS.indigo, FileDown], ["OCR PDF", COLORS.indigo, ScanText]] },
];

// 1. Assignments. Slides. Your thesis. All PDFs. All due tonight.
export function Hook({ words }) {
  const lines = [[0, "Assignments."], [1, "Slides."], [2, "Your thesis."]];
  const pdfs = at(words, 4);
  return (
    <>
      <Center style={{ gap: 6 }}>
        {lines.map(([i, text]) => (
          <Reveal key={text} at={at(words, i)} out={pdfs - 8}>
            <h1 style={headline(150)}>{text}</h1>
          </Reveal>
        ))}
      </Center>
      <Center>
        <Reveal at={pdfs} dur={30}>
          <h1 style={headline(230)}><Gradient>All PDFs.</Gradient></h1>
        </Reveal>
        <Reveal at={at(words, 6)}>
          <p style={headline(84, COLORS.gray)}>All due <span style={{ color: "#f5f5f7" }}>tonight.</span></p>
        </Reveal>
      </Center>
    </>
  );
}

// 2. IPB has its own PDF Hub. Telkom University deserved one too.
export function Ipb({ words }) {
  const swap = at(words, 6);
  const card = useProgress(at(words, 2), 30);
  return (
    <>
      <Center>
        <Reveal at={0} out={swap - 10}><p style={headline(70, COLORS.gray)}>IPB has its own</p></Reveal>
        <Reveal at={at(words, 4)} out={swap - 10}><h1 style={headline(160)}>PDF Hub.</h1></Reveal>
        <div style={{
          marginTop: 60, opacity: card * interpolate(useCurrentFrame(), [swap - 10, swap + 4], [1, 0], clamp),
          transform: `translateY(${(1 - card) * 60}px) perspective(1400px) rotateX(${(1 - card) * 25}deg)`,
          width: 760, borderRadius: 34, background: "#1c1c1e", padding: "26px 30px", fontFamily: FONT,
          boxShadow: "0 40px 100px rgba(0,0,0,0.6)", borderBottom: "5px solid #f7c600",
        }}>
          <div style={{ color: COLORS.gray, fontSize: 26, marginBottom: 14 }}>pdf.ipb.ac.id</div>
          {["Bandingkan PDF", "Word ke PDF", "Gabung PDF"].map((t) => (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: 18, padding: "12px 0", color: "#f5f5f7", fontSize: 34, fontWeight: 600 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: "#2c2c2e" }} />{t}
            </div>
          ))}
        </div>
      </Center>
      <Center>
        <Reveal at={swap}><h1 style={headline(150)}>Telkom University</h1></Reveal>
        <Reveal at={at(words, 8)}><p style={headline(96)}><Gradient>deserved one too.</Gradient></p></Reveal>
      </Center>
    </>
  );
}

// 3. Introducing, TelU PDF Hub.
export function Intro({ words }) {
  const { fps } = useVideoConfig();
  const f = useCurrentFrame();
  const logo = spring({ frame: f - 6, fps, config: { damping: 18, mass: 0.9 } });
  const name = "TelU PDF Hub";
  const start = at(words, 1);
  return (
    <Center style={{ gap: 40 }}>
      <Reveal at={0} y={20}><p style={headline(56, COLORS.gray)}>Introducing</p></Reveal>
      <div style={{ transform: `scale(${0.6 + logo * 0.4})`, opacity: logo, filter: `blur(${(1 - logo) * 20}px)` }}>
        <Logo size={260} />
      </div>
      <h1 style={{ ...headline(150), display: "flex" }}>
        {name.split("").map((ch, i) => {
          const p = interpolate(f, [start + i * 1.6, start + i * 1.6 + 18], [0, 1], { ...clamp, easing: EASE });
          return (
            <span key={i} style={{ opacity: p, filter: `blur(${(1 - p) * 14}px)`, transform: `translateY(${(1 - p) * 30}px)`,
              display: "inline-block", whiteSpace: "pre" }}>{ch}</span>
          );
        })}
      </h1>
    </Center>
  );
}

// 4. Thirty-seven tools. All free. Convert. Merge. Compress. Sign.
export function Tools({ words }) {
  const f = useCurrentFrame();
  const count = Math.round(interpolate(f, [at(words, 0), at(words, 0) + 24], [0, 37], { ...clamp, easing: EASE }));
  const shift = useProgress(at(words, 4) - 6, 30);
  const verbs = [[4, "Convert.", FileText, COLORS.blue], [5, "Merge.", Merge, COLORS.orange],
    [6, "Compress.", FileDown, COLORS.indigo], [7, "Sign.", PenLine, COLORS.purple]];
  const grid = [[FileText, COLORS.blue], [Merge, COLORS.orange], [FileDown, COLORS.indigo], [PenLine, COLORS.purple],
    [Image, COLORS.green], [Scissors, COLORS.orange], [ScanText, COLORS.indigo], [Lock, COLORS.purple],
    [Presentation, COLORS.blue], [Stamp, COLORS.orange], [FileArchive, COLORS.green], [Combine, COLORS.orange]];
  const active = verbs.findLastIndex(([i]) => f >= at(words, i));
  return (
    <>
      <Center style={{ transform: `translateY(${-shift * 560}px) scale(${1 - shift * 0.45})` }}>
        <Reveal at={at(words, 0)} dur={30}>
          <div style={{ ...headline(520), lineHeight: 0.9 }}><Gradient>{count}</Gradient></div>
        </Reveal>
        <Reveal at={at(words, 1)}><p style={headline(110)}>tools.</p></Reveal>
        <Reveal at={at(words, 2)}><p style={headline(80, COLORS.gray)}>All free.</p></Reveal>
      </Center>
      <div style={{ position: "absolute", top: 820, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 60 }}>
        <div style={{ position: "relative", height: 150, width: "100%" }}>
          {verbs.map(([i, text], k) => (
            <Reveal key={text} at={at(words, i)} out={k < 3 ? at(words, verbs[k + 1][0]) - 6 : undefined}
                    style={{ position: "absolute", inset: 0 }}>
              <h2 style={headline(140)}>{text}</h2>
            </Reveal>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 150px)", gap: 34, opacity: shift }}>
          {grid.map(([Icon, color], k) => {
            const p = interpolate(f, [at(words, 4) + k * 2, at(words, 4) + k * 2 + 20], [0, 1], { ...clamp, easing: EASE });
            const on = k === active;
            return (
              <div key={k} style={{ opacity: p * (active < 0 || on ? 1 : 0.35), transform: `scale(${(0.7 + p * 0.3) * (on ? 1.12 : 1)})`,
                transition: "none", filter: on ? `drop-shadow(0 18px 40px ${color}99)` : "none" }}>
                <Tile color={color} Icon={Icon} size={150} />
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// 5. It even checks your thesis format. Margins. Paper. Fonts. Before your advisor does.
export function Thesis({ words }) {
  const f = useCurrentFrame();
  const page = useProgress(at(words, 2), 40);
  const margins = useProgress(at(words, 6), 36, EASE_IN_OUT);
  const end = at(words, 9);
  const badge = (i, label) => {
    const p = useProgress(at(words, i), 22);
    return (
      <div style={{ opacity: p, transform: `translateY(${(1 - p) * 20}px)`, display: "flex", alignItems: "center", gap: 12,
        padding: "16px 28px", borderRadius: 40, background: "rgba(48,209,88,0.14)", color: COLORS.green, fontFamily: FONT,
        fontSize: 36, fontWeight: 600 }}>
        <Check size={34} strokeWidth={3} />{label}
      </div>
    );
  };
  const W = 600;
  const H = W * 1.414;
  const cm = W / 21;
  const dash = 2 * (W - 7 * cm + H - 7 * cm);
  return (
    <>
      <Reveal at={0} out={end - 10} style={{ position: "absolute", top: 210, left: 0, right: 0 }}>
        <h1 style={headline(92)}>It even checks your<br /><Gradient>thesis format.</Gradient></h1>
      </Reveal>
      <Reveal at={end} style={{ position: "absolute", top: 210, left: 0, right: 0 }}>
        <h1 style={headline(92)}>Before your<br /><Gradient>advisor does.</Gradient></h1>
      </Reveal>
      <div style={{ position: "absolute", top: 560, left: "50%", width: W, height: H, marginLeft: -W / 2,
        opacity: page, transform: `perspective(1600px) rotateX(${(1 - page) * 35}deg) translateY(${(1 - page) * 120}px)` }}>
        <div style={{ position: "absolute", inset: 0, background: "#fff", borderRadius: 12, boxShadow: "0 50px 120px rgba(0,0,0,0.6)" }} />
        {Array.from({ length: 14 }, (_, i) => (
          <div key={i} style={{ position: "absolute", left: 4 * cm, top: 4 * cm + i * 30, height: 12, borderRadius: 6,
            width: (i % 5 === 4 ? 0.55 : 1) * (W - 7 * cm), background: "#d1d1d6" }} />
        ))}
        {/* One paragraph that runs past the right margin, flagged in red. */}
        <div style={{ position: "absolute", left: 4 * cm, top: 4 * cm + 14 * 30 + 14, width: W - 4 * cm - 0.8 * cm, height: 70,
          background: "#d1d1d6", borderRadius: 6, opacity: 0.9 }} />
        <div style={{ position: "absolute", left: 4 * cm - 8, top: 4 * cm + 14 * 30 + 6, width: W - 4 * cm - 0.8 * cm + 16, height: 86,
          borderRadius: 10, background: "rgba(255,69,58,0.18)", border: "3px solid #ff453a",
          opacity: interpolate(f, [at(words, 6) + 30, at(words, 6) + 40], [0, 1], clamp) }} />
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          <rect x={4 * cm} y={4 * cm} width={W - 7 * cm} height={H - 7 * cm} fill="none" stroke="#ff9f0a" strokeWidth="3"
                strokeDasharray={`${dash}`} strokeDashoffset={dash * (1 - margins)} />
        </svg>
        {[["4 cm", { left: 4 * cm / 2 - 30, top: H / 2 }], ["4 cm", { left: W / 2 - 34, top: 4 * cm / 2 - 14 }],
          ["3 cm", { left: W - 3 * cm / 2 - 30, top: H / 2 }], ["3 cm", { left: W / 2 - 34, top: H - 3 * cm / 2 - 14 }]]
          .map(([t, pos], k) => (
            <div key={k} style={{ position: "absolute", ...pos, fontFamily: FONT, fontSize: 26, fontWeight: 700, color: "#ff9f0a",
              opacity: interpolate(f, [at(words, 6) + 10 + k * 5, at(words, 6) + 20 + k * 5], [0, 1], clamp) }}>{t}</div>
          ))}
      </div>
      <div style={{ position: "absolute", top: 1500, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 18 }}>
        {badge(7, "A4")}
        {badge(8, "Times New Roman 12")}
      </div>
    </>
  );
}

// 6. Twenty files at once. Then straight into the next tool.
export function Flow({ words }) {
  const f = useCurrentFrame();
  const then = at(words, 4);
  const pills = [["Merge", Merge, COLORS.orange], ["Compress", FileDown, COLORS.indigo], ["Protect", Lock, COLORS.purple]];
  return (
    <>
      <Reveal at={0} out={then - 8} style={{ position: "absolute", top: 260, left: 0, right: 0 }}>
        <h1 style={headline(170)}><Gradient>20 files.</Gradient></h1>
        <p style={headline(84, COLORS.gray)}>At once.</p>
      </Reveal>
      <div style={{ position: "absolute", top: 760, left: "50%" }}>
        {Array.from({ length: 20 }, (_, i) => {
          const p = interpolate(f, [4 + i * 1.5, 4 + i * 1.5 + 22], [0, 1], { ...clamp, easing: EASE });
          const gather = interpolate(f, [then - 4, then + 16], [0, 1], { ...clamp, easing: EASE_IN_OUT });
          const angle = (i - 9.5) * 3.4 * (1 - gather);
          const x = (i - 9.5) * 24 * (1 - gather);
          return (
            <div key={i} style={{ position: "absolute", left: -110, top: 0, width: 220, height: 290, borderRadius: 22,
              background: "#f5f5f7", boxShadow: "0 20px 50px rgba(0,0,0,0.5)", opacity: p * (i < 19 ? 1 - gather : 1),
              transform: `translate(${x}px, ${(1 - p) * -600 + Math.abs(i - 9.5) * 10 * (1 - gather)}px) rotate(${angle}deg)`,
              transformOrigin: "50% 120%", display: "grid", placeItems: "center", color: COLORS.tint }}>
              <FileText size={90} strokeWidth={1.6} />
            </div>
          );
        })}
      </div>
      <Reveal at={then} style={{ position: "absolute", top: 260, left: 0, right: 0 }}>
        <h1 style={headline(110)}>Then straight into<br /><Gradient>the next tool.</Gradient></h1>
      </Reveal>
      <div style={{ position: "absolute", top: 1220, left: 0, right: 0, display: "flex", justifyContent: "center", alignItems: "center", gap: 14 }}>
        {pills.map(([name, Icon, color], k) => {
          const p = useProgress(at(words, 5) + k * 9, 22);
          return [
            k > 0 && <ArrowRight key={`a${k}`} size={44} color={COLORS.gray} style={{ opacity: p }} />,
            <div key={name} style={{ opacity: p, transform: `scale(${0.85 + p * 0.15})`, display: "flex", alignItems: "center", gap: 14,
              padding: "16px 26px 16px 16px", borderRadius: 999, background: "#1c1c1e", fontFamily: FONT, fontSize: 36,
              fontWeight: 600, color: "#f5f5f7" }}>
              <Tile color={color} Icon={Icon} size={60} />{name}
            </div>,
          ];
        })}
      </div>
    </>
  );
}

// 7. No ads. No login. Your files disappear in two hours.
export function Privacy({ words }) {
  const f = useCurrentFrame();
  const third = at(words, 4);
  const ring = interpolate(f, [third + 10, third + 100], [1, 0.08], { ...clamp, easing: EASE_IN_OUT });
  const ringIn = useProgress(third, 28);
  return (
    <>
      <Center style={{ gap: 0 }}>
        <Reveal at={at(words, 0)} out={third - 8}><h1 style={headline(200)}>No ads.</h1></Reveal>
        <Reveal at={at(words, 2)} out={third - 8}><h1 style={headline(200)}>No login.</h1></Reveal>
      </Center>
      <Center style={{ gap: 50 }}>
        <div style={{ opacity: ringIn, transform: `scale(${0.85 + ringIn * 0.15})`, position: "relative", width: 420, height: 420 }}>
          <svg width="420" height="420" style={{ transform: "rotate(-90deg)" }}>
            <defs>
              <linearGradient id="g" x1="0" x2="1"><stop offset="0" stopColor="#ff6961" /><stop offset="1" stopColor="#bf5af2" /></linearGradient>
            </defs>
            <circle cx="210" cy="210" r="180" stroke="#2c2c2e" strokeWidth="26" fill="none" />
            <circle cx="210" cy="210" r="180" stroke="url(#g)" strokeWidth="26" fill="none" strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 180} strokeDashoffset={2 * Math.PI * 180 * (1 - ring)} />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", ...headline(150) }}>2h</div>
        </div>
        <Reveal at={third}><p style={headline(84)}>Your files <Gradient>disappear</Gradient><br />in two hours.</p></Reveal>
      </Center>
    </>
  );
}

// 8. On your phone. On your laptop. Light, or dark.
export function Devices({ words }) {
  const f = useCurrentFrame();
  const phone = useProgress(0, 40);
  const laptop = useProgress(at(words, 3), 40);
  const dark = interpolate(f, [at(words, 7), at(words, 7) + 18], [0, 1], { ...clamp, easing: EASE_IN_OUT });
  const float = Math.sin(f / 30) * 8;
  return (
    <>
      <div style={{ position: "absolute", top: 150, left: 0, right: 0 }}>
        <Reveal at={at(words, 0)}><p style={headline(78)}>On your phone.</p></Reveal>
        <Reveal at={at(words, 3)}><p style={headline(78)}>On your laptop.</p></Reveal>
        <Reveal at={at(words, 6)}><p style={headline(78, COLORS.gray)}>Light, or <span style={{ color: "#f5f5f7" }}>dark.</span></p></Reveal>
      </div>
      <div style={{ position: "absolute", left: 40, top: 1060 + float, opacity: laptop,
        transform: `perspective(2000px) rotateY(${(1 - laptop) * -30}deg) translateX(${(1 - laptop) * -200}px)` }}>
        <Laptop width={760}><AppUI dark={dark} rows={HOME_ROWS} scale={0.62} wide /></Laptop>
      </div>
      <div style={{ position: "absolute", right: 70, top: 640 - float, opacity: phone,
        transform: `perspective(2000px) rotateY(${(1 - phone) * 35}deg) translateY(${(1 - phone) * 300}px) rotate(4deg)` }}>
        <Phone width={360}><AppUI dark={dark} rows={HOME_ROWS} scale={0.78} /></Phone>
      </div>
    </>
  );
}

// 9. TelU PDF Hub. Free, for every student.
export function Cta({ words }) {
  const { fps } = useVideoConfig();
  const f = useCurrentFrame();
  const logo = spring({ frame: f, fps, config: { damping: 16 } });
  const url = useProgress(at(words, 6) + 10, 30);
  return (
    <Center style={{ gap: 36 }}>
      <div style={{ transform: `scale(${0.7 + logo * 0.3})`, opacity: logo }}><Logo size={230} /></div>
      <Reveal at={at(words, 0)}><h1 style={headline(140)}>TelU PDF Hub</h1></Reveal>
      <Reveal at={at(words, 3)}><p style={headline(70, COLORS.gray)}>Free, for every student.</p></Reveal>
      <div style={{ marginTop: 40, opacity: url, transform: `translateY(${(1 - url) * 30}px)`, padding: "26px 54px", borderRadius: 999,
        background: "rgba(255,255,255,0.08)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18), 0 20px 60px rgba(0,0,0,0.5)",
        fontFamily: FONT, fontSize: 64, fontWeight: 700, letterSpacing: "-0.03em" }}>
        <Gradient bg={GRADIENT}>pdf-telu.my.id</Gradient>
      </div>
      <p style={{ ...headline(30, "#6e6e73"), fontWeight: 500, letterSpacing: 0, opacity: url, marginTop: 20 }}>
        Inspired by IPB PDF Hub · Unofficial student project
      </p>
    </Center>
  );
}
