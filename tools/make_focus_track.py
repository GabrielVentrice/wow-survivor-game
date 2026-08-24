#!/usr/bin/env python3
"""
make_focus_track.py — generates the FOCUS loop as a WAV.

`make_track.py` writes a song: it has an intro, a breakdown, three thunders and
a turnaround, and it is measurably 6.8 dB louder in its full sections than in
its quiet ones. That is what a lofi track is supposed to do, and it is exactly
what a background bed for an ADHD player must not do — every level change and
every one-off sound is a novelty event, and novelty is the thing that takes the
attention off the screen.

This script writes the opposite: a bed that is ALWAYS THE SAME. The design
brief, and every number below serves it:

  1. A shaped noise bed carries the track. Broadband noise is the one part of
     this that has actual evidence behind it for inattentive listeners
     (the moderate-brain-arousal / stochastic-resonance line of work), and it
     is also the layer with no events in it by construction.
     It is NOT pure brown noise: the game plays the track at 0.055 gain, and
     a -6 dB/oct bed at that level is inaudible on a laptop speaker. The bed
     is brown below the knee and pink above it, so it still reads as a sound
     and not as a rumble.
  2. NOTHING HAPPENS. No drums, no fills, no lead line, no vinyl crackle, no
     thunder, no section changes. The one thing that moves is the harmony, and
     it moves so slowly (one chord per 32 s, with 8 s crossfades) that it never
     arrives — at any instant it is a colour, not a change.
  3. The harmony has no pull. D natural minor, five voicings that share most of
     their notes, and NO leading tone anywhere: no C#, so no dominant, so
     nothing that sets up an expectation the ear then waits to have resolved.
     `make_track.py` deliberately does the opposite (A major out of the
     harmonic minor) because a song wants that tension.
  4. A pulse at exactly 60 BPM — one per second, a resting heart rate. It is
     time structure, which is the thing ADHD listeners actually lose without a
     bed, and it is a filtered sine with a 30 ms attack, so it has no transient
     that could ever startle. The bed dips 0.6 dB under it so the pulse sits
     INSIDE the noise instead of on top of it.
  5. Constant loudness is a measured requirement, not a hope. The script prints
     the 2 s-window RMS spread and the biggest 250 ms pop over the trailing
     background, and the whole point of the track is that both are small.

The loop is EXACTLY 40 bars and it wraps: the noise is shaped in the frequency
domain (periodic by construction), every oscillator frequency is snapped to a
whole number of cycles per loop, every LFO completes whole cycles, impacts are
placed modulo N, reverb tails are folded back onto the start and the master
filters run circular. `js/track.js` plays it with native `loop = true`.

Usage: python3 make_focus_track.py out.wav
"""

import sys
import wave
import numpy as np
from scipy import signal

SR = 44100
BPM = 60.0                             # one beat per second, exactly
BEAT = 60.0 / BPM
BAR = 4.0 * BEAT
BARS = 40
LOOP = BARS * BAR                      # 160 s
N = int(round(LOOP * SR))              # 7_056_000 samples, exact
TAIL = int(4.0 * SR)                   # room for tails, folded back to the start

rng = np.random.default_rng(20260824)


# ---------------------------------------------------------------- utilities

def hz(m):
    return 440.0 * 2.0 ** ((m - 69) / 12.0)


def snap(f):
    """Round a frequency to a whole number of cycles per loop.

    A 110 Hz sine over a 160 s loop ends mid-cycle, and the wrap is a step in
    the waveform — a click, on every single voice. The correction is at most
    1/LOOP = 0.00625 Hz, which is four thousandths of a cent at this pitch.
    """
    return max(1.0, round(f * LOOP)) / LOOP


def tvec():
    return np.arange(N) / SR


def lp(x, f, order=2):
    sos = signal.butter(order, f / (SR / 2), btype="low", output="sos")
    return signal.sosfilt(sos, x, axis=0)


def hp(x, f, order=2):
    sos = signal.butter(order, f / (SR / 2), btype="high", output="sos")
    return signal.sosfilt(sos, x, axis=0)


