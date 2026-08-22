#!/usr/bin/env python3
"""
make_track.py — generates the background loop as a WAV.

Rain lofi: a storm heard from inside, with a slow boom-bap bed under it — tape
wow, vinyl crackle, a Rhodes on the offbeat and a soft kit — still carrying the
gothic D-minor line the Vampire Survivors / Castlevania colour is built on,
now at 72 BPM and with a window between the listener and the weather.

Everything is synthesised here, so the result is ours: no licence to check,
and the rain is noise we shaped rather than a field recording.

Two groups, and the split matters. The MUSIC goes through the tape voicing
(low-passed, saturated, dusted); the ROOM — rain bed, patter, drips, thunder —
is added after it. Rain is what the tape is playing *in*, not something the
tape recorded: run it through the same saturation and it stops sounding like
air and starts sounding like hiss.

The loop is EXACTLY 32 bars long and it wraps: reverb and delay tails that run
past the end are added back onto the start, every modulation LFO completes a
whole number of cycles inside the loop, and the room layers are generated
circularly (noise shaped in the frequency domain, impacts placed modulo N).
`js/track.js` can play it with native `loop = true` and there is no seam.

Usage: python3 make_track.py out.wav
"""

import sys
import numpy as np
from scipy import signal

SR = 44100
BPM = 72.0
BEAT = 60.0 / BPM
BAR = 4.0 * BEAT
BARS = 32
LOOP = BARS * BAR                      # 106.666667 s
N = int(round(LOOP * SR))              # 4_704_000 samples, exact
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


def place_circ(b, sig, t, gain=1.0, pan=0.0):
    """Same, but into an N-long buffer and wrapping around the loop point.

    The room layers use this: a 6 s thunder tail starting at bar 30 has to come
    out of the speakers over bar 0, not be cut off at the file boundary.
    """
    i = int(round(t * SR)) % N
    idx = (i + np.arange(len(sig))) % N
    b[idx, 0] += sig * gain * np.sqrt(0.5 * (1.0 - pan))
    b[idx, 1] += sig * gain * np.sqrt(0.5 * (1.0 + pan))


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


def lfo(cycles, phase=0.0, n=None):
    """A modulation shape that completes a WHOLE number of cycles in the loop.

    Any LFO whose period does not divide LOOP leaves the loop point at a
    different value than the start and the wrap becomes audible as a lurch.
    """
    n = n if n is not None else TOT
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * cycles * t / LOOP + phase)


# ------------------------------------------------------------- instruments

def rhodes(f, dur, tine=2.4, body=0.55):
    """Two-operator FM electric piano — the lofi keyboard.

    The harpsichord that used to sit here was a Karplus-Strong pluck: bright,
    dry, and it competed with the rain for the same 2-6 kHz band. A Rhodes has
    its energy underneath the weather, so both are audible at once.
    """
    n = int(dur * SR)
    t = np.arange(n) / SR
    mod = np.sin(2 * np.pi * f * t) * tine * np.exp(-t / 0.055)
    y = np.sin(2 * np.pi * f * t + mod)
    y += body * np.sin(2 * np.pi * f * t + 0.6 * np.sin(2 * np.pi * f * 2 * t)
                       * np.exp(-t / 0.5))
    y *= env_ad(n, 0.004, dur * 0.42)
    return lp(y, 3800.0) * 0.6


