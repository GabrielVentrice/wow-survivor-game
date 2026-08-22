#!/usr/bin/env python3
"""
make_track.py — generates the background loop as a WAV.

Dark lofi: a downtempo boom-bap bed (tape wow, vinyl crackle, filtered and
saturated) carrying a gothic D-minor progression with a harmonic-minor
dominant — the Vampire Survivors / Castlevania colour, played at half the
speed and behind a lot more dust.

Everything is synthesised here, so the result is ours: no licence to check.

The loop is EXACTLY 32 bars long and it wraps: reverb and delay tails that run
past the end are added back onto the start, and every modulation LFO has a
period that divides the loop. `js/track.js` can play it with native
`loop = true` and there is no seam to hear.

Usage: python3 make_track.py out.wav
"""

import sys
import numpy as np
from scipy import signal

SR = 44100
BPM = 84.0
BEAT = 60.0 / BPM
BAR = 4.0 * BEAT
BARS = 32
LOOP = BARS * BAR                      # 91.428571 s
N = int(round(LOOP * SR))              # 4_032_000 samples, exact
TAIL = int(3.0 * SR)                   # room for tails, folded back to the start
TOT = N + TAIL

rng = np.random.default_rng(20260822)


# ---------------------------------------------------------------- utilities

def hz(m):
    return 440.0 * 2.0 ** ((m - 69) / 12.0)


def bus():
    return np.zeros((TOT, 2))


def place(b, sig, t, gain=1.0, pan=0.0):
    """Mix a mono signal into a stereo bus at time `t` (seconds)."""
    i = int(round(t * SR))
    if i >= TOT:
        return
    n = min(len(sig), TOT - i)
    l = gain * np.sqrt(0.5 * (1.0 - pan))
    r = gain * np.sqrt(0.5 * (1.0 + pan))
    b[i:i + n, 0] += sig[:n] * l
    b[i:i + n, 1] += sig[:n] * r


def wrap(b):
    """Fold the tail back onto the head so the loop closes on itself."""
    out = b[:N].copy()
    out[:TAIL] += b[N:N + TAIL]
    return out


def lp(x, f, order=2):
    sos = signal.butter(order, f / (SR / 2), btype="low", output="sos")
    return signal.sosfilt(sos, x, axis=0)


def hp(x, f, order=2):
    sos = signal.butter(order, f / (SR / 2), btype="high", output="sos")
    return signal.sosfilt(sos, x, axis=0)


def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo / (SR / 2), hi / (SR / 2)], btype="band", output="sos")
    return signal.sosfilt(sos, x, axis=0)


def env_ad(n, a, d, curve=1.0):
    t = np.arange(n) / SR
    atk = np.clip(t / max(a, 1e-6), 0, 1) ** curve
    return atk * np.exp(-t / d)


# ------------------------------------------------------------- instruments

def ks_pluck(f, dur, damp=0.494, bright=0.55):
    """Karplus-Strong. Harpsichord-ish when short and bright, guitar when not."""
    n = int(dur * SR)
    D = max(int(round(SR / f)), 8)
    exc = rng.uniform(-1, 1, D)
    k = max(int((1.0 - bright) * 8) + 1, 1)
    exc = np.convolve(exc, np.ones(k) / k, mode="same")
    out = np.empty(n)
    prev = 0.0
    idx = 0
    for i in range(n):
        v = exc[idx]
        out[i] = v
        exc[idx] = (v * damp + prev * (1.0 - damp)) * 0.9975
        prev = v
        idx += 1
        if idx == D:
            idx = 0
    return out * env_ad(n, 0.002, dur * 0.55)


