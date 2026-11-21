// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";
import { Client } from "pg";
import { getEnv } from "@/src/config/env";
import { logger } from "@/src/lib/logger";
import type { RealtimeMessage, Topic } from "./types";

type Listener = (message: RealtimeMessage) => void;

// One LISTEN connection per process, shared by every SSE stream.
type BusState = {
  client?: Client;
  connecting?: Promise<void>;
  listeners: Map<Topic, Set<Listener>>;
};
const state = globalThis as unknown as { __realtime?: BusState };
const bus: BusState = (state.__realtime ??= { listeners: new Map() });

async function connect() {
  if (bus.client) return;
  if (bus.connecting) return bus.connecting;
  bus.connecting = (async () => {
    const url = getEnv().DATABASE_URL;
    if (!url) throw new Error("Realtime requires DATABASE_URL");
    const client = new Client({ connectionString: url });
    client.on("notification", (msg) => {
      if (msg.channel !== "realtime" || !msg.payload) return;
      let parsed: RealtimeMessage;
      try {
        parsed = JSON.parse(msg.payload);
      } catch {
        return;
      }
      for (const listener of bus.listeners.get(parsed.topic) ?? [])
        try {
          listener(parsed);
        } catch (error) {
          logger.warn({ err: error }, "Realtime listener failed");
        }
    });
    const reset = () => {
      if (bus.client === client) bus.client = undefined;
      client.removeAllListeners();
      client.end().catch(() => {});
      // Reconnect while anyone is still listening.
      if ([...bus.listeners.values()].some((s) => s.size))
        setTimeout(() => connect().catch(() => {}), 2000);
    };
    client.on("error", (error) => {
      logger.warn({ err: error }, "Realtime connection lost");
      reset();
    });
    client.on("end", reset);
    await client.connect();
    await client.query("LISTEN realtime");
    bus.client = client;
  })().finally(() => {
    bus.connecting = undefined;
  });
  return bus.connecting;
}

export async function subscribe(topics: Topic[], listener: Listener) {
  await connect();
  for (const topic of topics) {
    let set = bus.listeners.get(topic);
    if (!set) bus.listeners.set(topic, (set = new Set<Listener>()));
    set.add(listener);
  }
  return () => {
    for (const topic of topics) {
      const set = bus.listeners.get(topic);
      set?.delete(listener);
      if (set && !set.size) bus.listeners.delete(topic);
    }
  };
}
