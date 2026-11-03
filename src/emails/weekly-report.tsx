import { Heading, Section, Text } from "react-email";
import { EmailButton, EmailLayout, colors } from "./layout";

export type WeeklyCopy = {
  preview: string;
  heading: string;
  intro: string;
  stats: { label: string; value: string }[];
  suggestionTitle: string;
  suggestion: string;
  recap: { title: string; text: string; topics: string[] } | null;
  button: string;
  footer: string;
  unsubscribe: string;
};

export function WeeklyReportEmail({
  locale,
  url,
  unsubscribeUrl,
  copy,
}: {
  locale: string;
  url: string;
  unsubscribeUrl: string;
  copy: WeeklyCopy;
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
      <Section
        style={{
          border: `1px solid ${colors.border}`,
          borderRadius: 10,
          padding: "6px 14px",
          margin: "8px 0 16px",
        }}
      >
        {copy.stats.map((stat) => (
          <Text key={stat.label} style={{ fontSize: 15, margin: "8px 0" }}>
            <span style={{ color: colors.muted }}>{stat.label}: </span>
            <strong>{stat.value}</strong>
          </Text>
        ))}
      </Section>
      <Text style={{ fontSize: 15, fontWeight: 600, margin: "0 0 4px" }}>
        {copy.suggestionTitle}
      </Text>
      <Text style={{ fontSize: 15, lineHeight: "24px", marginTop: 0 }}>
        {copy.suggestion}
      </Text>
      {copy.recap && (
        <Section
          style={{
            backgroundColor: colors.background,
            borderRadius: 10,
            padding: "4px 14px",
            margin: "8px 0 16px",
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: 600 }}>
            {copy.recap.title}
          </Text>
          <Text style={{ fontSize: 14, lineHeight: "22px" }}>
            {copy.recap.text}
          </Text>
          {copy.recap.topics.length > 0 && (
            <ul style={{ paddingInlineStart: 20, fontSize: 14 }}>
              {copy.recap.topics.map((t, i) => (
                <li key={i} dir="auto">
                  {t}
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}
      <EmailButton href={url}>{copy.button}</EmailButton>
    </EmailLayout>
  );
}
