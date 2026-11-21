import { SiteHeader } from "@/src/components/site-header";
import { BillingButton } from "@/src/components/billing-button";
import Link from "next/link";
import { Check } from "lucide-react";
export default function Page() {
  return (
    <>
      <SiteHeader />
      <main className="pricing-page">
        <span className="overline">ROOM TO GROW</span>
        <h1>A plan for your next step.</h1>
        <p>Start simply. Upgrade when you need more.</p>
        <div className="pricing-grid">
          {[
            {
              title: "Free",
              price: "$0",
              period: "forever",
              text: "A place to start.",
              features: [
                "Your own workspace",
                "Account management",
                "The essentials",
              ],
              plan: undefined,
            },
            {
              title: "Pro",
              price: "$19",
              period: "per month · example price",
              text: "More room for your ideas.",
              features: [
                "Everything in Free",
                "Premium sample feature",
                "Customer billing portal",
              ],
              plan: "monthly" as const,
            },
            {
              title: "Pro Annual",
              price: "$190",
              period: "per year · example price",
              text: "A little more commitment. A little less cost.",
              features: [
                "Everything in Pro",
                "Annual billing",
                "One less thing to think about",
              ],
              plan: "yearly" as const,
            },
          ].map((p, i) => (
            <article
              className={`price-card ${i === 1 ? "featured" : ""}`}
              key={p.title}
            >
              {i === 1 && (
                <span className="recommended">A LITTLE MORE POSSIBILITY</span>
              )}
              <h2>{p.title}</h2>
              <p>{p.text}</p>
              <strong>{p.price}</strong>
              <small>{p.period}</small>
              <ul>
                {p.features.map((f) => (
                  <li key={f}>
                    <Check size={16} />
                    {f}
                  </li>
                ))}
              </ul>
              {p.plan ? (
                <BillingButton plan={p.plan} />
              ) : (
                <Link className="button secondary full" href="/sign-up">
                  Get started free
                </Link>
              )}
            </article>
          ))}
        </div>
        <div className="one-time">
          <div>
            <h3>Prefer a one-time purchase?</h3>
            <p>
              Lifetime Pro is available when configured. Final prices are shown
              in Polar checkout.
            </p>
          </div>
          <BillingButton plan="lifetime" />
        </div>
        <p className="muted">
          Template prices are illustrative. Configure your products before
          accepting payments.
        </p>
      </main>
    </>
  );
}
