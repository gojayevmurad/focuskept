// SPDX-License-Identifier: AGPL-3.0-only
import { notFound } from "next/navigation";
import { requireAdmin, requireAppUser } from "@/src/lib/app-user";
import { JoinMatch } from "./join";

export default async function Page({ params }: { params: Promise<{ requestId: string }> }) {
  const current = await requireAppUser();
  if (!current.isAdmin) notFound();
  await requireAdmin();
  const { requestId } = await params;
  return <JoinMatch requestId={requestId} />;
}
