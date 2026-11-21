import { brand } from "@/src/config/brand";
import Link from "next/link";
import {
  Layers2,
  LayoutDashboard,
  CreditCard,
  Settings2,
  LockKeyhole,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { SignOut } from "./auth-form";
import { requireSession } from "@/src/lib/auth/session";
import { AnalyticsIdentity } from "./consent";
export async function AppShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  const session = await requireSession();
  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <Link href="/" className="logo">
          <span className="logo-mark">
            <Layers2 size={20} />
          </span>
          {brand.name}
        </Link>
        <span className="sidebar-caption">YOUR WORKSPACE</span>
        <nav>
          {[
            { href: "/dashboard", title: "Overview", icon: LayoutDashboard },
            { href: "/feature", title: "Sample feature", icon: Sparkles },
            { href: "/billing", title: "Billing", icon: CreditCard },
            { href: "/settings", title: "Account", icon: Settings2 },
            {
              href: "/settings/security",
              title: "Security",
              icon: LockKeyhole,
            },
          ].map((n) => (
            <Link key={n.href} href={n.href}>
              <n.icon size={18} />
              {n.title}
            </Link>
          ))}
        </nav>
        <div className="app-sidebar-bottom">
          <Link href="/pricing">
            Explore plans <ArrowUpRight size={15} />
          </Link>
          <small>YOUR NEXT CHAPTER STARTS HERE</small>
        </div>
      </aside>
      <div className="app-main">
        <header>
          <span>
            Workspace <span className="muted">/ {title}</span>
          </span>
          <div>
            <ThemeToggle />
            <SignOut />
          </div>
        </header>
        <main className="app-content">
          <AnalyticsIdentity id={session.user.id} />
          {children}
        </main>
      </div>
    </div>
  );
}