def circ(x, fn, pad=int(3.0 * SR)):
    """Run a causal filter on the loop as if it were circular."""
    y = fn(np.concatenate([x[-pad:], x], axis=0))
    return y[pad:]


def place_circ(b, sig, t, gain=1.0, pan=0.0):
    """Mix a mono signal into an N-long stereo bus, wrapping at the loop point."""
    i = int(round(t * SR)) % N
    idx = (i + np.arange(len(sig))) % N
    b[idx, 0] += sig * gain * np.sqrt(0.5 * (1.0 - pan))
    b[idx, 1] += sig * gain * np.sqrt(0.5 * (1.0 + pan))


def lfo(cycles, phase=0.0):
    """A modulation shape completing a WHOLE number of cycles in the loop."""
    return np.sin(2 * np.pi * cycles * np.arange(N) / N + phase)


# --------------------------------------------------------------- the bed

def shaped_noise(knee, low_slope, high_slope, lo, hi, seed):
    """Circular noise with a two-slope spectrum, built in the frequency domain.

    Filtered white noise is NOT periodic — the filter state at the end does not
    match the state at the start, and that mismatch is the seam. Drawing the
    magnitude spectrum and running one `irfft` gives noise that is periodic by
    construction, which is the only way a noise bed can loop invisibly.

    Two slopes and not one because a single -6 dB/oct (brown) bed disappears at
    the volume the game plays music at. Brown under the knee keeps the weight;
    pink over it keeps the bed audible on a laptop.
    """
    g = np.random.default_rng(seed)
    f = np.fft.rfftfreq(N, 1.0 / SR)
    mag = np.zeros_like(f)
    nz = f > 0
    below = nz & (f <= knee)
    above = f > knee
    mag[below] = (f[below] / knee) ** (low_slope / 6.0206)
    mag[above] = (f[above] / knee) ** (high_slope / 6.0206)
    # soft band limits: a brick wall rings, and the ring is a tone
    mag *= 1.0 / (1.0 + (lo / np.maximum(f, 1e-6)) ** 4)
    mag *= 1.0 / (1.0 + (np.maximum(f, 1e-6) / hi) ** 4)
    ph = g.uniform(0, 2 * np.pi, len(f))
    spec = mag * np.exp(1j * ph)
    spec[0] = 0.0
    y = np.fft.irfft(spec, n=N)
    return y / max(np.max(np.abs(y)), 1e-9)


# ------------------------------------------------------------- the harmony

# D natural minor. Five voicings, one per 8 bars, sharing most of their notes
# and containing no C# — there is no dominant here, so nothing ever pulls.
# The cycle does not repeat inside the loop: 5 chords x 8 bars = 40 bars, one
# pass, so there is no landmark for the ear to recognise as "here again".
#
# There is no bass note in them: the root is a D PEDAL that never moves, and
# that is not a stylistic preference, it is what the measurement asked for.
# With a root per chord the sub band (20-120 Hz) wandered 6.35 dB across the
# loop — a Bb1 root simply carries far more energy down there than a G2 one —
# and that alone was most of the track's loudness drift. A pedal removes the
# drift and the "the chord changed" cue in the same move; every voicing here is
# consonant over D, so the harmony still reads.
PEDAL = [38, 50]
CHORDS = [
    dict(name="Dm(add9)", voices=[50, 57, 62, 64]),
    dict(name="Bb/D",     voices=[50, 57, 60, 65]),
    dict(name="F/D",      voices=[48, 57, 60, 67]),
    dict(name="Gm/D",     voices=[50, 55, 62, 65]),
    dict(name="Dm11",     voices=[50, 55, 57, 60]),
]
CHORD_BARS = BARS / len(CHORDS)        # 8 bars = 32 s each
FADE = 8.0                             # seconds of crossfade between voicings


