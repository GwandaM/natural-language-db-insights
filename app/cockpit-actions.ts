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

// ---------------------------------------------------------------------------
// AI Client Search — reuses the NL→SQL pattern from app/actions.ts
// ---------------------------------------------------------------------------

export interface ClientSearchResult {
  client_id: number;
  client_name: string;
  risk_profile: string;
  status: string;
  total_aum: number;
  policy_count: number;
  avg_1y_return_pct: number;
}

export async function searchClientsAI(
  advisorId: number,
  query: string,
): Promise<{ results: ClientSearchResult[]; sqlQuery: string }> {
  const { output } = await generateText({
    model: llmModel,
    system: `You are a SQL expert for an Investment Advisor CRM. Generate a SELECT query to find clients matching the user's description.

ALWAYS return these columns (using these exact aliases):
  c.client_id,
  c.first_name || ' ' || c.last_name AS client_name,
  c.risk_profile,
  c.status,
  COALESCE(SUM(p.current_value), 0) AS total_aum,
  COUNT(DISTINCT p.policy_id) AS policy_count,
  COALESCE(AVG(fp.return_annualized * 100), 0) AS avg_1y_return_pct

SCHEMA (relevant tables):
  client(client_id PK, advisor_id FK, first_name, last_name, email, phone, date_of_birth, risk_profile, client_since, status, id_number, annual_income, target_retirement_age, annual_income_need)
  policy(policy_id PK, client_id FK, product_id FK, policy_number, policy_type, phase, inception_date, status, initial_investment, current_value, units_held, monthly_contribution, monthly_income, drawdown_rate_pct)
  fund(fund_id PK, fund_name, sector_id FK, management_fee, net_expense_ratio, fund_size, morningstar_rating_overall)
  fund_performance_fact(fund_perf_id PK, fund_id FK, period_id FK, return_annualized, return_cumulative)
  period_definition(period_id PK, period_code, period_type)
  sector(sector_id PK, sector_name)
  transaction(transaction_id PK, policy_id FK, transaction_type, transaction_date, amount)

KEY RULES:
- ALWAYS filter by c.advisor_id = $1 (parameterised — the value will be provided).
- JOIN policy and fund_performance_fact (via period_code = '1Y') for return data.
- GROUP BY c.client_id, c.first_name, c.last_name, c.risk_profile, c.status.
- ORDER BY total_aum DESC.
- LIMIT 20.
- risk_profile values: 'conservative', 'moderate', 'aggressive'.
- status values: 'active', 'dormant', 'inactive'.
- Returns are decimals (0.12 = 12%).
- Use ILIKE for string matching.
- Only SELECT queries.`,
    prompt: `Find clients matching: ${query}`,
    output: Output.object({
      schema: z.object({
        query: z.string(),
      }),
    }),
  });

  const sqlQuery = output.query;

  // Safety check
  const lower = sqlQuery.trim().toLowerCase();
  if (!lower.startsWith("select") || /\b(drop|delete|insert|update|alter|truncate|create)\b/.test(lower)) {
    throw new Error("Only SELECT queries are allowed");
  }

  const data = await sql.query(sqlQuery, [advisorId]);

  const results: ClientSearchResult[] = data.rows.map((row: Record<string, unknown>) => ({
    client_id: Number(row.client_id),
    client_name: String(row.client_name ?? ""),
    risk_profile: String(row.risk_profile ?? ""),
    status: String(row.status ?? ""),
    total_aum: Number(row.total_aum ?? 0),
    policy_count: Number(row.policy_count ?? 0),
    avg_1y_return_pct: Number(row.avg_1y_return_pct ?? 0),
  }));

  return { results, sqlQuery };
}
