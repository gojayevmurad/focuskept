import { Heading, Text } from "react-email";
import { EmailButton, EmailLayout, colors } from "./layout";

export type AuthEmailCopy = {
  subject: string;
  heading: string;
  body: string;
  button: string;
  ignore: string;
  footer: string;
};

export function AuthEmail({
  locale,
  url,
  copy,
}: {
  locale: string;
  url: string;
  copy: AuthEmailCopy;
}) {
  return (
    <EmailLayout locale={locale} preview={copy.heading} footer={copy.footer}>
      <Heading as="h1" style={{ fontSize: 22, margin: "0 0 12px" }}>
        {copy.heading}
      </Heading>
      <Text style={{ fontSize: 15, lineHeight: "24px" }}>{copy.body}</Text>
      <EmailButton href={url}>{copy.button}</EmailButton>
      <Text style={{ fontSize: 13, color: colors.muted, marginTop: 20 }}>
        {copy.ignore}
      </Text>
    </EmailLayout>
  );
}