def fm_bell(f, dur, ratio=2.0, index=2.6, decay=0.55, idecay=0.28):
    """Two-operator FM — the dusty Rhodes/bell lead."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    mod = np.sin(2 * np.pi * f * ratio * t) * index * np.exp(-t / idecay)
    y = np.sin(2 * np.pi * f * t + mod)
    return y * env_ad(n, 0.006, decay)


def bass_note(f, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = np.sin(2 * np.pi * f * t)
    y += 0.30 * np.sin(4 * np.pi * f * t) * np.exp(-t / 0.10)
    y += 0.16 * signal.sawtooth(2 * np.pi * f * t) * np.exp(-t / 0.22)
    e = np.clip(t / 0.008, 0, 1) * np.minimum(1.0, np.exp(-(t - dur * 0.7) / 0.09))
    y = y * e
    return lp(y, 900.0)


def organ(freqs, dur, detune=0.004):
    """Church-organ pad: drawbar harmonics, two detuned voices, slow swell."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    harm = [(1, 1.0), (2, 0.5), (3, 0.28), (4, 0.2), (6, 0.1), (8, 0.06)]
    vib = 1.0 + 0.0016 * np.sin(2 * np.pi * 4.7 * t)
    for f in freqs:
        for v in (-detune, detune):
            fv = f * (1.0 + v)
            for h, a in harm:
                y += a * np.sin(2 * np.pi * fv * h * t * vib)
    y /= max(len(freqs) * 2 * 2.2, 1.0)
    a = min(0.55, dur * 0.35)
    e = np.clip(t / a, 0, 1) * np.clip((dur - t) / 0.35, 0, 1)
    return lp(y * e, 2600.0)