def chord_windows():
    """One circular window per chord, and they sum to exactly 1 everywhere.

    Complementary sin^2/cos^2 ramps are what makes the sum flat: without that,
    the crossfade is a dip or a bump in level every 32 s, which is the one
    thing this track exists not to have.
    """
    span = CHORD_BARS * BAR
    t = tvec()
    out = []
    for i in range(len(CHORDS)):
        # distance from the start of this chord's slot, wrapped
        d = (t - i * span) % LOOP
        w = np.zeros(N)
        rise = d < FADE
        w[rise] = np.sin(0.5 * np.pi * d[rise] / FADE) ** 2
        hold = (d >= FADE) & (d < span)
        w[hold] = 1.0
        fall = (d >= span) & (d < span + FADE)
        w[fall] = np.cos(0.5 * np.pi * (d[fall] - span) / FADE) ** 2
        out.append(w)
    return out


def voice(midi, harmonics, spread_cents, drift_cycles):
    """One sustained note: detuned partials with slow, whole-cycle drift.

    The detuning is what keeps a sustained chord alive without anything
    happening in it — three copies a few cents apart beat against each other on
    a cycle of tens of seconds. That is movement with no event in it, which is
    the whole trick of this track.
    """
    t = tvec()
    y = np.zeros(N)
    f0 = hz(midi)
    for hn, amp in harmonics:
        for k, cents in enumerate(spread_cents):
            f = snap(f0 * hn * 2.0 ** (cents / 1200.0))
            ph = 2 * np.pi * (k * 0.37 + hn * 0.11)
            # slow amplitude drift, whole cycles, so partials breathe apart
            a = amp * (1.0 + 0.22 * lfo(drift_cycles + hn + k, ph))
            y += a * np.sin(2 * np.pi * f * t + ph)
    return y / max(np.max(np.abs(y)), 1e-9)


# --------------------------------------------------------------- the pulse

def pulse_hit():
    """A filtered sine with a 30 ms attack — a beat with no transient in it.

    Every drum in `make_track.py` starts in under 4 ms, because a song wants
    the click. Here the click is the enemy: it is the one thing in a steady bed
    that can make someone look up.
    """
    n = int(1.1 * SR)
    t = np.arange(n) / SR
    f = 76.0 * np.exp(-t / 0.5) + 42.0
    y = np.sin(2 * np.pi * np.cumsum(f) / SR)
    y *= (1.0 - np.exp(-t / 0.030)) * np.exp(-t / 0.34)
    # 300 Hz and not 220: a laptop speaker reproduces almost nothing under
    # 200 Hz, and a pulse nobody can hear there is a pulse that is not doing
    # its job on half the machines the game runs on
    return lp(y, 300.0)


def swell(midi, dur=9.0):
    """The chord change, made audible as a swell instead of a strike.

    It is the only thing in the track that is placed at a moment, so it gets
    the slowest attack of anything here: 1.2 s in, then eight seconds out. A
    struck bell in this slot would be a landmark, and a landmark is what makes
    a loop start sounding like a loop.
    """
    n = int(dur * SR)
    t = np.arange(n) / SR
    f0 = hz(midi)
    y = np.zeros(n)
    for hn, amp, dec in ((1.0, 1.0, 4.2), (2.0, 0.30, 2.6), (3.0, 0.12, 1.7),
                         (4.02, 0.06, 1.2)):
        y += amp * np.sin(2 * np.pi * snap(f0 * hn) * t) * np.exp(-t / dec)
    y *= 1.0 - np.exp(-t / 1.2)
    return lp(y, 2600.0) / max(np.max(np.abs(y)), 1e-9)


# ------------------------------------------------------------------- space

def reverb_ir(decay, cut, predelay):
    n = int(3.0 * SR)
    t = np.arange(n) / SR
    ir = np.stack([rng.normal(0, 1, n), rng.normal(0, 1, n)], axis=1)
    ir *= np.exp(-t / decay)[:, None]
    ir = lp(ir, cut)
    ir[:int(predelay * SR)] = 0.0
    return ir / np.sqrt(np.sum(ir ** 2, axis=0))


IR = reverb_ir(1.9, 2600.0, 0.030)