def fm_bell(f, dur, ratio=2.0, index=2.6, decay=0.55, idecay=0.28):
    """Two-operator FM — the dusty bell lead."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    mod = np.sin(2 * np.pi * f * ratio * t) * index * np.exp(-t / idecay)
    y = np.sin(2 * np.pi * f * t + mod)
    return y * env_ad(n, 0.006, decay)


def bass_note(f, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = np.sin(2 * np.pi * f * t)
    y += 0.26 * np.sin(4 * np.pi * f * t) * np.exp(-t / 0.10)
    y += 0.12 * signal.sawtooth(2 * np.pi * f * t) * np.exp(-t / 0.22)
    e = np.clip(t / 0.010, 0, 1) * np.minimum(1.0, np.exp(-(t - dur * 0.7) / 0.10))
    y = y * e
    return lp(y, 700.0)


def organ(freqs, dur, detune=0.004):
    """Church-organ pad: drawbar harmonics, two detuned voices, slow swell."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    harm = [(1, 1.0), (2, 0.5), (3, 0.26), (4, 0.18), (6, 0.08)]
    vib = 1.0 + 0.0016 * np.sin(2 * np.pi * 4.7 * t)
    for f in freqs:
        for v in (-detune, detune):
            fv = f * (1.0 + v)
            for h, a in harm:
                y += a * np.sin(2 * np.pi * fv * h * t * vib)
    y /= max(len(freqs) * 2 * 2.2, 1.0)
    a = min(0.7, dur * 0.4)
    e = np.clip(t / a, 0, 1) * np.clip((dur - t) / 0.45, 0, 1)
    return lp(y * e, 1900.0)


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
    y = bp(y, 300, 1400)
    a = min(1.1, dur * 0.45)
    e = np.clip(t / a, 0, 1) * np.clip((dur - t) / 0.7, 0, 1)
    return y * e


# ------------------------------------------------------------------- drums

def kick():
    n = int(0.42 * SR)
    t = np.arange(n) / SR
    f = 44.0 + 86.0 * np.exp(-t / 0.032)
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph) * np.exp(-t / 0.170)
    y += 0.14 * rng.normal(0, 1, n) * np.exp(-t / 0.0035)
    return lp(np.tanh(y * 1.3), 2200.0)


def snare():
    """Brushed, not cracked: 12 ms of attack and no top end.

    A snappy snare cuts a hole through the rain on every backbeat and the two
    layers start fighting for the same band. Softening the transient is what
    lets the storm stay continuous underneath the beat.
    """
    n = int(0.34 * SR)
    t = np.arange(n) / SR
    nz = bp(rng.normal(0, 1, n), 200, 3400)
    y = nz * np.clip(t / 0.012, 0, 1) * np.exp(-t / 0.130)
    y += 0.32 * np.sin(2 * np.pi * 186 * t) * np.exp(-t / 0.080)
    y += 0.18 * np.sin(2 * np.pi * 274 * t) * np.exp(-t / 0.055)
    return lp(np.tanh(y * 1.05) * 0.70, 4200.0)


def hat(open_=False):
    d = 0.22 if open_ else 0.055
    n = int(d * SR)
    t = np.arange(n) / SR
    y = hp(rng.normal(0, 1, n), 5600.0, order=3)
    y = lp(y, 11000.0)
    return y * np.exp(-t / (0.090 if open_ else 0.018)) * 0.42


def rim():
    n = int(0.09 * SR)
    t = np.arange(n) / SR
    y = bp(rng.normal(0, 1, n), 1200, 3600) * np.exp(-t / 0.012)
    y += 0.5 * np.sin(2 * np.pi * 1620 * t) * np.exp(-t / 0.010)
    return y * 0.45


KICK, SNARE, HAT_C, HAT_O, RIM = kick(), snare(), hat(), hat(True), rim()


# -------------------------------------------------------------------- rain

def circ_noise(cut_lo, cut_hi, order=2, tilt=0.0):
    """Noise shaped in the frequency domain, therefore periodic over the loop.

    Filtering white noise with sosfilt would give a signal whose start and end
    have nothing to do with each other; an irfft of a shaped spectrum is
    circular by construction, so the rain bed loops with no seam at all.
    `tilt` in dB/octave pinks the result.
    """
    z = np.fft.rfft(rng.normal(0, 1, (N, 2)), axis=0)
    f = np.fft.rfftfreq(N, 1 / SR)[:, None]
    f = np.maximum(f, 1e-6)
    h = (f / cut_lo) ** order / (1 + (f / cut_lo) ** order)
    h = h / (1 + (f / cut_hi) ** order)
    if tilt:
        h = h * (f / 1000.0) ** (tilt / 6.0206)
    y = np.fft.irfft(z * h, n=N, axis=0)
    return y / max(np.max(np.abs(y)), 1e-9)


