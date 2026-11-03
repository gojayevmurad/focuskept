"use client";
import { BarChart3, Layers, ListChecks, Timer } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/src/i18n/navigation";

const items = [
  { href: "/app", key: "timer", icon: Timer },
  { href: "/app/tasks", key: "tasks", icon: ListChecks },
  { href: "/app/cards", key: "cards", icon: Layers },
  { href: "/app/stats", key: "stats", icon: BarChart3 },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/app")
    return pathname === "/app" || pathname.startsWith("/app/focus");
  if (href === "/app/cards")
    return (
      pathname.startsWith("/app/cards") || pathname.startsWith("/app/review")
    );
  return pathname.startsWith(href);
}

/** Desktop: centred pill nav. Phone: four-item tab bar. */
export function AppNav({
  dueCount,
  variant,
}: {
  dueCount: number;
  variant: "pills" | "tabs";
}) {
  const t = useTranslations("common.nav");
  const pathname = usePathname();
  return (
    <nav
      aria-label={t("appNavigation")}
      className={variant === "pills" ? "pill-nav" : "tab-bar"}
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(pathname, item.href) ? "page" : undefined}
        >
          {variant === "tabs" && <item.icon size={21} aria-hidden="true" />}
          <span>{t(item.key)}</span>
          {item.key === "cards" && dueCount > 0 && (
            <span className="due-dot" title={t("reviewsDue")}>
              <span className="sr-only">{t("reviewsDue")}</span>
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
