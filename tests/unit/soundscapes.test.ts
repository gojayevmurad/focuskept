import { describe, expect, it } from "vitest";
import {
  renderSoundscape,
  SOUNDSCAPES,
} from "@/src/features/focus/soundscapes";

const SR = 16000;

describe.each(SOUNDSCAPES)("soundscape %s", (kind) => {
  const [left, right] = renderSoundscape(kind, SR);

  it("is finite, audible, levelled and never clips", () => {
    let sum = 0;
    let peak = 0;
    for (const ch of [left, right])
      for (const v of ch) {
        expect(Number.isFinite(v)).toBe(true);
        sum += v * v;
        peak = Math.max(peak, Math.abs(v));
      }
    const rms = Math.sqrt(sum / (left.length * 2));
    expect(rms).toBeGreaterThan(0.03);
    expect(rms).toBeLessThanOrEqual(0.1 + 1e-6);
    expect(peak).toBeLessThanOrEqual(0.95 + 1e-6);
  });

  it("loops without a click at the seam", () => {
    for (const ch of [left, right]) {
      const steps: number[] = [];
      for (let i = 1; i < ch.length; i += 7)
        steps.push(Math.abs(ch[i] - ch[i - 1]));
      steps.sort((a, b) => a - b);
      const typical = steps[Math.floor(steps.length * 0.99)];
      expect(Math.abs(ch[0] - ch[ch.length - 1])).toBeLessThanOrEqual(
        typical * 1.5 + 1e-4,
      );
    }
  });

  it("is the same on every device", () => {
    expect(renderSoundscape(kind, SR)[0].slice(0, 500)).toEqual(
      left.slice(0, 500),
    );
  });
});

it("binaural beat: each ear gets its own tone", () => {
  const [left, right] = renderSoundscape("binaural", SR);
  const corr = left.reduce((s, v, i) => s + v * right[i], 0);
  const energy = left.reduce((s, v) => s + v * v, 0);
  // 200 Hz vs 216 Hz drift in and out of phase: low correlation overall.
  expect(Math.abs(corr / energy)).toBeLessThan(0.3);
});
