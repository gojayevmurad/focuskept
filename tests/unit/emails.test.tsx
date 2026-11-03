import { describe, expect, it } from "vitest";
import { render } from "react-email";
import { ReviewDigestEmail } from "@/src/emails/review-digest";
import { WeeklyReportEmail } from "@/src/emails/weekly-report";
import { AuthEmail } from "@/src/emails/auth-email";

const digestCopy = {
  preview: "p",
  heading: "Time to review 3 cards",
  intro: "intro",
  more: null,
  estimate: "About 2 minutes.",
  button: "Start review",
  footer: "footer",
  unsubscribe: "Unsubscribe",
};

describe("email templates", () => {
  it("render HTML and a plain-text part with unsubscribe links", async () => {
    const element = (
      <ReviewDigestEmail
        locale="en"
        topics={["Cells", "Photosynthesis"]}
        url="https://focuskept.com/en/app/review"
        unsubscribeUrl="https://focuskept.com/api/unsubscribe?token=t"
        copy={digestCopy}
      />
    );
    const html = await render(element);
    const text = await render(element, { plainText: true });
    expect(html).toContain('lang="en"');
    expect(html).toContain("https://focuskept.com/api/unsubscribe?token=t");
    expect(text).toContain("Photosynthesis");
    expect(text).toContain("Start review");
  });
  it("renders right-to-left for Arabic", async () => {
    const html = await render(
      <WeeklyReportEmail
        locale="ar"
        url="https://focuskept.com/ar/app/stats"
        unsubscribeUrl="https://focuskept.com/api/unsubscribe?token=t"
        copy={{
          preview: "p",
          heading: "أسبوعك",
          intro: "i",
          stats: [{ label: "التركيز", value: "120" }],
          suggestionTitle: "s",
          suggestion: "s",
          recap: { title: "r", text: "t", topics: ["خلية"] },
          button: "b",
          footer: "f",
          unsubscribe: "u",
        }}
      />,
    );
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("خلية");
    const auth = await render(
      <AuthEmail
        locale="de"
        url="https://x.test/v"
        copy={{
          subject: "s",
          heading: "h",
          body: "b",
          button: "Bestätigen",
          ignore: "i",
          footer: "f",
        }}
      />,
    );
    expect(auth).toContain("Bestätigen");
  });
});
