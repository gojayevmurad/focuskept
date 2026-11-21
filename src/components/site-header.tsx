import Link from "next/link";
import { Layers2, ArrowUpRight } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { brand } from "@/src/config/brand";
export function SiteHeader() {
  return (
    <header className="site-header">
      <Link href="/" className="logo">
        <span className="logo-mark">
          <Layers2 size={21} />
        </span>
        {brand.name}
        <span className="logo-label">STARTER</span>
      </Link>
      <nav aria-label="Main navigation">
        <Link href="/#foundation">Foundation</Link>
        <Link href="/pricing">Pricing</Link>
        <Link href="/#quickstart">
          Quick start <ArrowUpRight size={13} />
        </Link>
      </nav>
      <div className="header-actions">
        <ThemeToggle />
        <Link href="/sign-in" className="sign-in-link">
          Sign in
        </Link>
        <Link href="/sign-up" className="button small">
          Get started <ArrowUpRight size={15} />
        </Link>
      </div>
    </header>
  );
}
