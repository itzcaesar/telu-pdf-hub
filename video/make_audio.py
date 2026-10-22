"""Generate the voiceover (edge-tts), background music and sound effects for the promo video.

Writes into public/: vo/<scene>.mp3, music.wav, whoosh.wav, pop.wav, and src/timeline.json with
each scene's duration and word timings (for captions). Run: python make_audio.py
"""
import asyncio
import json
import wave
from pathlib import Path

import edge_tts
import numpy as np

HERE = Path(__file__).parent
PUBLIC = HERE / "public"
VOICE = "en-US-AndrewMultilingualNeural"
RATE = "-4%"  # Calm, unhurried, Apple-ad delivery.
SR = 44100
PAD = 0.7  # seconds of breathing room after each line

# Short Apple-commercial copy: one idea per scene.
SCENES = [
    ("hook", "Assignments. Slides. Your thesis. All PDFs. All due tonight."),
    ("ipb", "IPB has its own PDF Hub. Telkom University deserved one too."),
    ("intro", "Introducing, TelU PDF Hub."),
    ("tools", "Thirty-seven tools. All free. Convert. Merge. Compress. Sign."),
    ("thesis", "It even checks your thesis format. Margins. Paper. Fonts. Before your advisor does."),
    ("flow", "Twenty files at once. Then straight into the next tool."),
    ("privacy", "No ads. No login. Your files disappear in two hours."),
    ("devices", "On your phone. On your laptop. Light, or dark."),
    ("cta", "TelU PDF Hub. Free, for every student."),
]


async def voice(key, text):
    """Synthesize one line; return its duration and word timings (seconds)."""
    comm = edge_tts.Communicate(text, VOICE, rate=RATE, boundary="WordBoundary")
    audio, words = bytearray(), []
    async for chunk in comm.stream():
        if chunk["type"] == "audio":
            audio += chunk["data"]
        elif chunk["type"] == "WordBoundary":
            words.append({"t": chunk["offset"] / 1e7, "d": chunk["duration"] / 1e7, "w": chunk["text"]})
    (PUBLIC / "vo" / f"{key}.mp3").write_bytes(audio)
    # edge-tts streams 24 kHz / 48 kbps CBR MP3, so size gives the length.
    return len(audio) * 8 / 48000, words


def write_wav(path, x):
    x = np.clip(x, -1, 1)
    stereo = np.stack([x, x], axis=1) if x.ndim == 1 else x
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((stereo * 32767).astype(np.int16).tobytes())


def lowpass(x, cutoff):
    # One-pole low-pass, good enough to soften saw waves.
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc = (1 - a) * v + a * acc
        y[i] = acc
    return y


def piano(f, L):
    """Soft electric-piano-like note: a few decaying harmonics."""
    tt = np.arange(L) / SR
    tone = sum(np.sin(2 * np.pi * f * h * tt) * a for h, a in ((1, 1), (2, 0.35), (3, 0.12), (4, 0.05)))
    return tone * np.exp(-tt * 2.6) * np.minimum(1, tt / 0.004)


