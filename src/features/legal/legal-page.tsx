import type { LegalDocument } from "./content";

// These are drafts written for FocusKept; they are not legal advice and do
// not claim compliance with any specific law.
export function LegalPage({
  doc,
}: {
  doc: Pick<LegalDocument, "title" | "intro" | "sections"> & {
    updated?: string;
  };
}) {
  return (
    <article
      className="container-narrow prose"
      style={{ paddingBlock: "56px 24px" }}
    >
      <h1 className="text-3xl sm:text-4xl" style={{ marginBlockEnd: 8 }}>
        {doc.title}
      </h1>
      {doc.updated && <p className="small muted">{doc.updated}</p>}
      <p>{doc.intro}</p>
      {doc.sections.map((section) => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          {section.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </section>
      ))}
    </article>
  );
}
