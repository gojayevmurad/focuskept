// SPDX-License-Identifier: AGPL-3.0-only
export interface SecurityTxtOptions {
  contact?: string | null;
  adminEmails?: string[];
  appUrl?: string;
  now?: Date;
}

export function formatSecurityContact(
  contact?: string | null,
  adminEmails: string[] = [],
): string {
  const explicit = contact?.trim();
  if (explicit) {
    if (
      explicit.startsWith("mailto:") ||
      explicit.startsWith("https://") ||
      explicit.startsWith("http://")
    ) {
      return explicit;
    }
    return `mailto:${explicit}`;
  }

  const firstAdmin = adminEmails.find((email) => email.trim().length > 0);
  if (firstAdmin) {
    const trimmed = firstAdmin.trim();
    return trimmed.startsWith("mailto:") ? trimmed : `mailto:${trimmed}`;
  }

  return "mailto:security@focuskept.com";
}

export function generateSecurityTxt(options?: SecurityTxtOptions): string {
  const now = options?.now ?? new Date();
  const expiresDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const expires = expiresDate.toISOString();

  const contact = formatSecurityContact(
    options?.contact,
    options?.adminEmails,
  );

  const rawUrl = options?.appUrl?.trim() || "https://focuskept.com";
  const appUrl = rawUrl.replace(/\/+$/, "");
  const canonical = `${appUrl}/.well-known/security.txt`;
  const policy =
    "https://github.com/gojayevmurad/focuskept/blob/main/SECURITY.md";

  return [
    `Contact: ${contact}`,
    `Expires: ${expires}`,
    "Preferred-Languages: en",
    `Policy: ${policy}`,
    `Canonical: ${canonical}`,
  ].join("\n") + "\n";
}
