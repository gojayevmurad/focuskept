import "server-only";
import type { VideoServerProvider } from "../types";

export const noneProvider: VideoServerProvider = {
  name: "none",
  async createRoom(focusSessionId) {
    return { roomId: focusSessionId };
  },
  async issueJoin({ focusSessionId }) {
    return { provider: "none", sessionId: focusSessionId };
  },
};
