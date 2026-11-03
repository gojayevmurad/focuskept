import { getTranslations } from "next-intl/server";
import { Link } from "@/src/i18n/navigation";
import { techniquesByGroup } from "./registry";
import { publicSlug } from "./slugs";
import { techniqueIcons } from "./icons";
import type { TechniqueContentMap } from "./content";

/** The 18 techniques, grouped, linking to their pages. */
export async function TechniqueGrid({
  content,
  headingLevel = 3,
}: {
  content: TechniqueContentMap;
  headingLevel?: 2 | 3;
}) {
  const t = await getTranslations("techniquesPage");
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <div className="stack" style={{ gap: 28 }}>
      {(["time", "learning", "planning"] as const).map((group) => (
        <section
          key={group}
          className="stack"
          style={{ gap: 12 }}
          aria-labelledby={`group-${group}`}
        >
          <Heading id={`group-${group}`} className="text-lg">
            {t(`groups.${group}`)}
          </Heading>
          <ul
            className="choice-grid"
            style={{ listStyle: "none", padding: 0, margin: 0 }}
          >
            {techniquesByGroup[group].map((entry) => {
              const Icon = techniqueIcons[entry.icon];
              return (
                <li key={entry.slug} className="flex">
                  <Link
                    href={`/techniques/${publicSlug(entry.slug)}`}
                    className="choice w-full"
                  >
                    <Icon
                      size={20}
                      className="text-accent"
                      aria-hidden="true"
                    />
                    <span className="choice-title">
                      {content[entry.slug].name}
                    </span>
                    <span className="choice-text">
                      {content[entry.slug].tagline}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
