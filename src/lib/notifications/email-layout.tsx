import {
  Body,
  Button,
  Container,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "react-email";

export function EmailLayout(props: {
  appName: string;
  preview: string;
  heading: string;
  lines: string[];
  cta?: { label: string; url: string };
  footer: string;
}) {
  return (
    <Html>
      <Preview>{props.preview}</Preview>
      <Body
        style={{
          backgroundColor: "#f7f6f2",
          fontFamily: "Helvetica, Arial, sans-serif",
          color: "#1d2320",
        }}
      >
        <Container
          style={{
            maxWidth: 520,
            margin: "24px auto",
            padding: 28,
            backgroundColor: "#ffffff",
            borderRadius: 12,
          }}
        >
          <Text style={{ fontWeight: 700, fontSize: 16, margin: "0 0 18px" }}>
            {props.appName}
          </Text>
          <Heading style={{ fontSize: 22, margin: "0 0 12px" }}>
            {props.heading}
          </Heading>
          {props.lines.map((line, i) => (
            <Text
              key={i}
              style={{ fontSize: 15, lineHeight: "22px", margin: "0 0 10px" }}
            >
              {line}
            </Text>
          ))}
          {props.cta && (
            <Section style={{ margin: "20px 0 8px" }}>
              <Button
                href={props.cta.url}
                style={{
                  backgroundColor: "#2F6F62",
                  color: "#ffffff",
                  padding: "12px 20px",
                  borderRadius: 999,
                  fontWeight: 600,
                  fontSize: 15,
                }}
              >
                {props.cta.label}
              </Button>
            </Section>
          )}
          <Text style={{ fontSize: 12, color: "#8a918d", marginTop: 24 }}>
            {props.footer}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