def rain_bed():
    """Two beds and a gust, mixed by an LFO that closes on the loop.

    Rain is not one noise: it is a low roar (water on stone and roof) plus a
    high spray, and what makes it read as weather instead of as tape hiss is
    that the balance between the two MOVES. The gust is three cycles per loop
    against eleven — both whole numbers, so the wrap point sits wherever the
    two happen to be, and never on a discontinuity.
    """
    low = circ_noise(90.0, 1600.0, order=2)
    high = circ_noise(1400.0, 9500.0, order=2, tilt=-2.0)
    g = 0.5 + 0.5 * lfo(3, n=N)
    g2 = 0.5 + 0.5 * lfo(11, phase=1.7, n=N)
    gust = (0.62 + 0.30 * g + 0.08 * g2)[:, None]
    return low * (1.35 - 0.35 * gust) + high * gust * 0.9


def patter(count):
    """The thousands of individual hits on the window.

    A shaped-noise bed alone is a hiss; what says 'rain' is granularity. These
    are 1-3 ms bursts, far too many to hear one at a time, and they are the
    difference between a synth pad and weather.
    """
    b = np.zeros((N, 2))
    for _ in range(count):
        i = int(rng.integers(0, N))
        ln = int(rng.integers(24, 140))
        t = np.arange(ln) / SR
        p = rng.normal(0, 1, ln) * np.exp(-t / rng.uniform(0.0006, 0.0030))
        p *= rng.uniform(0.3, 1.0)
        pan = rng.uniform(-1.0, 1.0)
        idx = (i + np.arange(ln)) % N
        b[idx, 0] += p * np.sqrt(0.5 * (1 - pan))
        b[idx, 1] += p * np.sqrt(0.5 * (1 + pan))
    b = circ(b, lambda z: bp(z, 700.0, 7000.0))
    return b / max(np.max(np.abs(b)), 1e-9)


