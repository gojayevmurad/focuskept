export type MediaErrorCode = "denied" | "not_found" | "in_use" | "unknown";

export class LocalMediaError extends Error {
  constructor(readonly code: MediaErrorCode) {
    super(code);
  }
}

export async function getLocalMedia({
  audio,
}: {
  audio: boolean;
}): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 20, max: 24 },
      },
      audio: audio
        ? {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          }
        : false,
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    const code: MediaErrorCode =
      name === "NotAllowedError" || name === "SecurityError"
        ? "denied"
        : name === "NotFoundError" || name === "DevicesNotFoundError"
          ? "not_found"
          : name === "NotReadableError" ||
              name === "TrackStartError" ||
              name === "AbortError"
            ? "in_use"
            : "unknown";
    throw new LocalMediaError(code);
  }
}
