import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "react-email";
import { brand } from "@/src/config/brand";
import { direction } from "@/src/i18n/config";

export const colors = {
  accent: "#23735F",
  text: "#1b1f1d",
  muted: "#59605c",
  border: "#e3e5e1",
  background: "#f3f4f1",
};

export function EmailLayout({
  locale,
  preview,
  children,
  footer,
  unsubscribe,
}: {
  locale: string;
  preview: string;
  children: React.ReactNode;
  footer: string;
  unsubscribe?: { url: string; label: string };
}) {
  const dir = direction(locale);
  return (
    <Html lang={locale} dir={dir}>
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
      </Head>
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: colors.background,
          color: colors.text,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans', Arial, sans-serif",
          margin: 0,
          padding: "24px 12px",
        }}
      >
        <Container
          style={{
            backgroundColor: "#ffffff",
            border: `1px solid ${colors.border}`,
            borderRadius: 14,
            maxWidth: 560,
            padding: 28,
            textAlign: dir === "rtl" ? "right" : "left",
          }}
        >
          <Text
            style={{
              fontSize: 17,
              fontWeight: 600,
              color: colors.accent,
              margin: "0 0 18px",
            }}
          >
            {brand.name}
          </Text>
          {children}
        </Container>
        <Section
          style={{ maxWidth: 560, margin: "0 auto", padding: "12px 4px" }}
        >
          <Hr style={{ borderColor: colors.border }} />
          <Text
            style={{ fontSize: 12, color: colors.muted, lineHeight: "18px" }}
          >
            {footer}
            {unsubscribe && (
              <>
                {" · "}
                <Link href={unsubscribe.url} style={{ color: colors.muted }}>
                  {unsubscribe.label}
                </Link>
              </>
            )}
          </Text>
          <Text style={{ fontSize: 12, color: colors.muted }}>
            {brand.name}
            {brand.postalAddress ? ` · ${brand.postalAddress}` : ""}
          </Text>
        </Section>
      </Body>
    </Html>
  );
}

export function EmailButton({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "inline-block",
        backgroundColor: colors.accent,
        color: "#ffffff",
        padding: "12px 20px",
        borderRadius: 10,
        fontWeight: 600,
        fontSize: 15,
        textDecoration: "none",
      }}
    >
      {children}
    </Link>
  );
}
