import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { pick, type Messages } from "@/src/i18n/messages";

/**
 * Sends only the namespaces a client island needs. A nested provider replaces
 * its parent's messages, so `common` is always included.
 */
export async function ClientIntl({
  namespaces,
  children,
}: {
  namespaces: readonly (keyof Messages)[];
  children: React.ReactNode;
}) {
  const messages = (await getMessages()) as Messages;
  return (
    <NextIntlClientProvider
      messages={pick(messages, ["common", ...namespaces])}
    >
      {children}
    </NextIntlClientProvider>
  );
}