def music(seconds, drums_from, hit_at, bpm=92):
    """Apple-ad style bed: sparse piano over a soft pad, a pulse that enters at the reveal, a final chord hit."""
    n = int(seconds * SR)
    t = np.arange(n) / SR
    beat = 60 / bpm
    bar = beat * 4
    chords = [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]]  # C G Am F
    hz = lambda m: 440 * 2 ** ((m - 69) / 12)
    out = np.zeros(n)

    # Pad: detuned saws per chord, low-passed, with a slow swell.
    pad = np.zeros(n)
    for i in range(int(seconds / bar) + 1):
        s, e = int(i * bar * SR), min(int((i + 1) * bar * SR), n)
        if s >= n:
            break
        tt = t[s:e] - t[s]
        for m in chords[i % 4]:
            for det in (-0.12, 0.12):
                f = hz(m - 12) * 2 ** (det / 12)
                pad[s:e] += ((tt * f) % 1.0 * 2 - 1) * 0.05
        env = np.minimum(1, tt / 0.4) * np.minimum(1, (bar - tt) / 0.3)
        pad[s:e] *= env
    out += lowpass(pad, 700) * 0.6

    # Sparse piano: chord tones on quarter notes, sometimes resting, like an Apple ad bed.
    pattern = [0, None, 2, 1, 0, None, 2, None]
    for k in range(int(seconds / beat)):
        idx = pattern[k % 8]
        if idx is None:
            continue
        s = int(k * beat * SR)
        L = min(int(1.6 * SR), n - s)
        m = chords[int(k * beat / bar) % 4][idx] + 12
        out[s:s + L] += piano(hz(m), L) * 0.11

    # Pulse enters at the product reveal: soft kick on every beat, sub on the 1, quiet 16th hats.
    rng = np.random.default_rng(7)
    for k in range(int(seconds / beat)):
        at = k * beat
        if at < drums_from or at > hit_at - beat:
            continue
        s = int(at * SR)
        L = min(int(0.3 * SR), n - s)
        tt = np.arange(L) / SR
        out[s:s + L] += np.sin(2 * np.pi * (48 + 70 * np.exp(-tt * 35)) * tt) * np.exp(-tt * 14) * 0.42
        for h in range(4):
            hs = s + int(h * beat / 4 * SR)
            L = min(int(0.03 * SR), n - hs)
            if L > 0:
                out[hs:hs + L] += rng.uniform(-1, 1, L) * np.exp(-np.arange(L) / SR * 120) * (0.03 if h % 2 else 0.018)

    # Final hit: full C major chord, sub and a long piano ring.
    s = int(hit_at * SR)
    L = n - s
    if L > 0:
        tt = np.arange(L) / SR
        for m in (36, 48, 60, 64, 67, 72):
            out[s:s + L] += piano(hz(m), L) * 0.09
        out[s:s + L] += np.sin(2 * np.pi * 65.4 * tt) * np.exp(-tt * 1.2) * 0.3

    fade = np.minimum(1, np.minimum(t / 2.0, (seconds - t) / 1.5))
    return out * fade * 0.85


def whoosh():
    L = int(0.6 * SR)
    tt = np.arange(L) / SR
    noise = np.random.default_rng(1).uniform(-1, 1, L)
    sweep = np.zeros(L)
    acc = 0.0
    for i in range(L):  # Low-pass whose cutoff rises then falls.
        c = 300 + 4000 * np.sin(np.pi * tt[i] / tt[-1])
        a = np.exp(-2 * np.pi * c / SR)
        acc = (1 - a) * noise[i] + a * acc
        sweep[i] = acc
    return sweep * np.sin(np.pi * tt / tt[-1]) ** 2 * 0.9


def pop():
    L = int(0.12 * SR)
    tt = np.arange(L) / SR
    return np.sin(2 * np.pi * (900 - 2500 * tt) * tt) * np.exp(-tt * 40) * 0.6


async def main():
    (PUBLIC / "vo").mkdir(parents=True, exist_ok=True)
    timeline = []
    for key, text in SCENES:
        dur, words = await voice(key, text)
        timeline.append({"key": key, "text": text, "vo": dur, "dur": round(dur + PAD, 3), "words": words})
        print(f"{key:8} {dur:5.2f}s  {len(words)} words")
    total = sum(s["dur"] for s in timeline) + 2.0  # tail for the outro
    starts = {}
    acc = 0.0
    for s in timeline:
        starts[s["key"]] = acc
        acc += s["dur"]
    write_wav(PUBLIC / "music.wav", music(total, drums_from=starts["intro"], hit_at=starts["cta"]))
    write_wav(PUBLIC / "whoosh.wav", whoosh())
    write_wav(PUBLIC / "pop.wav", pop())
    (HERE / "src" / "timeline.json").write_text(json.dumps(timeline, indent=1), encoding="utf-8")
    print(f"total {total:.1f}s")


if __name__ == "__main__":
    asyncio.run(main())
