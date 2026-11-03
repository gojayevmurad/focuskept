import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ClientIntl } from "@/src/components/client-intl";
import { DayBoard } from "@/src/features/tasks/day-board";
import {
  fillTodaySlots,
  listDoneOn,
  listProjects,
  listTasks,
  rollOverIvyLee,
} from "@/src/features/tasks/server";
import { getPreferences, today } from "@/src/features/preferences/server";
import { requireSession } from "@/src/lib/auth/session";
import { addDays } from "@/src/lib/dates";
import {
  metadataLocale,
  resolveLocale,
  type LocaleParams,
} from "@/src/i18n/server";

export async function generateMetadata({
  params,
}: LocaleParams): Promise<Metadata> {
  const locale = await metadataLocale(params);
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t("tasks") };
}

/** The Day board: one page, no tabs; old `?view=` links land here too. */
export default async function Page({ params }: LocaleParams) {
  await resolveLocale(params);
  const { user } = await requireSession("/app/tasks");
  const prefs = await getPreferences(user.id);
  const day = today(prefs);
  await rollOverIvyLee(user.id, day);
  await fillTodaySlots(user.id, day);
  const [open, doneToday, projects] = await Promise.all([
    listTasks(user.id, { includeDone: false }),
    listDoneOn(user.id, prefs.timezone, day),
    listProjects(user.id),
  ]);
  const serialize = <T extends Record<string, unknown>>(row: T) =>
    JSON.parse(JSON.stringify(row));
  return (
    <ClientIntl namespaces={["tasks"]}>
      <DayBoard
        initialTasks={[...open, ...doneToday].map(serialize)}
        projects={projects.map(serialize)}
        today={day}
        tomorrow={addDays(day, 1)}
      />
    </ClientIntl>
  );
}
