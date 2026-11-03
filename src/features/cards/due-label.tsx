import { diffDays } from "@/src/lib/dates";

/** "Due today" / "Overdue" / "Due in 3 days" with Intl.RelativeTimeFormat. */
export function dueLabel(
  dueOn: string,
  today: string,
  locale: string,
  t: (key: "dueToday" | "overdue" | "due", values?: { when: string }) => string,
) {
  const days = diffDays(today, dueOn);
  if (days === 0) return t("dueToday");
  if (days < 0) return t("overdue");
  const when = new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
    days,
    "day",
  );
  return t("due", { when });
}