def send(b, amount):
    """Convolve and fold the tail back onto the head, so the loop stays closed."""
    out = b.copy()
    for c in (0, 1):
        wet = signal.fftconvolve(b[:, c], IR[:, c])
        head = wet[:N].copy()
        tail = wet[N:N + TAIL]
        head[:len(tail)] += tail
        out[:, c] += head * amount
    return out


# ------------------------------------------------------------------ build

print("bed...")
b_bed = np.zeros((N, 2))
# the two channels are DIFFERENT noise, not one noise panned: decorrelated
# channels are what make a bed feel like a room instead of a line in the middle
b_bed[:, 0] = shaped_noise(300.0, 5.5, -4.2, 34.0, 7200.0, 11)
b_bed[:, 1] = shaped_noise(300.0, 5.5, -4.2, 34.0, 7200.0, 12)

print("air...")
b_air = np.zeros((N, 2))
b_air[:, 0] = shaped_noise(2000.0, 3.0, -6.0, 900.0, 11000.0, 21)
b_air[:, 1] = shaped_noise(2000.0, 3.0, -6.0, 900.0, 11000.0, 22)
# very slow opening and closing, a whole cycle each, opposite in the two
# channels so the width breathes instead of the level
b_air[:, 0] *= 1.0 + 0.30 * lfo(1)
b_air[:, 1] *= 1.0 + 0.30 * lfo(1, np.pi)

def loud(x):
    """RMS after a 120 Hz high-pass — a stand-in for how loud a chord SOUNDS.

    The pedal already owns everything below 120 Hz and never moves; what is
    left to level is the moving upper voicing, and plain RMS over it would
    still be pulled around by whichever voicing sits lowest. A 32 s-long level
    change is exactly the slow drift this track is built to not have.
    """
    return float(np.sqrt(np.mean(hp(x, 120.0) ** 2)))


print("pedal...")
b_pedal = np.zeros((N, 2))
HARM_LOW = ((1.0, 1.0), (2.0, 0.22), (3.0, 0.06))
HARM_MID = ((1.0, 1.0), (2.0, 0.34), (3.0, 0.14), (4.0, 0.05))
for i, m in enumerate(PEDAL):
    p = voice(m, HARM_LOW, (-4.0, 0.0, 4.0), 2 + i)
    b_pedal[:, 0] += p * (1.0 if i == 0 else 0.34)
    b_pedal[:, 1] += p * (1.0 if i == 0 else 0.34)
b_pedal = circ(b_pedal, lambda z: lp(z, 900.0, order=2))

print("drone...")
b_drone = np.zeros((N, 2))
wins = chord_windows()
for i, ch in enumerate(CHORDS):
    one = np.zeros((N, 2))
    for j, m in enumerate(ch["voices"]):
        v = voice(m, HARM_MID, (-6.0, 0.0, 6.0), 3 + i + 2 * j)
        pan = -0.42 + 0.28 * j
        one[:, 0] += v * 0.30 * np.sqrt(0.5 * (1 - pan))
        one[:, 1] += v * 0.30 * np.sqrt(0.5 * (1 + pan))
    g = 0.10 / max(loud(one), 1e-9)
    print(f"  chord {ch['name']:9s} x{g:.3f}")
    b_drone += one * g * wins[i][:, None]
b_drone = circ(b_drone, lambda z: lp(z, 2400.0, order=2))

print("swells...")
b_swell = np.zeros((N, 2))
span = CHORD_BARS * BAR
for i, ch in enumerate(CHORDS):
    s = swell(ch["voices"][1] + 12)
    # same argument as the chords: five different pitches, levelled so that no
    # one of them is the loud one
    s *= 0.20 / max(float(np.sqrt(np.mean(s ** 2))), 1e-9)
    place_circ(b_swell, s, i * span, 1.0, pan=-0.30 if i % 2 else 0.30)

print("pulse...")
b_pulse = np.zeros((N, 2))
HIT = pulse_hit()
beats = int(round(LOOP / BEAT))
for i in range(beats):
    # every fourth beat sits a hair deeper; it is the only accent in the track
    place_circ(b_pulse, HIT, i * BEAT, 1.0 if i % 4 else 1.18)

