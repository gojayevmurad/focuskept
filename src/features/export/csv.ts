/** RFC 4180 CSV with protection against spreadsheet formula injection. */
export function csvCell(value: unknown) {
  if (value === null || value === undefined) return "";
  let text =
    value instanceof Date
      ? value.toISOString()
      : Array.isArray(value)
        ? value.join(" ")
        : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(columns: string[], rows: Record<string, unknown>[]) {
  const lines = [
    columns.join(","),
    ...rows.map((row) => columns.map((c) => csvCell(row[c])).join(",")),
  ];
  return "﻿" + lines.join("\r\n") + "\r\n";
}
