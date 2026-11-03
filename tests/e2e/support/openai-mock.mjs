// OpenAI-compatible mock used only by Playwright (AI_BASE_URL points here).
import { createServer } from "node:http";

const port = Number(process.env.OPENAI_MOCK_PORT || 3999);
const replies = {
  analyze_and_generate: {
    analysis: {
      language: "en",
      clarityScore: 78,
      gaps: ["Say where the plant gets its energy from."],
      mistakes: [],
      rewriteSuggestion:
        "Plants use sunlight to turn water and carbon dioxide into sugar and oxygen.",
    },
    questions: [
      {
        type: "true_false",
        prompt: "Plants release oxygen.",
        answer: "true",
        explanation: "Oxygen is a by-product.",
      },
      {
        type: "cloze",
        prompt: "Plants turn water and carbon dioxide into ____.",
        answer: "sugar",
        explanation: "Sugar stores the energy.",
      },
      {
        type: "open",
        prompt: "Why do plants need sunlight?",
        answer: "It gives the energy to make sugar.",
        explanation: "Light powers photosynthesis.",
      },
    ],
  },
  grade_open_answer: (body) => {
    const text = JSON.stringify(body.messages ?? "").toLowerCase();
    const right = text.includes("energy");
    return {
      verdict: right ? "correct" : "incorrect",
      feedback: right
        ? "Exactly: light gives the energy."
        : "Think about what light provides.",
    };
  },
};

createServer((req, res) => {
  let raw = "";
  req.on("data", (chunk) => (raw += chunk));
  req.on("end", () => {
    if (req.method !== "POST" || !req.url?.endsWith("/chat/completions")) {
      res.writeHead(404).end();
      return;
    }
    const body = JSON.parse(raw || "{}");
    const name = body.response_format?.json_schema?.name;
    const reply = replies[name];
    const content = typeof reply === "function" ? reply(body) : reply;
    res.writeHead(content ? 200 : 400, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        id: "chatcmpl-e2e",
        object: "chat.completion",
        created: 0,
        model: body.model,
        choices: [
          {
            index: 0,
            finish_reason: "stop",
            message: {
              role: "assistant",
              content: JSON.stringify(content ?? {}),
              refusal: null,
            },
          },
        ],
        usage: { prompt_tokens: 120, completion_tokens: 80, total_tokens: 200 },
      }),
    );
  });
}).listen(port, "127.0.0.1", () => console.log(`OpenAI mock on ${port}`));