print("space...")
b_drone = send(b_drone, 0.26)
b_swell = send(b_swell, 0.55)


def active_dbrms(x):
    m = np.max(np.abs(x), axis=1)
    live = m > 1e-4
    if not live.any():
        return -120.0
    return 20 * np.log10(max(float(np.sqrt(np.mean(x[live] ** 2))), 1e-9))


# Where each bus sits, in dBFS, while it is sounding. This IS the mix. The bed
# is the loudest thing on purpose: it is the layer the track is FOR, and every
# tonal layer is quiet enough that losing it would not change the character.
LEVELS = dict(bed=-19.0, air=-33.0, pedal=-25.0, drone=-24.5, swell=-33.0,
              pulse=-27.0)
BUSES = dict(bed=b_bed, air=b_air, pedal=b_pedal, drone=b_drone,
             swell=b_swell, pulse=b_pulse)


def fit(nm, b):
    cur = active_dbrms(b)
    g = 10 ** ((LEVELS[nm] - cur) / 20.0)
    print(f"  bus {nm:6s} {cur:7.1f} -> {LEVELS[nm]:6.1f} dBFS  (x{g:.3f})")
    return b * g


mix = np.zeros((N, 2))
for nm, b in BUSES.items():
    mix += fit(nm, b)

# The bed breathes with the pulse — 0.6 dB, an order of magnitude under the
# 4 dB a song would use. It is not a groove: it is what stops the pulse from
# reading as a separate object sitting on top of the noise.
duck = np.ones(N)
kd = int(0.45 * SR)
k = np.arange(kd) / SR
shape = 1.0 - 0.067 * np.exp(-k / 0.17) * (1 - np.exp(-k / 0.020))
for i in range(beats):
    at = int(round(i * BEAT * SR)) % N
    idx = (at + np.arange(kd)) % N
    duck[idx] = np.minimum(duck[idx], shape)
mix *= duck[:, None]

# no saturation, no tape, no crackle: every one of those is high-frequency
# transient energy, and transient energy is what a background bed must not have
mix = circ(mix, lambda z: lp(z, 9000.0, order=2))
mix = circ(mix, lambda z: hp(z, 28.0, order=2))
mix = mix / np.max(np.abs(mix)) * 0.89


# ------------------------------------------------------------------ verify

def report(x):
    mono = x.mean(axis=1)
    w = int(2.0 * SR)
    r = np.array([20 * np.log10(max(float(np.sqrt(np.mean(mono[i*w:(i+1)*w] ** 2))), 1e-12))
                  for i in range(len(mono) // w)])
    spread = np.percentile(r, 95) - np.percentile(r, 5)

    ws = int(0.25 * SR)
    ks = len(mono) // ws
    s = np.array([np.sqrt(np.mean(mono[i*ws:(i+1)*ws] ** 2)) for i in range(ks)])
    back = np.array([np.median(s[max(0, i - 24):i + 1]) for i in range(ks)])
    pop = 20 * np.log10(np.maximum(s, 1e-12) / np.maximum(back, 1e-12))

    rms = float(np.sqrt(np.mean(x ** 2)))
    print(f"len={len(x)/SR:.6f}s  peak={np.max(np.abs(x)):.3f}  "
          f"rms={20*np.log10(rms):.1f} dBFS")
    print(f"passeio de volume (2s, p5-p95) = {spread:.2f} dB   [alvo < 1.5]")
    print(f"maior salto 250ms sobre o fundo = {pop.max():.2f} dB, "
          f"janelas acima de 6 dB: {(pop > 6).sum()}   [alvo 0]")
    print(f"emenda: degrau {np.max(np.abs(x[0] - x[-1])):.5f}  "
          f"(tipico {np.percentile(np.abs(np.diff(x, axis=0)), 99.9):.5f})")


report(mix)

pcm = (np.clip(mix, -1, 1) * 32767).astype(np.int16)
with wave.open(sys.argv[1] if len(sys.argv) > 1 else "out.wav", "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
