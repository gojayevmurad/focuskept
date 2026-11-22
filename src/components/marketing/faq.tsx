// SPDX-License-Identifier: AGPL-3.0-only
import { Plus } from "lucide-react";
import styles from "./marketing.module.css";
import type { Faq } from "@/src/lib/content/seo";
import { JsonLd } from "./json-ld";
export function FaqList({
  items,
  structured = false,
}: {
  items: Faq[];
  structured?: boolean;
}) {
  return (
    <>
      <div className={styles.faq}>
        {items.map((item) => (
          <details key={item.q}>
            <summary>
              <span>{item.q}</span>
              <Plus size={20} aria-hidden="true" />
            </summary>
            <p>{item.a}</p>
          </details>
        ))}
      </div>
      {structured && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: items.map((item) => ({
              "@type": "Question",
              name: item.q,
              acceptedAnswer: { "@type": "Answer", text: item.a },
            })),
          }}
        />
      )}
    </>
  );
}
