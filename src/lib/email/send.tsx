import "server-only";
import { Resend } from "resend";
import { Html, Body, Container, Heading, Text, Button } from "react-email";
import { getEnv } from "@/src/config/env";
import { db } from "@/src/lib/db";
import { emailPreview } from "@/src/lib/db/schema";
import { logger } from "@/src/lib/logger";
export async function sendAuthEmail(
  to: string,
  url: string,
  kind: "verification" | "reset",
) {
  const env = getEnv();
  if (env.EMAIL_MODE === "preview") {
    await db()
      .insert(emailPreview)
      .values({ id: crypto.randomUUID(), recipient: to, url, kind });
    logger.info({ kind }, "Email saved to development email inbox");
    return;
  }
  const title =
    kind === "verification" ? "Verify your email" : "Reset your password";
  const result = await new Resend(env.RESEND_API_KEY).emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: title,
    react: (
      <Html>
        <Body style={{ backgroundColor: "#f5f6f8", fontFamily: "Arial" }}>
          <Container style={{ padding: 32, backgroundColor: "white" }}>
            <Heading>{title}</Heading>
            <Text>
              Use the secure link below to continue. If you did not request
              this, ignore this email.
            </Text>
            <Button
              href={url}
              style={{
                backgroundColor: "#635bff",
                color: "white",
                padding: 16,
                borderRadius: 8,
              }}
            >
              {title}
            </Button>
          </Container>
        </Body>
      </Html>
    ),
  });
  if (result.error) {
    logger.error({ code: result.error.name }, "Email delivery failed");
    throw new Error("Email could not be sent");
  }
}
