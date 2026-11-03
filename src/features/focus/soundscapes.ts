// Background soundscapes, synthesized sample by sample: no audio files,
// no licences, identical everywhere. Each renders a seamless stereo loop that
// BackgroundSound plays with an AudioBufferSourceNode. Pure, so it is unit-tested.

export const SOUNDSCAPES = [
  "white",
  "pink",
  "brown",
  "rain",
  "stream",
  "ocean",
  "wind",
  "fire",
  "night",
  "binaural",
] as const;
export type Soundscape = (typeof SOUNDSCAPES)[number];

/** Loop length per sound; periodic parts (waves, chirps, tones) divide it exactly. */
const SECONDS: Record<Soundscape, number> = {
  white: 6,
  pink: 6,
  brown: 6,
  rain: 20,
  stream: 20,
  ocean: 24,
  wind: 30,
  fire: 20,
  night: 24,
  binaural: 20,
};

/** Small seeded PRNG (mulberry32): the same loop on every device. */
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pinkSource(rand: () => number) {
  let b0 = 0,
    b1 = 0,
    b2 = 0,
    b3 = 0,
    b4 = 0,
    b5 = 0,
    b6 = 0;
  return () => {
    const white = rand() * 2 - 1;
    // Paul Kellet's refined pink-noise filter.
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016898;
    const out = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
    return out;
  };
}

function brownSource(rand: () => number) {
  let last = 0;
  return () => {
    last = (last + 0.02 * (rand() * 2 - 1)) / 1.02;
    return last * 3.5;
  };
}

/** One-pole low-pass coefficient for a cutoff in Hz. */
const lpCoeff = (hz: number, sr: number) =>
  1 - Math.exp((-2 * Math.PI * hz) / sr);

/** A value that drifts smoothly between random targets, `rate` new targets per second. */
function drift(rand: () => number, rate: number, sr: number) {
  let from = rand();
  let to = rand();
  let phase = 0;
  const step = rate / sr;
  return () => {
    phase += step;
    if (phase >= 1) {
      phase -= 1;
      from = to;
      to = rand();
    }
    const k = 0.5 - 0.5 * Math.cos(Math.PI * phase);
    return from + (to - from) * k;
  };
}

/** Adds a decaying sine "drop" or click at sample `at`. */
function addDecay(
  out: Float32Array,
  at: number,
  sr: number,
  freq: number,
  tau: number,
  amp: number,
  noise?: () => number,
) {
  const length = Math.min(out.length - at, Math.ceil(tau * sr * 6));
  const w = (2 * Math.PI * freq) / sr;
  for (let i = 0; i < length; i++) {
    const env = amp * Math.exp(-i / (tau * sr));
    out[at + i] += env * (noise ? noise() : Math.sin(w * i));
  }
}

type Channels = [Float32Array, Float32Array];

