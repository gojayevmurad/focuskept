import { Heading, Text } from "react-email";
import { EmailButton, EmailLayout, colors } from "./layout";

export type DigestCopy = {
  preview: string;
  heading: string;
  intro: string;
  more: string | null;
  estimate: string;
  button: string;
  footer: string;
  unsubscribe: string;
};

export function ReviewDigestEmail({
  locale,
  topics,
  url,
  unsubscribeUrl,
  copy,
}: {
  locale: string;
  topics: string[];
  url: string;
  unsubscribeUrl: string;
  copy: DigestCopy;
}) {
  return (
    <EmailLayout
      locale={locale}
      preview={copy.preview}
      footer={copy.footer}
      unsubscribe={{ url: unsubscribeUrl, label: copy.unsubscribe }}
    >
      <Heading as="h1" style={{ fontSize: 22, margin: "0 0 12px" }}>
        {copy.heading}
      </Heading>
      <Text style={{ fontSize: 15, lineHeight: "24px" }}>{copy.intro}</Text>
      <ul
        style={{
          paddingInlineStart: 20,
          margin: "0 0 12px",
          fontSize: 15,
          lineHeight: "24px",
        }}
      >
        {topics.map((topic, i) => (
          <li key={i} dir="auto">
            {topic}
          </li>
        ))}
      </ul>
      {copy.more && (
        <Text style={{ fontSize: 14, color: colors.muted, margin: "0 0 12px" }}>
          {copy.more}
        </Text>
      )}
      <Text style={{ fontSize: 14, color: colors.muted }}>{copy.estimate}</Text>
      <EmailButton href={url}>{copy.button}</EmailButton>
    </EmailLayout>
  );
}
