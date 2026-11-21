// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from ".";
export async function getSession() {
  const requestHeaders = await headers();
  if (!process.env.DATABASE_URL) return null;
  return auth().api.getSession({ headers: requestHeaders });
}
export async function requireSession() {
  const session = await getSession();
  if (!session || !session.user.emailVerified) redirect("/sign-in");
  return session;
}
