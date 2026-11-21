import "server-only";
import { getEnv } from "@/src/config/env";
import { VideoError } from "./errors";

export function videoEnv() {
  try {
    return getEnv();
  } catch {
    throw new VideoError(
      "Video provider is not configured. Check the server environment.",
      503,
    );
  }
}
