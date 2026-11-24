// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";
import { notFound } from "next/navigation";
import { getAppConfig } from "@/src/config/app";

export function requireChallenges() {
  if (!getAppConfig().challengesEnabled) notFound();
}
