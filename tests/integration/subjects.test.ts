import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  createTestUsers,
  deleteTestUsers,
  setupTestDatabase,
  testDatabaseUrl,
} from "../support/db";
import { db } from "@/src/lib/db";
import { learningDraft, learningItem, question } from "@/src/lib/db/schema";
import {
  createSubject,
  deleteSubject,
  listSubjects,
  SubjectNameTaken,
  updateSubject,
} from "@/src/features/subjects/server";
import { createSession } from "@/src/features/sessions/server";
import { sessionCreateSchema } from "@/src/features/sessions/schema";
import { createProject, createTask } from "@/src/features/tasks/server";
import { cardBoxes, listCards, updateCard } from "@/src/features/cards/server";
import { countDue, dueCards } from "@/src/features/reviews/server";
import { exportAll } from "@/src/features/export/server";
import { focusByGroup } from "@/src/features/stats/server";

vi.mock("@/src/features/analytics/server", () => ({
  captureProductEvent: vi.fn(),
  recordTaskCompleted: vi.fn(),
}));

const A = "sub-user-a";
const B = "sub-user-b";
const color = "#5FC3A8";

beforeAll(async () => {
  if (!(await setupTestDatabase())) return;
  await createTestUsers(A, B);
});
afterAll(async () => {
  if (testDatabaseUrl) await deleteTestUsers(A, B);
  vi.unstubAllEnvs();
});

function session(overrides: Record<string, unknown> = {}) {
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 60_000);
  return sessionCreateSchema.parse({
    clientId: crypto.randomUUID(),
    mode: "work",
    timeTechnique: "pomodoro",
    startedAt: start.toISOString(),
    endedAt: end.toISOString(),
    focusedSeconds: 1500,
    breakSeconds: 300,
    cyclesCompleted: 1,
    interruptions: 0,
    overrunSeconds: 0,
    ...overrides,
  });
}

async function card(userId: string, subjectId: string | null, dueOn: string) {
  const id = crypto.randomUUID();
  await db().insert(learningItem).values({
    id,
    userId,
    subjectId,
    topic: "Topic",
    learningMethod: "feynman",
    explanation: "Some explanation.",
    intervalDays: 5,
    dueOn,
  });
  // Review only shows cards that have questions.
  await db().insert(question).values({
    id: crypto.randomUUID(),
    learningItemId: id,
    type: "true_false",
    prompt: "Cells need energy.",
    answer: "true",
    position: 0,
  });
  return id;
}

