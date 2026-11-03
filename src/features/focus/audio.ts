"use client";
// Procedural audio with the Web Audio API: no sound files are
// needed for the chime or any background except the optional café file.
import { renderSoundscape, type Soundscape } from "./soundscapes";

let context: AudioContext | null = null;

function audio() {
  if (typeof window === "undefined") return null;
  if (!context) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    context = new Ctor();
  }
  if (context.state === "suspended") void context.resume().catch(() => {});
  return context;
}

// A page reloaded mid-session starts its background sound before any click,
// and browsers keep that audio suspended; resume it on the first gesture.
if (typeof window !== "undefined")
  for (const type of ["pointerdown", "keydown"] as const)
    window.addEventListener(
      type,
      () => {
        if (context?.state === "suspended")
          void context.resume().catch(() => {});
      },
      { capture: true, passive: true },
    );

/** Call from a user gesture (e.g. Start) so later chimes are allowed to play. */
export function unlockAudio() {
  audio();
}

/** A soft two-note chime for phase changes. */
export function playChime(volume = 0.6, kind: "break" | "focus" = "break") {
  const ctx = audio();
  if (!ctx || volume <= 0) return;
  const notes = kind === "break" ? [659.25, 523.25] : [523.25, 659.25];
  notes.forEach((frequency, i) => {
    const start = ctx.currentTime + i * 0.22;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.25 * volume, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.1);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 1.2);
  });
}

const loops = new Map<Soundscape, Promise<AudioBuffer | null>>();
let renderer: Worker | null | undefined;
const waiting = new Map<Soundscape, (channels: Float32Array[]) => void>();

/** Renders (once per page) and caches a soundscape loop, in a worker when possible. */
function loop(ctx: AudioContext, kind: Soundscape) {
  let pending = loops.get(kind);
  if (!pending) {
    pending = new Promise<Float32Array[]>((resolve) => {
      if (renderer === undefined) {
        try {
          renderer = new Worker(
            new URL("./soundscape.worker.ts", import.meta.url),
          );
          renderer.onmessage = (
            event: MessageEvent<{
              kind: Soundscape;
              left: Float32Array;
              right: Float32Array;
            }>,
          ) => {
            const { kind: done, left, right } = event.data;
            waiting.get(done)?.([left, right]);
            waiting.delete(done);
          };
        } catch {
          renderer = null;
        }
      }
      if (renderer) {
        waiting.set(kind, resolve);
        renderer.postMessage({ kind, sampleRate: ctx.sampleRate });
      } else resolve(renderSoundscape(kind, ctx.sampleRate));
    }).then((channels) => {
      const buffer = ctx.createBuffer(2, channels[0].length, ctx.sampleRate);
      channels.forEach((data, i) => buffer.getChannelData(i).set(data));
      return buffer;
    });
    loops.set(kind, pending);
  }
  return pending;
}

export type Background = "none" | Soundscape | "cafe";
const LEVEL = 0.9;

export class BackgroundSound {
  private source: AudioBufferSourceNode | null = null;
  private element: HTMLAudioElement | null = null;
  private gain: GainNode | null = null;
  private request = 0;
  current: Background = "none";

  play(kind: Background, volume: number) {
    if (kind === this.current) return this.setVolume(volume);
    this.stop();
    this.current = kind;
    if (kind === "none") return;
    if (kind === "cafe") {
      this.element = new Audio(`/sounds/${kind}.mp3`);
      this.element.loop = true;
      this.element.volume = volume;
      void this.element.play().catch(() => {});
      return;
    }
    const ctx = audio();
    if (!ctx) return;
    const request = ++this.request;
    void loop(ctx, kind).then((buffer) => {
      // Stopped or switched while the loop was rendering.
      if (!buffer || request !== this.request) return;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(volume * LEVEL, ctx.currentTime + 1.2);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(gain).connect(ctx.destination);
      source.start();
      this.source = source;
      this.gain = gain;
    });
  }

  setVolume(volume: number) {
    if (this.gain && context)
      this.gain.gain.setTargetAtTime(volume * LEVEL, context.currentTime, 0.05);
    if (this.element) this.element.volume = volume;
  }

  stop() {
    this.request++;
    const { source, gain } = this;
    if (source && gain && context) {
      // A short fade instead of a click.
      const now = context.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.25);
      try {
        source.stop(now + 0.3);
      } catch {}
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
      };
    }
    this.element?.pause();
    this.source = null;
    this.gain = null;
    this.element = null;
    this.current = "none";
  }
}

/** Café needs a CC0 file in /public/sounds; the option stays hidden until it exists. */
export async function availableFileSounds(): Promise<"cafe"[]> {
  try {
    const r = await fetch("/sounds/cafe.mp3", { method: "HEAD" });
    if (r.ok && (r.headers.get("content-type") ?? "").startsWith("audio"))
      return ["cafe"];
  } catch {}
  return [];
}
