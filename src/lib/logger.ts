import pino from "pino";
export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  redact: {
    paths: [
      "password",
      "token",
      "secret",
      "email",
      "authorization",
      "cookie",
      "headers",
      "req.headers",
      "*.password",
      "*.token",
      "*.secret",
      "*.email",
    ],
    censor: "[REDACTED]",
  },
  serializers: { err: pino.stdSerializers.err },
  ...(process.env.NODE_ENV === "development"
    ? { transport: { target: "pino-pretty", options: { colorize: true } } }
    : {}),
});
