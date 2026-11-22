// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/src/lib/db";
import { supportTicket, user, profile } from "@/src/lib/db/schema";

export type TicketFilters = {
  status?: string;
  category?: string;
};

export async function getSupportTickets(filters: TicketFilters = {}) {
  const conditions = [];

  if (filters.status && filters.status !== "all") {
    conditions.push(eq(supportTicket.status, filters.status));
  }
  if (filters.category && filters.category !== "all") {
    conditions.push(eq(supportTicket.category, filters.category));
  }

  const query = db()
    .select({
      id: supportTicket.id,
      userId: supportTicket.userId,
      email: supportTicket.email,
      name: supportTicket.name,
      category: supportTicket.category,
      subject: supportTicket.subject,
      message: supportTicket.message,
      locale: supportTicket.locale,
      pageUrl: supportTicket.pageUrl,
      status: supportTicket.status,
      adminNote: supportTicket.adminNote,
      answeredAt: supportTicket.answeredAt,
      createdAt: supportTicket.createdAt,
      updatedAt: supportTicket.updatedAt,
      username: profile.username,
      displayName: profile.displayName,
    })
    .from(supportTicket)
    .leftJoin(user, eq(supportTicket.userId, user.id))
    .leftJoin(profile, eq(supportTicket.userId, profile.userId))
    .orderBy(desc(supportTicket.createdAt));

  if (conditions.length > 0) {
    return query.where(and(...conditions));
  }
  return query;
}

export async function getSupportTicket(id: string) {
  const [row] = await db()
    .select({
      id: supportTicket.id,
      userId: supportTicket.userId,
      email: supportTicket.email,
      name: supportTicket.name,
      category: supportTicket.category,
      subject: supportTicket.subject,
      message: supportTicket.message,
      locale: supportTicket.locale,
      pageUrl: supportTicket.pageUrl,
      status: supportTicket.status,
      adminNote: supportTicket.adminNote,
      answeredAt: supportTicket.answeredAt,
      createdAt: supportTicket.createdAt,
      updatedAt: supportTicket.updatedAt,
      username: profile.username,
      displayName: profile.displayName,
    })
    .from(supportTicket)
    .leftJoin(user, eq(supportTicket.userId, user.id))
    .leftJoin(profile, eq(supportTicket.userId, profile.userId))
    .where(eq(supportTicket.id, id))
    .limit(1);

  return row || null;
}

export async function getSupportTicketCounts() {
  const result = await db().execute<{
    total: number;
    open: number;
    answered: number;
    closed: number;
    spam: number;
  }>(sql`
    select
      count(*)::int as total,
      count(*) filter (where status = 'open')::int as open,
      count(*) filter (where status = 'answered')::int as answered,
      count(*) filter (where status = 'closed')::int as closed,
      count(*) filter (where status = 'spam')::int as spam
    from support_ticket
  `);

  return (
    result.rows[0] ?? {
      total: 0,
      open: 0,
      answered: 0,
      closed: 0,
      spam: 0,
    }
  );
}

export async function updateSupportTicket(
  id: string,
  updates: {
    status?: "open" | "answered" | "closed" | "spam";
    adminNote?: string;
  },
) {
  const now = new Date();
  const setValues: Record<string, unknown> = {
    updatedAt: now,
  };

  if (updates.status) {
    setValues.status = updates.status;
    if (updates.status === "answered") {
      setValues.answeredAt = now;
    }
  }

  if (updates.adminNote !== undefined) {
    setValues.adminNote = updates.adminNote;
  }

  await db()
    .update(supportTicket)
    .set(setValues)
    .where(eq(supportTicket.id, id));
}
