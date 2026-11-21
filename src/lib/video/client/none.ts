// SPDX-License-Identifier: AGPL-3.0-only
import type { JoinCredentials, VideoClient } from "../types";
import { VideoEvents } from "./events";

export class NoneVideoClient extends VideoEvents implements VideoClient {
  readonly provider = "none";
  async join(credentials: JoinCredentials) {
    if (credentials.provider !== this.provider)
      throw new Error("Invalid video credentials");
    this.emit("connection", "connected");
  }
  async publishTracks() {
    return {};
  }
  async subscribe() {}
  async unsubscribe() {}
  async setMicrophone() {}
  async setRemoteVideo() {}
  async getStats() {
    return {};
  }
  async leave() {
    this.emit("connection", "closed");
  }
}