def drip(f, dur=0.30):
    """A gutter drop: a pitched ping that falls, because a drip has a body."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    ff = f * (1.0 + 0.55 * np.exp(-t / 0.020))
    ph = 2 * np.pi * np.cumsum(ff) / SR
    y = np.sin(ph) * np.exp(-t / 0.045)
    y += 0.6 * bp(rng.normal(0, 1, n), f * 0.8, f * 2.6) * np.exp(-t / 0.006)
    return y * 0.5


def thunder(far=True):
    """Distant, so it is nearly all rumble and nearly all tail.

    Close thunder is a transient and would land like a drum hit in the middle
    of a beat that is not asking for one. What this wants is a swell that says
    the storm outside is larger than the room.
    """
    d = 6.0 if far else 4.5
    n = int(d * SR)
    t = np.arange(n) / SR
    nz = rng.normal(0, 1, (n, 2))
    body = lp(nz, 150.0 if far else 320.0, order=4)
    body *= (np.clip(t / (0.35 if far else 0.05), 0, 1)
             * np.exp(-t / (1.8 if far else 1.2)))[:, None]
    crack = lp(nz, 900.0, order=2) * (np.exp(-t / 0.30))[:, None]
    y = body + crack * (0.10 if far else 0.45)
    # rolling: the rumble comes back in waves instead of decaying flat
    roll = 1.0 + 0.5 * np.sin(2 * np.pi * 0.55 * t) * np.exp(-t / 2.2)
    y *= roll[:, None]
    return y / max(np.max(np.abs(y)), 1e-9)


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
    """The 32 bars breathe, and the rain is what holds them together.

    Four bars of nothing but weather and organ, the beat walks in, a full
    section, a breakdown where the drums leave and the thunder answers, a
    second full section, and a turnaround that thins out so the wrap back to
    bar 0 reads as a drop and not as a cut.
    """
    if bar < 4:
        return "intro"
    if bar < 12:
        return "light"
    if bar < 20:
        return "full"
    if bar < 24:
        return "break"
    if bar < 30:
        return "full2"
    return "outro"


b_drum, b_bass, b_pad, b_keys, b_lead, b_air = bus(), bus(), bus(), bus(), bus(), bus()
kick_times = []

for bar in range(BARS):
    t0 = bar * BAR
    ch = PROG[bar % 4]
    sec = section(bar)
    nxt = PROG[(bar + 1) % 4]

    # --- pad: organ every bar, choir doubles it from the first full section
    place(b_pad, organ([hz(m) for m in ch["pad"]], BAR * 1.04), t0, 0.30)
    if sec in ("full", "full2", "break"):
        place(b_pad, choir([hz(m + 12) for m in ch["chord"][:2]], BAR * 1.04), t0, 0.15)

    # --- bass: root on 1, octave push on the & of 2, root on 3, walk on the & of 4
    if sec not in ("intro",) and (sec != "break" or bar >= 22):
        place(b_bass, bass_note(hz(ch["root"]), BEAT * 1.5), t0, 0.62)
        place(b_bass, bass_note(hz(ch["root"] + 12), BEAT * 0.5), t0 + 1.5 * BEAT, 0.28)
        place(b_bass, bass_note(hz(ch["root"]), BEAT * 1.0), t0 + 2 * BEAT, 0.50)
        walk = ch["root"] + (1 if nxt["root"] > ch["root"] else -1)
        place(b_bass, bass_note(hz(walk), BEAT * 0.5), t0 + 3.5 * BEAT, 0.34)

    # --- Rhodes: chord on 1, stabs on the swung offbeats
    if sec != "intro":
        soft = 0.5 if sec in ("break", "outro") else 1.0
        for j, m in enumerate(ch["chord"]):
            place(b_keys, rhodes(hz(m), BEAT * 2.2), t0 + j * 0.012,
                  0.30 * soft, pan=-0.30 + 0.16 * j)
        if sec != "break":
            for i, m in ((3, ch["chord"][1] + 12), (5, ch["chord"][2]),
                         (7, ch["chord"][0] + 12)):
                sw = 0.055 * BEAT
                place(b_keys, rhodes(hz(m), BEAT * 1.1),
                      t0 + i * 0.5 * BEAT + sw, 0.19 * soft, pan=0.22)

    # --- lead
    phrase = None
    if 12 <= bar < 20:
        phrase = bar - 12
    elif 24 <= bar < 30:
        phrase = bar - 24
    if phrase is not None:
        for beat, dur, m in LEAD:
            if not (phrase * 4 <= beat < (phrase + 1) * 4):
                continue
            t = (bar - phrase) * BAR + beat * BEAT
            d = dur * BEAT * 1.15
            place(b_lead, fm_bell(hz(m), d, ratio=2.0, index=2.2, decay=d * 0.5),
                  t, 0.26, pan=0.30)
            place(b_lead, fm_bell(hz(m + 12), d * 0.5, ratio=3.0, index=1.0,
                                  decay=d * 0.22), t, 0.06, pan=0.45)

    # --- drums
    step = BAR / 16.0
    if sec == "outro":
        # turnaround: kick keeps the pulse, a rim fill hands over to bar 0
        for st in ([0, 6, 10] if bar == 30 else [0, 6]):
            place(b_drum, KICK, t0 + st * step, 0.88)
            kick_times.append(t0 + st * step)
        if bar == 30:
            place(b_drum, SNARE, t0 + 4 * step, 0.50)
        for st in range(0, 12 if bar == 31 else 16, 2):
            sw = 0.30 * step if (st // 2) % 2 else 0.0
            place(b_drum, HAT_C, t0 + st * step + sw, 0.28 if st % 4 == 0 else 0.18)
        if bar == 31:
            for st, g in ((12, 0.32), (14, 0.42), (15, 0.28)):
                place(b_drum, RIM, t0 + st * step, g)
            place(b_drum, HAT_O, t0 + 15 * step, 0.20)
    elif sec in ("light", "full", "full2"):
        ks = K_VAR if bar % 4 == 3 and sec != "light" else K_MAIN
        for s in ks:
            t = t0 + s * step
            place(b_drum, KICK, t, 0.90)
            kick_times.append(t)
        if sec != "light":
            for s in S_MAIN:
                place(b_drum, SNARE, t0 + s * step, 0.66)
            if bar % 8 == 7:
                place(b_drum, RIM, t0 + 14 * step, 0.46)
                place(b_drum, RIM, t0 + 15 * step, 0.36)
        for s in range(0, 16, 2):
            sw = 0.30 * step if (s // 2) % 2 else 0.0
            g = 0.32 if s % 4 == 0 else 0.20
            place(b_drum, HAT_C, t0 + s * step + sw, g)
        if bar % 4 == 1:
            place(b_drum, HAT_O, t0 + 10 * step, 0.18)
    elif sec == "break" and bar >= 22:
        for s in range(0, 16, 4):
            place(b_drum, HAT_C, t0 + s * step, 0.16)

    # --- noise swell into each drop, and a soft impact on the downbeat
    if bar in (3, 11, 23):
        n = int(BAR * SR)
        t = np.arange(n) / SR
        sw = hp(rng.normal(0, 1, n), 900.0) * (t / BAR) ** 3
        place(b_air, sw, t0, 0.16)
    if bar in (12, 24):
        n = int(1.6 * SR)
        t = np.arange(n) / SR
        cy = hp(rng.normal(0, 1, n), 4200.0) * np.exp(-t / 0.45)
        place(b_air, cy, t0, 0.14)


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


IR = reverb_ir(0.72, 3600.0, 0.024)


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
    out = lp(out, 3000.0)
    if pan:
        out[:, 0] *= 1.0 - max(pan, 0)
        out[:, 1] *= 1.0 + min(pan, 0)
    return b + out * mix


def circ(x, fn, pad=int(2.0 * SR)):
    """Run a causal filter on the loop as if it were circular.

    sosfilt starts with zero state, so filtering the mix straight would leave a
    settling transient at sample 0 and a mismatched edge at the wrap — exactly
    the click the loop must not have.
    """
    y = fn(np.concatenate([x[-pad:], x], axis=0))
    return y[pad:]


b_keys = echo(b_keys, BEAT * 0.75, 0.32, 0.28)
b_lead = echo(b_lead, BEAT * 1.5, 0.30, 0.38)

b_pad = send(b_pad, 0.32)
b_keys = send(b_keys, 0.28)
b_lead = send(b_lead, 0.32)
b_drum = send(b_drum, 0.08)
b_air = send(b_air, 0.35)

# sidechain: the tonal bed breathes with the kick
duck = np.ones(TOT)
kd = int(0.34 * SR)
shape = 1.0 - 0.40 * np.exp(-np.arange(kd) / (0.11 * SR)) * (1 - np.exp(-np.arange(kd) / (0.004 * SR)))
for t in kick_times:
    i = int(round(t * SR))
    n = min(kd, TOT - i)
    duck[i:i + n] = np.minimum(duck[i:i + n], shape[:n])

for b in (b_pad, b_bass, b_keys):
    b *= duck[:, None]


# --------------------------------------------------------------- the room

b_rain = np.zeros((N, 2))
b_drip = np.zeros((N, 2))
b_storm = np.zeros((N, 2))

b_rain += rain_bed()
b_rain += patter(int(58.0 * LOOP)) * 0.55

# Gutter drips, sparse and pitched, on no grid at all: they are the one layer
# that must NOT line up with the beat, or the ear files them as percussion.
for _ in range(int(1.1 * LOOP)):
    place_circ(b_drip, drip(rng.uniform(700, 2200)), rng.uniform(0, LOOP),
               rng.uniform(0.35, 1.0), pan=rng.uniform(-0.85, 0.85))

# Thunder answers the two moments the drums leave: the intro and the breakdown.
place_circ(b_storm, thunder(far=True)[:, 0], 2.0 * BAR, 1.0, pan=-0.25)
place_circ(b_storm, thunder(far=True)[:, 1], 2.0 * BAR, 1.0, pan=0.25)
tn = thunder(far=False)
place_circ(b_storm, tn[:, 0], 20.0 * BAR + BEAT * 0.5, 1.0, pan=0.20)
place_circ(b_storm, tn[:, 1], 20.0 * BAR + BEAT * 0.5, 1.0, pan=-0.20)
# The third one starts in the turnaround and its tail lands ON the loop point,
# which is the cheapest seam insurance there is: the ear is following a rumble
# across the wrap instead of listening for a click.
tf = thunder(far=True)
place_circ(b_storm, tf[:, 0], 30.5 * BAR, 0.7, pan=0.35)
place_circ(b_storm, tf[:, 1], 30.5 * BAR, 0.7, pan=-0.35)

# The storm swells where the drums are away, so the two never fill the same
# hole: the weather IS the arrangement in bars 0-3 and 20-23.
swell = np.ones(N)
for a, b, up in ((0.0, 4.0, 0.55), (20.0, 24.0, 0.42)):
    i, j = int(a * BAR * SR), int(b * BAR * SR)
    n = j - i
    ramp = np.sin(np.linspace(0, np.pi, n)) ** 0.7
    swell[i:j] += up * ramp
b_rain *= swell[:, None]
b_drip *= swell[:, None]


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
# "it is too loud" adjustment happens in this table and nowhere else. The room
# group is mixed on the same scale as the music even though it is added after
# the tape stage — one table, one place to argue about balance.
LEVELS = dict(drum=-16.5, bass=-17.5, pad=-23.0, keys=-21.0, lead=-20.0, air=-32.0,
              rain=-21.5, drip=-28.0, storm=-24.0)

MUSIC = dict(drum=b_drum, bass=b_bass, pad=b_pad, keys=b_keys, lead=b_lead, air=b_air)
ROOM = dict(rain=b_rain, drip=b_drip, storm=b_storm)


def fit(nm, b):
    cur = active_dbrms(b)
    g = 10 ** ((LEVELS[nm] - cur) / 20.0)
    print(f"  bus {nm:6s} {cur:7.1f} -> {LEVELS[nm]:6.1f} dBFS  (x{g:.2f})")
    return b * g


mix = np.zeros((TOT, 2))
for nm, b in MUSIC.items():
    mix += fit(nm, b)

mix = wrap(mix)

# lofi voicing: shave the top, roll off the sub, saturate the whole thing.
# The ceiling is lower than it used to be on purpose — the rain owns everything
# above 6 kHz, and two sources in that band is what makes a mix sound gauzy.
mix = circ(mix, lambda z: lp(z, 6800.0, order=2))
mix = circ(mix, lambda z: hp(z, 34.0, order=2))

mix = mix / np.max(np.abs(mix)) * 0.62
mix = np.tanh(mix * 1.35) / np.tanh(1.35)
mix = circ(mix, lambda z: lp(z, 11000.0, order=1))

# --- dust, generated so that it is periodic over exactly one loop
crackle = np.zeros((N, 2))
for _ in range(int(11.0 * LOOP)):
    i = int(rng.integers(0, N))
    ln = int(rng.integers(12, 90))
    t = np.arange(ln) / SR
    p = rng.normal(0, 1, ln) * np.exp(-t / 0.0016) * rng.uniform(0.25, 1.0)
    c = int(rng.integers(0, 2))
    crackle[(i + np.arange(ln)) % N, c] += p
crackle = circ(crackle, lambda z: hp(z, 1400.0))
crackle /= max(np.max(np.abs(crackle)), 1e-9)

mix = mix + crackle * 0.024

# --- the room goes on last, outside the tape
room = np.zeros((N, 2))
for nm, b in ROOM.items():
    room += fit(nm, b)
# The room skips the tape stage, so it also skips the master high-pass: put one
# back, or the thunder spends headroom below 30 Hz that no speaker will move.
room = circ(room, lambda z: lp(z, 13500.0, order=2))
room = circ(room, lambda z: hp(z, 28.0, order=2))
mix = mix + room

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
