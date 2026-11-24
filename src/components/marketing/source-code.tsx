// SPDX-License-Identifier: AGPL-3.0-only
import { GithubIcon } from "./github-icon";
import styles from "./source-code.module.css";

export function SourceCode({
  url,
  label,
  comingSoon,
  iconOnly = false,
}: {
  url?: string;
  label: string;
  comingSoon: string;
  iconOnly?: boolean;
}) {
  const name = url ? label : comingSoon;
  const content = (
    <>
      <GithubIcon />
      {!iconOnly && <span>{label}</span>}
    </>
  );
  const className = `${styles.source} ${iconOnly ? styles.icon : ""}`;
  return url ? (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      aria-label={name}
      title={name}
    >
      {content}
    </a>
  ) : (
    <button
      type="button"
      aria-disabled="true"
      aria-label={name}
      title={name}
      className={className}
    >
      {content}
    </button>
  );
}
