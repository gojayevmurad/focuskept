// Renders a soundscape loop off the main thread (some take a few hundred ms).
import { renderSoundscape, type Soundscape } from "./soundscapes";

self.onmessage = (
  event: MessageEvent<{ kind: Soundscape; sampleRate: number }>,
) => {
  const { kind, sampleRate } = event.data;
  const [left, right] = renderSoundscape(kind, sampleRate);
  (self as unknown as Worker).postMessage({ kind, left, right }, [
    left.buffer,
    right.buffer,
  ]);
};
