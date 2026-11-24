// SPDX-License-Identifier: AGPL-3.0-only
import "server-only";
import { sendAdminAlert } from "@/src/lib/admin/alerts";

export async function notifyAdminsOfTicket(ticket: {
  id: string;
  name: string;
  email: string;
  category: string;
  subject: string;
  message: string;
  pageUrl?: string;
}) {
  await sendAdminAlert("support_ticket_created", ticket.id, {
    name: ticket.name,
    detail: ticket.subject,
    path: `/admin/support/${ticket.id}`,
  });
}
