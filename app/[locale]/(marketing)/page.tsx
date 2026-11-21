import { brand } from "@/src/config/brand";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Layers2,
  ShieldCheck,
  CreditCard,
  Activity,
  Terminal,
  GitBranch,
  Braces,
  CircleCheck,
  LockKeyhole,
  Box,
  Zap,
} from "lucide-react";
import { SiteHeader } from "@/src/components/site-header";
const modules = [
  {
    icon: ShieldCheck,
    title: "Authentication, handled.",
    text: "Secure sessions, verified emails, and account management. A proper welcome for every user.",
    tag: "BETTER AUTH",
    className: "purple",
  },
  {
    icon: CreditCard,
    title: "From free to your first paid.",
    text: "Subscriptions, one-time purchases, and a customer portal. Billing with the right guardrails.",
    tag: "POLAR",
    className: "green",
  },
  {
    icon: Activity,
    title: "Know what’s working.",
    text: "Consent-aware analytics, structured logs, and error monitoring. Stay close to your product.",
    tag: "POSTHOG + SENTRY",
    className: "orange",
  },
];
export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero">
          <div className="hero-orbit" />
          <div className="eyebrow">
            <span className="status-dot" /> A SMALLER DISTANCE BETWEEN IDEA AND
            LAUNCH <ArrowUpRight size={13} />
          </div>
          <h1>
            Your idea deserves <br />a <span>head start.</span>
            <svg viewBox="0 0 330 20" aria-hidden="true">
              <path d="M5 13 Q140 -4 323 10" />
            </svg>
          </h1>
          <p className="hero-description">
            The thoughtful SaaS foundation that takes care of the essentials.
            <br className="desktop-break" /> Less setup. More time building
            something that matters.
          </p>
          <div className="hero-actions">
            <Link className="button" href="/sign-up">
              Start building <ArrowRight size={17} />
            </Link>
            <Link className="button secondary" href="#foundation">
              <Braces size={17} /> Explore the foundation
            </Link>
          </div>
          <div className="hero-footnote">
            <span>
              <Check size={14} /> Your code. Your infrastructure.
            </span>
            <i />
            <span>
              <Check size={14} /> Built to make it yours.
            </span>
          </div>
          <div className="workspace-preview">
            <div className="preview-titlebar">
              <div className="traffic">
                <i />
                <i />
                <i />
              </div>
              <span>
                <LockKeyhole size={11} /> your-next-idea.local
              </span>
              <span className="preview-label">A LOOK INSIDE</span>
            </div>
            <div className="preview-body">
              <aside className="preview-sidebar">
                <div className="logo mini">
                  <span className="logo-mark">
                    <Layers2 size={16} />
                  </span>
                  Your workspace
                </div>
                <span className="sidebar-caption">WORKSPACE</span>
                <div className="preview-nav selected">
                  <Box size={15} /> Overview
                </div>
                <div className="preview-nav">
                  <CreditCard size={15} /> Billing
                </div>
                <div className="preview-nav">
                  <ShieldCheck size={15} /> Account
                </div>
                <div className="sidebar-bottom">
                  <span className="avatar">Y</span>
                  <div>
                    Your next big thing<small>Ready when you are</small>
                  </div>
                </div>
              </aside>
              <div className="preview-content">
                <div className="preview-breadcrumb">
                  Workspace <span>/</span> Overview{" "}
                  <span className="preview-sandbox">Template preview</span>
                </div>
                <div className="preview-greeting">
                  <div>
                    <h2>A fresh start. A solid foundation.</h2>
                    <p>Your infrastructure is in place. Make it your own.</p>
                  </div>
                  <span className="illustrated-icon">
                    <Zap size={25} />
                  </span>
                </div>
                <div className="preview-stats">
                  <div>
                    <span className="stat-icon lavender">
                      <ShieldCheck size={18} />
                    </span>
                    <span>
                      Authentication<strong>Secure by default</strong>
                    </span>
                    <CircleCheck size={15} />
                  </div>
                  <div>
                    <span className="stat-icon mint">
                      <CreditCard size={18} />
                    </span>
                    <span>
                      Billing<strong>Built for growth</strong>
                    </span>
                    <CircleCheck size={15} />
                  </div>
                  <div>
                    <span className="stat-icon peach">
                      <Activity size={18} />
                    </span>
                    <span>
                      Observability<strong>Stay in the loop</strong>
                    </span>
                    <CircleCheck size={15} />
                  </div>
                </div>
                <div className="preview-lower">
                  <div className="launch-checklist">
                    <div className="card-heading">
                      Make yourself at home <span>YOUR FIRST STEPS</span>
                    </div>
                    {[
                      "Give your product a name",
                      "Connect your services",
                      "Build your first feature",
                    ].map((s, i) => (
                      <div className="checklist-row" key={s}>
                        <span className="step-number">0{i + 1}</span>
                        <div>
                          {s}
                          <small>
                            {
                              [
                                "A little personality goes a long way.",
                                "Bring your own keys. Keep full control.",
                                "This is where your idea takes shape.",
                              ][i]
                            }
                          </small>
                        </div>
                        <ArrowUpRight size={15} />
                      </div>
                    ))}
                  </div>
                  <div className="build-note">
                    <span className="note-icon">
                      <Terminal size={20} />
                    </span>
                    <h3>
                      Less boilerplate. <br />
                      More possibility.
                    </h3>
                    <p>
                      A clean starting point. <br />
                      An open-ended next chapter.
                    </p>
                    <span>
                      BUILT FOR WHAT’S NEXT <ArrowUpRight size={13} />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="stack-strip" aria-label="Technology stack">
          <span>
            A FAMILIAR STACK. <br />
            <strong>A BETTER STARTING POINT.</strong>
          </span>
          <div>
            <span className="next-symbol">N</span> Next.js
          </div>
          <div>
            <span className="ts-symbol">TS</span> TypeScript
          </div>
          <div>
            <span className="db-symbol">◉</span> PostgreSQL
          </div>
          <div>
            <span className="drizzle-symbol">▰</span> Drizzle
          </div>
          <div>
            <span className="docker-symbol">▦</span> Docker
          </div>
        </section>
        <section className="foundation section" id="foundation">
          <div className="section-heading">
            <div>
              <span className="overline">
                THE BORING PARTS, BEAUTIFULLY SORTED
              </span>
              <h2>Start a step ahead.</h2>
            </div>
            <p>
              The essentials your product needs. <br />
              Without the things it doesn’t.
            </p>
          </div>
          <div className="module-grid">
            {modules.map((m) => (
              <article className="module-card" key={m.title}>
                <span className={`module-icon ${m.className}`}>
                  <m.icon size={22} />
                </span>
                <h3>{m.title}</h3>
                <p>{m.text}</p>
                <span className="module-tag">
                  {m.tag}
                  <ArrowUpRight size={14} />
                </span>
              </article>
            ))}
          </div>
        </section>
        <section className="quickstart section" id="quickstart">
          <div>
            <span className="overline">FROM HERE TO YOUR NEXT THING</span>
            <h2>
              A clean slate. <br />
              Not a blank page.
            </h2>
            <p>
              Make a copy. Connect your services. Bring your idea to life.{" "}
              <br />
              Simple enough to understand. Flexible enough to grow.
            </p>
            <Link href="/sign-up" className="text-link">
              Make it yours <ArrowRight size={17} />
            </Link>
          </div>
          <div className="terminal">
            <div>
              <span className="terminal-dots">● ● ●</span>
              <span>your next chapter</span>
              <Terminal size={14} />
            </div>
            <pre>
              <span># Your idea, with a head start</span>
              {"\n"}
              <b>pnpm</b> install{"\n"}
              <b>cp</b> .env.example .env.local{"\n"}
              <b>pnpm</b> db:migrate{"\n"}
              <b>pnpm</b> dev{"\n\n"}
              <em>➜</em> Local: http://localhost:3000
              <small>Ready to build something that matters.</small>
            </pre>
          </div>
        </section>
        <section className="closing">
          <span className="logo-mark">
            <Layers2 size={21} />
          </span>
          <h2>The next move is yours.</h2>
          <p>Start with a foundation. Build something of your own.</p>
          <Link href="/sign-up" className="button">
            Let’s get started <ArrowRight size={17} />
          </Link>
        </section>
      </main>
      <footer>
        <Link className="logo" href="/">
          <Layers2 size={20} />
          {brand.name}
        </Link>
        <span>A foundation for what comes next.</span>
        <div>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <a
            href="/#quickstart"
            target="_blank"
            rel="noreferrer"
            aria-label="Quick start"
          >
            <GitBranch size={17} />
          </a>
        </div>
        <span>
          © {new Date().getFullYear()} {brand.name}
        </span>
      </footer>
    </>
  );
}
