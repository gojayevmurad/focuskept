import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/src/i18n/navigation";
import { AuthForm } from "./auth-form";

export async function AuthPage({
  mode,
  title,
  lead,
  context,
}: {
  mode: "sign-in" | "sign-up" | "forgot-password" | "reset-password";
  title: string;
  lead: string;
  context?: React.ReactNode;
}) {
  const t = await getTranslations("auth");
  return (
    <>
      <div className="card stack" style={{ gap: 20 }}>
        <div>
          <h1 className="text-2xl">{title}</h1>
          <p className="muted mt-2">{lead}</p>
          {context}
        </div>
        <Suspense
          fallback={<div className="skeleton" style={{ height: 220 }} />}
        >
          <AuthForm
            mode={mode}
            google={Boolean(process.env.GOOGLE_CLIENT_ID)}
          />
        </Suspense>
      </div>
      <p className="tiny muted text-center mt-5">
        {t.rich("legal", {
          terms: (chunks) => (
            <Link className="link" href="/terms">
              {chunks}
            </Link>
          ),
          privacy: (chunks) => (
            <Link className="link" href="/privacy">
              {chunks}
            </Link>
          ),
        })}
      </p>
    </>
  );
}
