"use server";

import { revalidatePath } from "next/cache";
import { generateText, Output } from "ai";
import { z } from "zod";
import { llmModel } from "@/lib/llm";
import { ensureCommunicationDraftsTable } from "@/lib/cockpit-storage";
import {
  AttachmentReference,
  CommunicationDraft,
  getClientCommunicationDrafts,
  getClientDetail,
} from "@/lib/advisor-data";
import {
  DashboardInsights,
  generateAllInsights,
  getStoredDashboardInsights,
  storeDashboardInsights,
} from "@/lib/insights";
import { sql } from "@/lib/db";

interface DashboardInsightsResponse {
  insights: DashboardInsights | null;
  generated_at: string | null;
}

interface GenerateDraftInput {
  advisorId: number;
  clientId: number;
  draftType: "email" | "meeting_request";
}

interface SaveDraftInput {
  draftId: number;
  advisorId: number;
  clientId: number;
  status: CommunicationDraft["status"];
  subject: string;
  body: string;
  attachments: AttachmentReference[];
}

function sanitizeAttachments(attachments: AttachmentReference[]): AttachmentReference[] {
  return attachments
    .map((attachment) => ({
      id: attachment.id || crypto.randomUUID(),
      name: attachment.name.trim(),
      note: attachment.note.trim(),
    }))
    .filter((attachment) => attachment.name.length > 0)
    .slice(0, 8);
}

function mapDraftRow(row: Record<string, unknown>): CommunicationDraft {
  return {
    draft_id: Number(row.draft_id),
    client_id: Number(row.client_id),
    advisor_id: Number(row.advisor_id),
    draft_type: String(row.draft_type) as CommunicationDraft["draft_type"],
    status: String(row.status) as CommunicationDraft["status"],
    subject: String(row.subject),
    body: String(row.body),
    attachment_metadata: Array.isArray(row.attachment_metadata)
      ? (row.attachment_metadata as AttachmentReference[])
      : [],
    created_at: new Date(String(row.created_at)).toISOString(),
    updated_at: new Date(String(row.updated_at)).toISOString(),
  };
}

export async function getDashboardInsights(advisorId: number): Promise<DashboardInsightsResponse> {
  try {
    const stored = await getStoredDashboardInsights(advisorId);
    if (stored.insights) {
      return stored;
    }

    const generated = await generateAllInsights(advisorId);
    await storeDashboardInsights(advisorId, generated);

    return {
      insights: generated,
      generated_at: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[getDashboardInsights]", error);
    return { insights: null, generated_at: null };
  }
}

export async function generateClientCommunicationDraft({
  advisorId,
  clientId,
  draftType,
}: GenerateDraftInput): Promise<CommunicationDraft> {
  await ensureCommunicationDraftsTable();

  const [clientDetail, dashboardInsights] = await Promise.all([
    getClientDetail(advisorId, clientId),
    getDashboardInsights(advisorId),
  ]);

  if (!clientDetail) {
    throw new Error("Client not found.");
  }

  const priorityClient =
    dashboardInsights.insights?.morning_briefing.priority_clients.find(
      (client) => client.client_id === clientId,
    ) ?? null;

  const { output } = await generateText({
    model: llmModel,
    system:
      draftType === "meeting_request"
        ? "You draft concise meeting requests for South African investment advisors. Be professional, specific, and client-friendly. Return plain-text body copy without markdown."
        : "You draft concise relationship emails for South African investment advisors. Be warm, specific, and professional. Return plain-text body copy without markdown.",
    prompt: [
      `Advisor ID: ${advisorId}`,
      `Client: ${clientDetail.client_name}`,
      `Client profile: risk ${clientDetail.risk_profile}, status ${clientDetail.status}, total AUM R${clientDetail.total_aum.toLocaleString()}, weighted 1Y return ${clientDetail.avg_1y_return_pct.toFixed(1)}%, average quartile ${clientDetail.avg_quartile.toFixed(1)}.`,
      `Client alerts: ${JSON.stringify(clientDetail.alerts)}.`,
      `Talking points: ${JSON.stringify(clientDetail.talking_points)}.`,
      `Top policies: ${JSON.stringify(clientDetail.policies.slice(0, 3))}.`,
      `Recent transactions: ${JSON.stringify(clientDetail.recent_transactions.slice(0, 5))}.`,
      `Priority client rationale from dashboard: ${JSON.stringify(priorityClient)}.`,
      draftType === "meeting_request"
        ? "Create a pre-populated meeting request with a clear purpose, suggested agenda, and call to action."
        : "Create a client communication email that references the most relevant insights and proposes a next step.",
      "Also suggest up to three attachment placeholders that would be appropriate for the note.",
    ].join("\n"),
    maxOutputTokens: 800,
    output: Output.object({
      schema: z.object({
        subject: z.string(),
        body: z.string(),
        suggested_attachments: z.array(
          z.object({
            name: z.string(),
            note: z.string(),
          }),
        ),
      }),
    }),
  });

  const attachments: AttachmentReference[] = output.suggested_attachments
    .slice(0, 3)
    .map((attachment) => ({
      id: crypto.randomUUID(),
      name: attachment.name.trim(),
      note: attachment.note.trim(),
    }))
    .filter((attachment) => attachment.name.length > 0);

  const result = await sql`
    INSERT INTO communication_drafts (
      client_id,
      advisor_id,
      draft_type,
      status,
      subject,
      body,
      attachment_metadata,
      created_at,
      updated_at
    )
    VALUES (
      ${clientId},
      ${advisorId},
      ${draftType},
      'draft',
      ${output.subject.trim()},
      ${output.body.trim()},
      ${JSON.stringify(attachments)},
      NOW(),
      NOW()
    )
    RETURNING
      draft_id,
      client_id,
      advisor_id,
      draft_type,
      status,
      subject,
      body,
      attachment_metadata,
      created_at,
      updated_at;
  `;

  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");

  return mapDraftRow(result.rows[0] as Record<string, unknown>);
}

export async function saveCommunicationDraft({
  draftId,
  advisorId,
  clientId,
  status,
  subject,
  body,
  attachments,
}: SaveDraftInput): Promise<CommunicationDraft> {
  await ensureCommunicationDraftsTable();

  const cleanedAttachments = sanitizeAttachments(attachments);

  const result = await sql`
    UPDATE communication_drafts
    SET
      status = ${status},
      subject = ${subject.trim()},
      body = ${body.trim()},
      attachment_metadata = ${JSON.stringify(cleanedAttachments)},
      updated_at = NOW()
    WHERE draft_id = ${draftId}
      AND advisor_id = ${advisorId}
      AND client_id = ${clientId}
    RETURNING
      draft_id,
      client_id,
      advisor_id,
      draft_type,
      status,
      subject,
      body,
      attachment_metadata,
      created_at,
      updated_at;
  `;

  const row = result.rows[0];
  if (!row) {
    throw new Error("Draft not found.");
  }

  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");

  return mapDraftRow(row as Record<string, unknown>);
}

export async function listClientCommunicationDrafts(
  advisorId: number,
  clientId: number,
): Promise<CommunicationDraft[]> {
  return getClientCommunicationDrafts(advisorId, clientId);
}
