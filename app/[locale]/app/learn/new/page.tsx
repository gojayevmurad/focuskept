import { redirect } from "@/src/i18n/navigation";
import { resolveLocale, type LocaleParams } from "@/src/i18n/server";

/** Learning starts on the timer home now; keep old links working. */
export default async function Page({
  params,
  searchParams,
}: LocaleParams & { searchParams: Promise<{ topic?: string }> }) {
  const locale = await resolveLocale(params);
  const topic = (await searchParams).topic?.slice(0, 200);
  redirect({
    href: topic ? { pathname: "/app", query: { topic } } : "/app",
    locale,
  });
}
