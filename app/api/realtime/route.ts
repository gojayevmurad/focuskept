import { getSession } from "@/src/lib/auth/session";
import { subscribe } from "@/src/lib/realtime/bus";
import { getParticipant } from "@/src/lib/sessions/access";
import type { Topic } from "@/src/lib/realtime/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-Sent Events for the signed-in user. Always includes `user:<id>`;
 * `?session=<id>` adds that focus session's topic if the user is in it.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.user.emailVerified) return new Response(null, { status: 401 });
  const userId = session.user.id;
  const topics: Topic[] = [`user:${userId}`];
  const focusId = new URL(request.url).searchParams.get("session");
  if (focusId) {
    if (!(await getParticipant(focusId, userId)))
      return new Response(null, { status: 404 });
    topics.push(`session:${focusId}`);
  }

  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };
      send("retry: 3000\n\n");
      const unsubscribe = await subscribe(topics, (message) =>
        send(`event: ${message.event}\ndata: ${JSON.stringify(message)}\n\n`),
      );
      // Comments keep proxies from closing an idle connection.
      const heartbeat = setInterval(() => send(": ping\n\n"), 25_000);
      cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
      };
      request.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
