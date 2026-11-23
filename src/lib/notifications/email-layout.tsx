// SPDX-License-Identifier: AGPL-3.0-only
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "react-email";
import { emailColors as c, type EmailBrand } from "@/src/lib/email/brand";

const font = '"Helvetica Neue", Helvetica, Arial, sans-serif';

/**
 * One layout for auth, product, lifecycle and support mail. Inline styles and
 * literal colors only. The header is a deep-ink band; the kit logo is an opaque
 * PNG of the same color, so it stays legible if a dark-mode client recolors the
 * band. Its alt text (the name) is styled for clients that block images.
 */
export function EmailLayout(props: {
  brand: EmailBrand;
  preview: string;
  heading: string;
  lines: string[];
  cta?: { label: string; url: string };
  footer?: string;
  unsubscribeUrl?: string;
  unsubscribeLabel?: string;
  lang?: string;
}) {
  const { brand } = props;
  return (
    <Html lang={props.lang ?? "en"}>
      <Head>
        <meta name="color-scheme" content="light only" />
        <meta name="supported-color-schemes" content="light only" />
      </Head>
      <Preview>{props.preview}</Preview>
      <Body
        style={{
          backgroundColor: c.ground,
          fontFamily: font,
          color: c.text,
          margin: 0,
          padding: "24px 12px",
        }}
      >
        <Container
          style={{
            maxWidth: 560,
            backgroundColor: c.surface,
            border: `1px solid ${c.border}`,
            borderRadius: 14,
            overflow: "hidden",
          }}
        >
          <Section
            style={{
              backgroundColor: c.header,
              padding: brand.logo ? "14px 22px" : "20px 28px",
            }}
          >
            <Link
              href={brand.homeUrl}
              style={{
                color: c.headerText,
                fontSize: 18,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              {brand.logo ? (
                <Img
                  src={brand.logo.src}
                  width={brand.logo.width}
                  height={brand.logo.height}
                  alt={brand.name}
                  style={{
                    display: "block",
                    border: 0,
                    color: c.headerText,
                    fontFamily: font,
                    fontSize: 18,
                    fontWeight: 700,
                    lineHeight: `${brand.logo.height}px`,
                  }}
                />
              ) : (
                brand.name
              )}
            </Link>
          </Section>
          <Section style={{ padding: "28px 28px 8px" }}>
            <Heading
              as="h1"
              style={{
                fontSize: 22,
                lineHeight: "28px",
                fontWeight: 700,
                color: c.text,
                margin: "0 0 14px",
              }}
            >
              {props.heading}
            </Heading>
            {props.lines.map((line, i) => (
              <Text
                key={i}
                style={{
                  fontSize: 15,
                  lineHeight: "23px",
                  color: c.text,
                  margin: "0 0 10px",
                }}
              >
                {line}
              </Text>
            ))}
            {props.cta && (
              <Section style={{ margin: "22px 0 14px" }}>
                <Button
                  href={props.cta.url}
                  style={{
                    backgroundColor: c.button,
                    border: `1px solid ${c.button}`,
                    color: c.buttonText,
                    padding: "12px 22px",
                    borderRadius: 999,
                    fontWeight: 600,
                    fontSize: 15,
                    lineHeight: "20px",
                  }}
                >
                  {props.cta.label}
                </Button>
              </Section>
            )}
          </Section>
          {(props.footer || props.unsubscribeUrl) && (
            <Section
              style={{
                borderTop: `1px solid ${c.border}`,
                padding: "16px 28px 22px",
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  lineHeight: "18px",
                  color: c.muted,
                  margin: 0,
                }}
              >
                {props.footer}
                {props.unsubscribeUrl && (
                  <>
                    {props.footer ? " · " : null}
                    <a
                      href={props.unsubscribeUrl}
                      style={{ color: c.muted, textDecoration: "underline" }}
                    >
                      {props.unsubscribeLabel ?? "Unsubscribe"}
                    </a>
                  </>
                )}
              </Text>
            </Section>
          )}
        </Container>
      </Body>
    </Html>
  );
}
