import { SiteHeader } from "@/src/components/site-header";
import Link from "next/link";
import { MailCheck } from "lucide-react";
export default function Page() {
  return (
    <>
      <SiteHeader />
      <main className="auth-page">
        <div className="auth-card">
          <MailCheck size={36} />
          <h1>Check your inbox.</h1>
          <p>
            Open the verification link in your email, then sign in to your
            workspace. Development emails are stored in the local inbox.
          </p>
          <Link href="/sign-in" className="button">
            Continue to sign in
          </Link>
        </div>
      </main>
    </>
  );
}
