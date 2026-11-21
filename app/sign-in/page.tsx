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
          <h1>Welcome back.</h1>
          <p>Your next chapter is right where you left it.</p>
          <Suspense fallback={<p>Loading form…</p>}>
            <AuthForm
              mode="sign-in"
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
