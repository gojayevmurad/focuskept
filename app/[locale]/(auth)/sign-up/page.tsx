import { connection } from "next/server";
import { Suspense } from "react";
import { SiteHeader } from "@/src/components/site-header";
import { AuthForm } from "@/src/components/auth-form";
export default async function Page() {
  await connection();
  return (
    <>
      <SiteHeader />
      <main className="auth-page">
        <div className="auth-card">
          <span className="overline">YOUR NEXT CHAPTER</span>
          <h1>Make room for your idea.</h1>
          <p>A fresh workspace. A world of possibility.</p>
          <Suspense fallback={<p>Loading form…</p>}>
            <AuthForm
              mode="sign-up"
              google={Boolean(process.env.GOOGLE_CLIENT_ID)}
            />
          </Suspense>
        </div>
        <p className="auth-legal">
          By continuing, you agree to our <a href="/terms">Terms</a> and{" "}
          <a href="/privacy">Privacy Policy</a>.
        </p>
      </main>
    </>
  );
}