describe.skipIf(!testDatabaseUrl)("subjects", () => {
  it("keeps names unique per user, ignoring case", async () => {
    const first = await createSubject(A, { name: "Biology", color });
    const again = await createSubject(A, { name: "biology", color });
    const other = await createSubject(B, { name: "Biology", color });
    expect(again.id).toBe(first.id);
    expect(other.id).not.toBe(first.id);
    expect((await listSubjects(A)).map((s) => s.name)).toContain("Biology");

    const chem = await createSubject(A, { name: "Chemistry", color });
    await expect(
      updateSubject(A, chem.id, { name: "BIOLOGY" }),
    ).rejects.toBeInstanceOf(SubjectNameTaken);
    expect(await updateSubject(B, chem.id, { name: "Mine" })).toBeUndefined();
    const archived = await updateSubject(A, chem.id, { archived: true });
    expect(archived?.archivedAt).toBeInstanceOf(Date);
  });

  it("links a learning session and its draft to an owned subject only", async () => {
    const math = await createSubject(A, { name: "Math", color });
    const foreign = await createSubject(B, { name: "History", color });
    const learning = {
      mode: "learning",
      learningMethod: "feynman",
      learning: { topic: "Derivatives", notes: {} },
    };
    const owned = await createSession(
      A,
      session({ ...learning, subjectId: math.id }),
    );
    expect(owned.session.subjectId).toBe(math.id);
    const [draft] = await db()
      .select()
      .from(learningDraft)
      .where(eq(learningDraft.sessionId, owned.session.id));
    expect(draft.subjectId).toBe(math.id);

    const stolen = await createSession(
      A,
      session({ ...learning, subjectId: foreign.id }),
    );
    expect(stolen.session.subjectId).toBeNull();

    const work = await createSession(A, session({ subjectId: math.id }));
    expect(work.session.subjectId).toBeNull();
  });

  it("takes a work session's project from its task unless one is given", async () => {
    const uni = await createProject(A, { name: "Uni", color });
    const job = await createProject(A, { name: "Job", color });
    const foreign = await createProject(B, { name: "Theirs", color });
    const essay = await createTask(A, { title: "Essay", projectId: uni.id });

    const fromTask = await createSession(A, session({ taskId: essay.id }));
    expect(fromTask.session.projectId).toBe(uni.id);
    const chosen = await createSession(
      A,
      session({ taskId: essay.id, projectId: job.id }),
    );
    expect(chosen.session.projectId).toBe(job.id);
    const stolen = await createSession(
      A,
      session({ taskId: essay.id, projectId: foreign.id }),
    );
    expect(stolen.session.projectId).toBe(uni.id);
  });

  it("filters due cards, counts and boxes by subject", async () => {
    const bio = await createSubject(A, { name: "Bio filter", color });
    const art = await createSubject(A, { name: "Art filter", color });
    const inBio = await card(A, bio.id, "2026-11-01");
    const inArt = await card(A, art.id, "2026-11-01");
    const none = await card(A, null, "2026-11-01");
    const later = await card(A, bio.id, "2026-12-30");

    const bioDue = await dueCards(A, "2026-11-08", 50, bio.id);
    expect(bioDue.map((c) => c.id)).toEqual([inBio]);
    expect(await countDue(A, "2026-11-08", bio.id)).toBe(1);
    const noneDue = (await dueCards(A, "2026-11-08", 50, "none")).map(
      (c) => c.id,
    );
    expect(noneDue).toContain(none);
    expect(noneDue).not.toContain(inArt);

    const boxes = await cardBoxes(A, "2026-11-08", [5, 10, 30], bio.id);
    expect(boxes.reduce((a, n) => a + n, 0)).toBe(2);
    const listed = await listCards(A, { subject: bio.id });
    expect(listed.cards.map((c) => c.id).sort()).toEqual([inBio, later].sort());
  });

  it("moves a card between subjects and drops a deleted subject", async () => {
    const geo = await createSubject(A, { name: "Geo", color });
    const foreign = await createSubject(B, { name: "Geo B", color });
    const id = await card(A, null, "2026-11-01");

    expect((await updateCard(A, id, { subjectId: geo.id }))?.subjectId).toBe(
      geo.id,
    );
    expect(await updateCard(A, id, { subjectId: foreign.id })).toBeUndefined();
    expect(await deleteSubject(B, geo.id)).toBe(false);
    expect(await deleteSubject(A, geo.id)).toBe(true);
    const [row] = await db()
      .select()
      .from(learningItem)
      .where(eq(learningItem.id, id));
    expect(row.subjectId).toBeNull();
  });

  it("sums focused time per project and per subject", async () => {
    const proj = await createProject(B, { name: "Stats project", color });
    const subj = await createSubject(B, { name: "Stats subject", color });
    await createSession(B, session({ projectId: proj.id }));
    await createSession(B, session({ projectId: proj.id }));
    await createSession(
      B,
      session({
        mode: "learning",
        learningMethod: "feynman",
        learning: { topic: "Atoms", notes: {} },
        subjectId: subj.id,
      }),
    );
    const today = new Date().toISOString().slice(0, 10);
    const rows = await focusByGroup(B, {
      timezone: "UTC",
      from: "2000-01-01",
      to: today,
    });
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "project",
          name: "Stats project",
          seconds: 3000,
        }),
        expect.objectContaining({
          kind: "subject",
          name: "Stats subject",
          seconds: 1500,
        }),
      ]),
    );
  });

  it("includes subjects in the data export", async () => {
    const data = await exportAll(A);
    expect(data.subjects.map((s) => s.name)).toContain("Biology");
    expect(data.subjects.every((s) => s.userId === A)).toBe(true);
  });
});
