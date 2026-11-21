import type { VideoClientEvents } from "../types";

export class VideoEvents {
  private listeners: {
    [E in keyof VideoClientEvents]: Set<VideoClientEvents[E]>;
  } = {
    remote: new Set(),
    connection: new Set(),
    quality: new Set(),
  };

  on<E extends keyof VideoClientEvents>(
    event: E,
    listener: VideoClientEvents[E],
  ): () => void {
    this.listeners[event].add(listener);
    return () => {
      this.listeners[event].delete(listener);
    };
  }

  protected emit<E extends keyof VideoClientEvents>(
    event: E,
    ...args: Parameters<VideoClientEvents[E]>
  ) {
    for (const listener of this.listeners[event]) {
      (listener as (...values: Parameters<VideoClientEvents[E]>) => void)(
        ...args,
      );
    }
  }
}
