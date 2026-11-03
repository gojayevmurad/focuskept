import { vi } from "vitest";

export type MockReply = {
  content: unknown;
  status?: number;
  usage?: { prompt_tokens: number; completion_tokens: number };
};

/** Intercepts OpenAI HTTP calls at the network boundary (global fetch). */
export function mockOpenAI(
  replies: MockReply[] | ((body: unknown) => MockReply),
) {
  const calls: { body: Record<string, unknown> }[] = [];
  const queue = Array.isArray(replies) ? [...replies] : null;
  const real = globalThis.fetch;
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (!url.startsWith("https://ai.mock.test/")) return real(input, init);
      const raw =
        init?.body ?? (input instanceof Request ? await input.text() : "{}");
      const body = JSON.parse(
        typeof raw === "string"
          ? raw
          : new TextDecoder().decode(raw as ArrayBuffer),
      );
      calls.push({ body });
      const reply = queue
        ? queue.shift()
        : (replies as (b: unknown) => MockReply)(body);
      if (!reply) throw new Error("No mock reply left");
      if (reply.status && reply.status >= 400)
        return new Response(
          JSON.stringify({ error: { message: "mock failure" } }),
          {
            status: reply.status,
            headers: { "content-type": "application/json" },
          },
        );
      return new Response(
        JSON.stringify({
          id: "chatcmpl-mock",
          object: "chat.completion",
          created: 0,
          model: "gpt-4.1-mini",
          choices: [
            {
              index: 0,
              finish_reason: "stop",
              message: {
                role: "assistant",
                content:
                  typeof reply.content === "string"
                    ? reply.content
                    : JSON.stringify(reply.content),
                refusal: null,
              },
            },
          ],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 50,
            total_tokens: 150,
            ...reply.usage,
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  );
  return calls;
}

export const sampleAnalysis = {
  analysis: {
    language: "en",
    clarityScore: 72,
    gaps: ["You did not say where the energy comes from."],
    mistakes: [],
    rewriteSuggestion: "Plants use sunlight to turn water and air into sugar.",
  },
  questions: [
    {
      type: "open",
      prompt: "Why do plants need sunlight?",
      answer: "It provides the energy to make sugar.",
      explanation: "Light powers photosynthesis.",
    },
    {
      type: "true_false",
      prompt: "Plants release oxygen.",
      answer: "TRUE",
      explanation: "Oxygen is a by-product.",
    },
    {
      type: "cloze",
      prompt: "Plants make ____ from water and carbon dioxide.",
      answer: "sugar",
      explanation: "Glucose is the product.",
    },
    {
      type: "cloze",
      prompt: "No blank here",
      answer: "x",
      explanation: "Invalid and dropped.",
    },
  ],
};