def choir(freqs, dur):
    """Formant-ish 'aah' bed sitting under the organ."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for f in freqs:
        for det in (-0.006, 0.0, 0.007):
            ph = 2 * np.pi * f * (1 + det) * t + 3.0 * np.sin(2 * np.pi * 0.9 * t)
            y += signal.sawtooth(ph)
    y /= len(freqs) * 3
    y = bp(y, 300, 1500)
    a = min(0.9, dur * 0.4)
    e = np.clip(t / a, 0, 1) * np.clip((dur - t) / 0.6, 0, 1)
    return y * e


# ------------------------------------------------------------------- drums

def kick():
    n = int(0.42 * SR)
    t = np.arange(n) / SR
    f = 46.0 + 92.0 * np.exp(-t / 0.030)
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph) * np.exp(-t / 0.155)
    y += 0.22 * rng.normal(0, 1, n) * np.exp(-t / 0.0035)
    return lp(np.tanh(y * 1.4), 3200.0)


def snare():
    n = int(0.30 * SR)
    t = np.arange(n) / SR
    nz = bp(rng.normal(0, 1, n), 220, 5200)
    y = nz * np.exp(-t / 0.115)
    y += 0.45 * np.sin(2 * np.pi * 196 * t) * np.exp(-t / 0.075)
    y += 0.25 * np.sin(2 * np.pi * 291 * t) * np.exp(-t / 0.055)
    return lp(np.tanh(y * 1.1) * 0.75, 6800.0)


def hat(open_=False):
    d = 0.20 if open_ else 0.052
    n = int(d * SR)
    t = np.arange(n) / SR
    y = hp(rng.normal(0, 1, n), 6800.0, order=3)
    return y * np.exp(-t / (0.085 if open_ else 0.020)) * 0.5


def rim():
    n = int(0.09 * SR)
    t = np.arange(n) / SR
    y = bp(rng.normal(0, 1, n), 1200, 4200) * np.exp(-t / 0.012)
    y += 0.5 * np.sin(2 * np.pi * 1750 * t) * np.exp(-t / 0.010)
    return y * 0.5


KICK, SNARE, HAT_C, HAT_O, RIM = kick(), snare(), hat(), hat(True), rim()


# ------------------------------------------------------------------ arrange

# D minor, descending gothic line: Dm - C - Bb - A(harmonic-minor dominant).
# One chord per bar, phrase repeats every 4 bars.
PROG = [
    dict(root=50, chord=[62, 65, 69], pad=[50, 57, 62, 65]),          # Dm
    dict(root=48, chord=[60, 64, 67], pad=[48, 55, 60, 64]),          # C
    dict(root=46, chord=[58, 62, 65], pad=[46, 53, 58, 62]),          # Bb
    dict(root=45, chord=[57, 61, 64], pad=[45, 52, 57, 61]),          # A (C#)
]

# 16-beat lead phrase: (beat, duration in beats, midi)
LEAD = [
    (0.0, 1.5, 69), (1.5, 0.5, 70), (2.0, 1.0, 69), (3.0, 1.0, 65),
    (4.0, 1.5, 67), (5.5, 0.5, 69), (6.0, 2.0, 64),
    (8.0, 1.5, 65), (9.5, 0.5, 67), (10.0, 1.0, 65), (11.0, 1.0, 62),
    (12.0, 1.5, 73), (13.5, 0.5, 74), (14.0, 2.0, 69),
]

# 16th-step drum patterns
K_MAIN = [0, 6, 10]
K_VAR = [0, 6, 10, 14]
S_MAIN = [4, 12]


def section(bar):
    """The 32 bars breathe: two bars of nothing but organ, the beat walks in,
    two full sections split by a breakdown, and a turnaround that thins out so
    the wrap back to bar 0 reads as a drop and not as a cut."""
    if bar < 2:
        return "intro"
    if bar < 8:
        return "light"
    if bar < 16:
        return "full"
    if bar < 20:
        return "break"
    if bar < 30:
        return "full2"
    return "outro"


b_drum, b_bass, b_pad, b_pluck, b_lead, b_air = bus(), bus(), bus(), bus(), bus(), bus()
kick_times = []

for bar in range(BARS):
    t0 = bar * BAR
    ch = PROG[bar % 4]
    sec = section(bar)
    nxt = PROG[(bar + 1) % 4]

    # --- pad: organ every bar, choir doubles it from the first full section
    place(b_pad, organ([hz(m) for m in ch["pad"]], BAR * 1.04), t0, 0.30)
    if sec in ("full", "full2", "break"):
        place(b_pad, choir([hz(m + 12) for m in ch["chord"][:2]], BAR * 1.04), t0, 0.16)

    # --- bass: root on 1, octave push on the & of 2, root on 3, walk on the & of 4
    if sec != "break" or bar >= 18:
        place(b_bass, bass_note(hz(ch["root"]), BEAT * 1.5), t0, 0.62)
        place(b_bass, bass_note(hz(ch["root"] + 12), BEAT * 0.5), t0 + 1.5 * BEAT, 0.30)
        place(b_bass, bass_note(hz(ch["root"]), BEAT * 1.0), t0 + 2 * BEAT, 0.50)
        walk = ch["root"] + (1 if nxt["root"] > ch["root"] else -1)
        place(b_bass, bass_note(hz(walk), BEAT * 0.5), t0 + 3.5 * BEAT, 0.36)

    # --- harpsichord arpeggio, 8ths with a light swing
    if sec != "intro" and sec != "break":
        tones = [ch["chord"][0], ch["chord"][1], ch["chord"][2],
                 ch["chord"][1] + 12, ch["chord"][2], ch["chord"][1],
                 ch["chord"][0] + 12, ch["chord"][2]]
        soft = 0.42 if bar in (2, 3) or sec == "outro" else 1.0
        for i, m in enumerate(tones):
            sw = 0.055 * BEAT if i % 2 else 0.0
            g = 0.20 * soft * (1.0 if i % 2 == 0 else 0.72)
            place(b_pluck, ks_pluck(hz(m + 12), 0.65, bright=0.62),
                  t0 + i * 0.5 * BEAT + sw, g, pan=-0.35)

    # --- lead
    phrase = None
    if 8 <= bar < 16:
        phrase = bar - 8
    elif 20 <= bar < 28:
        phrase = bar - 20
    if phrase is not None:
        for beat, dur, m in LEAD:
            if not (phrase * 4 <= beat < (phrase + 1) * 4):
                continue
            t = (bar - phrase) * BAR + beat * BEAT
            d = dur * BEAT * 1.15
            place(b_lead, fm_bell(hz(m), d, ratio=2.0, index=2.4, decay=d * 0.5),
                  t, 0.26, pan=0.30)
            place(b_lead, fm_bell(hz(m + 12), d * 0.5, ratio=3.0, index=1.2,
                                  decay=d * 0.22), t, 0.07, pan=0.45)

    # --- drums
    step = BAR / 16.0
    if sec == "outro":
        # turnaround: kick keeps the pulse, a rim fill hands over to bar 0
        for st in ([0, 6, 10] if bar == 30 else [0, 6]):
            place(b_drum, KICK, t0 + st * step, 0.88)
            kick_times.append(t0 + st * step)
        if bar == 30:
            place(b_drum, SNARE, t0 + 4 * step, 0.52)
        for st in range(0, 12 if bar == 31 else 16, 2):
            sw = 0.30 * step if (st // 2) % 2 else 0.0
            place(b_drum, HAT_C, t0 + st * step + sw, 0.30 if st % 4 == 0 else 0.20)
        if bar == 31:
            for st, g in ((12, 0.34), (14, 0.44), (15, 0.30)):
                place(b_drum, RIM, t0 + st * step, g)
            place(b_drum, HAT_O, t0 + 15 * step, 0.22)
    elif sec in ("light", "full", "full2"):
        ks = K_VAR if bar % 4 == 3 and sec != "light" else K_MAIN
        for s in ks:
            t = t0 + s * step
            place(b_drum, KICK, t, 0.90)
            kick_times.append(t)
        if sec != "light":
            for s in S_MAIN:
                place(b_drum, SNARE, t0 + s * step, 0.68)
            if bar % 8 == 7:
                place(b_drum, RIM, t0 + 14 * step, 0.5)
                place(b_drum, RIM, t0 + 15 * step, 0.4)
        for s in range(0, 16, 2):
            sw = 0.30 * step if (s // 2) % 2 else 0.0
            g = 0.34 if s % 4 == 0 else 0.22
            place(b_drum, HAT_C, t0 + s * step + sw, g)
        if bar % 4 == 1:
            place(b_drum, HAT_O, t0 + 10 * step, 0.20)
    elif sec == "break" and bar >= 18:
        for s in range(0, 16, 4):
            place(b_drum, HAT_C, t0 + s * step, 0.18)

    # --- noise swell into each drop, and a soft impact on the downbeat
    if bar in (1, 7, 19):
        n = int(BAR * SR)
        t = np.arange(n) / SR
        sw = hp(rng.normal(0, 1, n), 900.0) * (t / (BAR)) ** 3
        place(b_air, sw, t0, 0.18)
    if bar in (8, 20):
        n = int(1.6 * SR)
        t = np.arange(n) / SR
        cy = hp(rng.normal(0, 1, n), 4200.0) * np.exp(-t / 0.45)
        place(b_air, cy, t0, 0.16)


# -------------------------------------------------------- space and glue

def reverb_ir(decay, cut, predelay):
    n = int(2.2 * SR)
    t = np.arange(n) / SR
    ir = np.stack([rng.normal(0, 1, n), rng.normal(0, 1, n)], axis=1)
    ir *= np.exp(-t / decay)[:, None]
    ir = lp(ir, cut)
    p = int(predelay * SR)
    ir[:p] = 0.0
    # unit energy, not unit peak: convolving with a 2s noise IR normalised by
    # peak multiplies the signal by hundreds
    return ir / np.sqrt(np.sum(ir ** 2, axis=0))


IR = reverb_ir(0.62, 4200.0, 0.022)


def send(b, amount, ir=IR):
    wet = np.stack([signal.fftconvolve(b[:, c], ir[:, c])[:TOT] for c in (0, 1)], axis=1)
    return b + wet * amount


def echo(b, delay, fb, mix, pan=0.0):
    d = int(delay * SR)
    out = np.zeros_like(b)
    tap = b.copy()
    g = 1.0
    for _ in range(6):
        g *= fb
        if g < 0.02:
            break
        tap = np.roll(tap, d, axis=0)
        tap[:d] = 0.0
        out += tap * g
    out = lp(out, 3200.0)
    if pan:
        out[:, 0] *= 1.0 - max(pan, 0)
        out[:, 1] *= 1.0 + min(pan, 0)
    return b + out * mix


b_pluck = echo(b_pluck, BEAT * 0.75, 0.34, 0.30)
b_lead = echo(b_lead, BEAT * 1.5, 0.30, 0.38)

b_pad = send(b_pad, 0.30)
b_pluck = send(b_pluck, 0.26)
b_lead = send(b_lead, 0.30)
b_drum = send(b_drum, 0.08)
b_air = send(b_air, 0.35)

# sidechain: the tonal bed breathes with the kick
duck = np.ones(TOT)
kd = int(0.34 * SR)
shape = 1.0 - 0.42 * np.exp(-np.arange(kd) / (0.11 * SR)) * (1 - np.exp(-np.arange(kd) / (0.004 * SR)))
for t in kick_times:
    i = int(round(t * SR))
    n = min(kd, TOT - i)
    duck[i:i + n] = np.minimum(duck[i:i + n], shape[:n])

for b in (b_pad, b_bass, b_pluck):
    b *= duck[:, None]

def active_dbrms(x):
    """RMS over the part of the bus that is actually sounding.

    A plain RMS punishes anything that plays in half the bars — the lead would
    be mixed 6 dB too loud to compensate for its own rests.
    """
    m = np.max(np.abs(x), axis=1)
    live = m > 1e-4
    if not live.any():
        return -120.0
    r = float(np.sqrt(np.mean(x[live] ** 2)))
    return 20 * np.log10(max(r, 1e-9))


# Where each bus sits, in dBFS, while it is playing. This IS the mix: every
# "it is too loud" adjustment happens in this table and nowhere else.
LEVELS = dict(drum=-15.5, bass=-17.0, pad=-21.5, pluck=-21.0, lead=-19.0, air=-30.0)

BUSES = dict(drum=b_drum, bass=b_bass, pad=b_pad, pluck=b_pluck, lead=b_lead, air=b_air)
mix = np.zeros((TOT, 2))
for nm, b in BUSES.items():
    cur = active_dbrms(b)
    g = 10 ** ((LEVELS[nm] - cur) / 20.0)
    print(f"  bus {nm:6s} {cur:7.1f} -> {LEVELS[nm]:6.1f} dBFS  (x{g:.2f})")
    mix += b * g

mix = wrap(mix)


def circ(x, fn, pad=int(2.0 * SR)):
    """Run a causal filter on the loop as if it were circular.

    sosfilt starts with zero state, so filtering the mix straight would leave a
    settling transient at sample 0 and a mismatched edge at the wrap — exactly
    the click the loop must not have.
    """
    y = fn(np.concatenate([x[-pad:], x], axis=0))
    return y[pad:]


# lofi voicing: shave the top, roll off the sub, saturate the whole thing
mix = circ(mix, lambda z: lp(z, 8200.0, order=2))
mix = circ(mix, lambda z: hp(z, 34.0, order=2))

mix = mix / np.max(np.abs(mix)) * 0.62
mix = np.tanh(mix * 1.35) / np.tanh(1.35)
mix = circ(mix, lambda z: lp(z, 12000.0, order=1))

# --- dust, generated so that it is periodic over exactly one loop
def circ_noise(cut_lo, cut_hi, order=2):
    z = np.fft.rfft(rng.normal(0, 1, (N, 2)), axis=0)
    f = np.fft.rfftfreq(N, 1 / SR)[:, None]
    h = (f / cut_lo) ** order / (1 + (f / cut_lo) ** order)
    h = h / (1 + (f / cut_hi) ** order)
    y = np.fft.irfft(z * h, n=N, axis=0)
    return y / np.max(np.abs(y))


crackle = np.zeros((N, 2))
for _ in range(int(12.0 * LOOP)):
    i = int(rng.integers(0, N))
    ln = int(rng.integers(12, 90))
    t = np.arange(ln) / SR
    p = rng.normal(0, 1, ln) * np.exp(-t / 0.0016) * rng.uniform(0.25, 1.0)
    c = int(rng.integers(0, 2))
    crackle[(i + np.arange(ln)) % N, c] += p
crackle = circ(crackle, lambda z: hp(z, 1400.0))
crackle /= max(np.max(np.abs(crackle)), 1e-9)

mix = mix + circ_noise(2000.0, 12000.0) * 0.0032 + crackle * 0.026

mix = mix / np.max(np.abs(mix)) * 0.89

rms = float(np.sqrt(np.mean(mix ** 2)))
print(f"len={len(mix)/SR:.6f}s  peak={np.max(np.abs(mix)):.3f}  "
      f"rms={20*np.log10(rms):.1f} dBFS")
print(f"wrap step={np.max(np.abs(mix[0] - mix[-1])):.5f}  "
      f"(typical step={np.percentile(np.abs(np.diff(mix, axis=0)), 99.9):.5f})")

out = np.clip(mix, -1, 1)
pcm = (out * 32767).astype(np.int16)

import wave
with wave.open(sys.argv[1] if len(sys.argv) > 1 else "out.wav", "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