function render(kind: Soundscape, sr: number, length: number): Channels {
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  const seed = SOUNDSCAPES.indexOf(kind) + 1;
  const rand = random(seed * 7919);
  const randR = random(seed * 104729);
  const t = (i: number) => i / sr;

  switch (kind) {
    case "white": {
      for (let i = 0; i < length; i++) {
        left[i] = rand() * 2 - 1;
        right[i] = randR() * 2 - 1;
      }
      break;
    }
    case "pink":
    case "brown": {
      const l = kind === "pink" ? pinkSource(rand) : brownSource(rand);
      const r = kind === "pink" ? pinkSource(randR) : brownSource(randR);
      for (let i = 0; i < length; i++) {
        left[i] = l();
        right[i] = r();
      }
      break;
    }
    case "rain": {
      // Soft bed of pink hiss, high-passed, plus thousands of tiny drops.
      for (const [out, r] of [
        [left, rand],
        [right, randR],
      ] as const) {
        const pink = pinkSource(r);
        const hp = lpCoeff(400, sr);
        const lp = lpCoeff(7000, sr);
        let low = 0;
        let soft = 0;
        for (let i = 0; i < length; i++) {
          const x = pink();
          low += hp * (x - low);
          soft += lp * (x - low - soft);
          out[i] = soft * 0.9;
        }
        const drops = Math.floor(t(length) * 55);
        for (let d = 0; d < drops; d++)
          addDecay(
            out,
            Math.floor(r() * length),
            sr,
            1800 + r() * 3600,
            0.002 + r() * 0.006,
            0.03 + r() * 0.12,
          );
        const heavy = Math.floor(t(length) * 5);
        for (let d = 0; d < heavy; d++)
          addDecay(
            out,
            Math.floor(r() * length),
            sr,
            500 + r() * 700,
            0.012 + r() * 0.012,
            0.06 + r() * 0.1,
          );
      }
      break;
    }
    case "stream": {
      // Band-passed noise with fast, uneven swells and small bubbles.
      for (const [out, r] of [
        [left, rand],
        [right, randR],
      ] as const) {
        const fast = drift(r, 9, sr);
        const faster = drift(r, 17, sr);
        const a = lpCoeff(2600, sr);
        const b = lpCoeff(380, sr);
        let x1 = 0;
        let x2 = 0;
        for (let i = 0; i < length; i++) {
          const w = r() * 2 - 1;
          x1 += a * (w - x1);
          x2 += b * (x1 - x2);
          out[i] = (x1 - x2) * (0.45 + 0.75 * fast() * faster());
        }
        const bubbles = Math.floor(t(length) * 7);
        for (let n = 0; n < bubbles; n++) {
          const at = Math.floor(r() * length);
          const dur = Math.floor(sr * (0.02 + r() * 0.03));
          const f0 = 300 + r() * 500;
          let phase = 0;
          for (let i = 0; i < dur && at + i < length; i++) {
            const k = i / dur;
            phase += (2 * Math.PI * f0 * (1 + 1.4 * k)) / sr;
            out[at + i] += 0.05 * Math.sin(phase) * Math.sin(Math.PI * k);
          }
        }
      }
      break;
    }
    case "ocean": {
      // Swells every 8 and 12 s (both divide the 24 s loop); louder and
      // brighter as each wave breaks.
      const swell = (s: number, shift: number) => {
        const a = 0.5 - 0.5 * Math.cos((2 * Math.PI * (s + shift)) / 8);
        const b = 0.5 - 0.5 * Math.cos((2 * Math.PI * (s + shift * 1.7)) / 12);
        return 0.15 + 0.85 * (0.6 * a ** 2 + 0.4 * b ** 3);
      };
      for (const [out, r, shift] of [
        [left, rand, 0],
        [right, randR, 0.35],
      ] as const) {
        const pink = pinkSource(r);
        const brown = brownSource(r);
        let y = 0;
        let e = 0;
        let a = 0;
        for (let i = 0; i < length; i++) {
          // The swell moves slowly: refresh it every 64 samples.
          if (i % 64 === 0) {
            e = swell(t(i), shift);
            a = lpCoeff(250 + 2600 * e * e, sr);
          }
          const x = 0.6 * pink() + 0.4 * brown();
          y += a * (x - y);
          out[i] = y * e * 1.3;
        }
      }
      break;
    }
    case "wind": {
      // Pink noise through a resonant band-pass whose centre wanders.
      for (const [out, r] of [
        [left, rand],
        [right, randR],
      ] as const) {
        const pink = pinkSource(r);
        const centre = drift(r, 0.18, sr / 32);
        const level = drift(r, 0.12, sr / 32);
        let low = 0;
        let band = 0;
        const damping = 0.35;
        let f = 0;
        let gain = 0;
        for (let i = 0; i < length; i++) {
          // Chamberlin state-variable filter; the centre drifts slowly, so
          // its coefficient is refreshed every 32 samples.
          if (i % 32 === 0) {
            f = 2 * Math.sin((Math.PI * (220 + 700 * centre())) / sr);
            gain = 0.35 + 0.65 * level();
          }
          const x = pink();
          low += f * band;
          const high = x - low - damping * band;
          band += f * high;
          out[i] = band * gain;
        }
      }
      break;
    }
    case "fire": {
      // Low rumble and air, plus crackles and the odd pop.
      for (const [out, r] of [
        [left, rand],
        [right, randR],
      ] as const) {
        const brown = brownSource(r);
        const air = drift(r, 0.5, sr);
        const hp = lpCoeff(1500, sr);
        let low = 0;
        for (let i = 0; i < length; i++) {
          const w = r() * 2 - 1;
          low += hp * (w - low);
          out[i] = 0.55 * brown() + (w - low) * 0.025 * (0.5 + air());
        }
        const noise = () => r() * 2 - 1;
        const crackles = Math.floor(t(length) * 7);
        for (let c = 0; c < crackles; c++) {
          let at = Math.floor(r() * length);
          const bursts = 1 + Math.floor(r() * 4);
          for (let b = 0; b < bursts; b++) {
            addDecay(
              out,
              at,
              sr,
              0,
              0.0008 + r() * 0.002,
              0.15 + r() * 0.5,
              noise,
            );
            at += Math.floor(sr * (0.01 + r() * 0.05));
            if (at >= length) break;
          }
        }
        const pops = Math.floor(t(length) * 0.6);
        for (let p = 0; p < pops; p++)
          addDecay(out, Math.floor(r() * length), sr, 0, 0.004, 0.9, noise);
      }
      break;
    }
    case "night": {
      // A soft night floor and three crickets; chirp periods divide 24 s.
      const floorL = pinkSource(rand);
      const floorR = pinkSource(randR);
      const a = lpCoeff(900, sr);
      let yl = 0;
      let yr = 0;
      for (let i = 0; i < length; i++) {
        yl += a * (floorL() - yl);
        yr += a * (floorR() - yr);
        left[i] = yl * 0.5;
        right[i] = yr * 0.5;
      }
      const crickets = [
        { freq: 4300, period: 0.8, offset: 0.1, pan: 0.25, amp: 0.07 },
        { freq: 4650, period: 0.6, offset: 0.33, pan: 0.8, amp: 0.05 },
        { freq: 4900, period: 0.75, offset: 0.52, pan: 0.5, amp: 0.035 },
      ];
      const pulse = 0.022;
      const gap = 0.014;
      for (const c of crickets) {
        const w = (2 * Math.PI * c.freq) / sr;
        for (let start = c.offset; start < t(length); start += c.period)
          for (let p = 0; p < 3; p++) {
            const s0 = Math.floor((start + p * (pulse + gap)) * sr);
            const n = Math.floor(pulse * sr);
            for (let i = 0; i < n && s0 + i < length; i++) {
              const v =
                c.amp * Math.sin(Math.PI * (i / n)) * Math.sin(w * (s0 + i));
              left[s0 + i] += v * (1 - c.pan);
              right[s0 + i] += v * c.pan;
            }
          }
      }
      break;
    }
    case "binaural": {
      // 200 Hz left, 216 Hz right: a 16 Hz beat heard with headphones,
      // over a quiet pink bed. Whole cycles fit the 20 s loop exactly.
      const pinkL = pinkSource(rand);
      const pinkR = pinkSource(randR);
      for (let i = 0; i < length; i++) {
        left[i] = 0.5 * Math.sin((2 * Math.PI * 200 * i) / sr) + 0.18 * pinkL();
        right[i] =
          0.5 * Math.sin((2 * Math.PI * 216 * i) / sr) + 0.18 * pinkR();
      }
      break;
    }
  }
  return [left, right];
}

const TARGET_RMS = 0.1;

/**
 * A seamless stereo loop: renders a little past the end and cross-fades that
 * tail into the start, then levels every sound to the same loudness.
 */
export function renderSoundscape(kind: Soundscape, sampleRate: number) {
  const length = Math.round(SECONDS[kind] * sampleRate);
  const fade = Math.round(sampleRate * 0.25);
  const [l, r] = render(kind, sampleRate, length + fade);
  const out: Channels = [new Float32Array(length), new Float32Array(length)];
  for (const [ch, src] of [l, r].entries()) {
    const dst = out[ch];
    dst.set(src.subarray(0, length));
    for (let i = 0; i < fade; i++) {
      const k = i / fade;
      dst[i] = src[i] * k + src[length + i] * (1 - k);
    }
  }
  let sum = 0;
  let peak = 0;
  for (const ch of out)
    for (let i = 0; i < length; i++) {
      sum += ch[i] * ch[i];
      peak = Math.max(peak, Math.abs(ch[i]));
    }
  const rms = Math.sqrt(sum / (2 * length)) || 1;
  const gain = Math.min(TARGET_RMS / rms, 0.95 / (peak || 1));
  for (const ch of out) for (let i = 0; i < length; i++) ch[i] *= gain;
  return out;
}
