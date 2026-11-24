// SPDX-License-Identifier: AGPL-3.0-only
import { getTranslations } from "next-intl/server";
import {
  CalendarPlus,
  Home,
  Users,
  TrendingUp,
  UsersRound,
  Gift,
  Mic,
  Settings,
  ShieldCheck,
  CreditCard,
} from "lucide-react";
import { getAppConfig } from "@/src/config/app";
import { requireAppUser } from "@/src/lib/app-user";
import { getPlan, weeklyUsage } from "@/src/lib/billing/plan";
import { Logo } from "./logo";
import { NavLink } from "./nav-link";
import { ThemeToggle } from "./theme-toggle";
import { SignOut } from "./sign-out";
import { AnalyticsIdentity } from "./consent";
import { Avatar } from "./avatar";
import { RealtimeRefresh } from "./realtime-refresh";
import { Link } from "@/src/i18n/navigation";
import { LocaleSwitcher } from "./locale-switcher";
import { TourTrigger } from "./tour";
import { AppShellMenu } from "./app-shell-menu";
import { SourceCode } from "./marketing/source-code";
import styles from "./app-shell.module.css";
import { ActivationNudge } from "@/src/lib/lifecycle/activation-nudge";

export async function AppShell({
  children,
  title,
  narrow = false,
}: {
  children: React.ReactNode;
  title: string;
  narrow?: boolean;
}) {
  const { user, profile, isAdmin } = await requireAppUser();
  const [t, site, common] = await Promise.all([
    getTranslations("nav"),
    getTranslations("site"),
    getTranslations("common"),
  ]);
  const app = getAppConfig();
  const { plan } = await getPlan(user.id);
  const usage =
    plan === "free" ? await weeklyUsage(user.id, profile.timezone) : null;
  const primary = [
    { href: "/dashboard", label: t("home"), icon: Home },
    { href: "/book", label: t("book"), icon: CalendarPlus },
    { href: "/people", label: t("people"), icon: Users },
    { href: "/groups", label: t("groups"), icon: UsersRound },
    { href: "/progress", label: t("progress"), icon: TrendingUp },
  ];
  const grow = [
    { href: "/invite", label: t("invite"), icon: Gift },
    { href: "/hosting", label: t("host"), icon: Mic },
  ];
  const account = [
    { href: "/settings", label: t("settings"), icon: Settings },
    ...(app.billingEnabled
      ? [{ href: "/billing", label: t("billing"), icon: CreditCard }]
      : []),
    ...(isAdmin
      ? [{ href: "/admin", label: t("admin"), icon: ShieldCheck }]
      : []),
  ];
  const navigation = (
    <nav className={`nav ${styles.navigation}`} aria-label={app.name}>
      {[
        { label: t("main"), items: primary },
        { label: t("grow"), items: grow },
        { label: t("account"), items: account },
      ].map((group) => (
        <div
          role="group"
          aria-label={group.label}
          className={styles.navGroup}
          key={group.label}
        >
          <p className={styles.groupLabel}>{group.label}</p>
          {group.items.map((n) => (
            <NavLink key={n.href} href={n.href}>
              <n.icon size={18} aria-hidden="true" />
              <span>{n.label}</span>
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
  const footer = (
    <div className={`sidebar-foot ${styles.footer}`}>
      {app.billingEnabled && (
        <div className="plan-box">
          {usage ? (
            <>
              <span>
                {t("freeLeft", {
                  used: Math.min(usage.used, usage.limit),
                  limit: usage.limit,
                })}
              </span>
              <Link href="/pricing" className="button small">
                {t("unlimited")}
              </Link>
            </>
          ) : (
            <span className="badge accent">{t("plusActive")}</span>
          )}
        </div>
      )}
      <div className={styles.preferences}>
        <LocaleSwitcher label={t("language")} />
        <ThemeToggle />
      </div>
      <SourceCode
        url={app.repoUrl}
        label={site("source")}
        comingSoon={site("sourceComingSoon")}
      />
      <div className="row">
        <Avatar name={profile.displayName} src={profile.avatarUrl} size="sm" />
        <span className="grow small">{profile.displayName}</span>
        <SignOut compact />
      </div>
    </div>
  );
  return (
    <div className={`app ${styles.shell}`}>
      <aside className={`sidebar ${styles.sidebar}`}>
        <Logo name={app.name} logoUrl={app.logoUrl} href="/dashboard" />
        {navigation}
        {footer}
      </aside>
      <div className="main">
        <header className="topbar">
          <span className="topbar-title">{title}</span>
          <TourTrigger className="button ghost small" />
          <AppShellMenu label={t("more")} closeLabel={common("close")}>
            {navigation}
            {footer}
          </AppShellMenu>
        </header>
        <main className={`content ${narrow ? "content-narrow" : ""}`}>
          {app.analyticsEnabled && <AnalyticsIdentity id={user.id} />}
          <RealtimeRefresh userId={user.id} />
          <ActivationNudge />
          {children}
        </main>
      </div>
      <nav className="mobile-nav" aria-label={app.name}>
        {primary.map((n) => (
          <NavLink key={n.href} href={n.href}>
            <n.icon size={20} />
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
