"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/src/i18n/navigation";
import { isTechniqueSlug, registry } from "@/src/features/techniques/registry";
import type {
  PlanningTechnique,
  TimeTechnique,
} from "@/src/features/techniques/slugs";
import { FocusApp } from "./focus-app";
import type { TechniqueLabels } from "./labels";
import { HintLine } from "./hint-line";

/** Visitors focus without an account; signed-in users go to their synced app. */
export function AnonymousFocus({
  labels,
  planningLabels,
}: {
  labels: TechniqueLabels;
  planningLabels: Record<string, string>;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/get-session", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((session) => {
        if (cancelled) return;
        if (session?.user?.emailVerified)
          router.replace(`/app${window.location.search}`);
        else setChecked(true);
      })
      .catch(() => !cancelled && setChecked(true));
    return () => {
      cancelled = true;
    };
  }, [router]);
  if (!checked) return <div className="timer-skeleton skeleton" />;
  const technique = params.get("technique") ?? "";
  const planning = params.get("planning") ?? "";
  return (
    <FocusApp
      signedIn={false}
      labels={labels}
      planningLabels={planningLabels}
      initialTechnique={
        isTechniqueSlug(technique) && registry[technique].group === "time"
          ? (technique as TimeTechnique)
          : undefined
      }
      initialPlanning={
        isTechniqueSlug(planning) && registry[planning].group === "planning"
          ? (planning as PlanningTechnique)
          : undefined
      }
      below={<HintLine />}
    />
  );
}
