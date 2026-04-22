"use server";

import { generateText, Output } from "ai";
import { z } from "zod";
import { llmModel } from "@/lib/llm";
import { getAdvisorClients } from "@/lib/advisor-data";

export interface ClientSearchMatch {
  client_id: number;
  client_name: string;
  reason: string;
}

export interface ClientSearchResult {
  interpreted_query: string;
  summary: string;
  matches: ClientSearchMatch[];
}

const searchResultSchema = z.object({
  interpreted_query: z
    .string()
    .describe("A short restatement of how the query was understood."),
  summary: z
    .string()
    .describe("One sentence describing the overall match set."),
  matches: z
    .array(
      z.object({
        client_id: z.number(),
        reason: z
          .string()
          .describe("A brief (under 20 words) reason referencing specific numbers or facts."),
      }),
    )
    .describe("Clients that match the query, ranked by how strongly they satisfy it."),
});

export async function aiSearchClients(
  advisorId: number,
  query: string,
): Promise<ClientSearchResult> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return { interpreted_query: "", summary: "", matches: [] };
  }

  const clients = await getAdvisorClients(advisorId);

  if (clients.length === 0) {
    return {
      interpreted_query: trimmedQuery,
      summary: "No clients are assigned to this advisor.",
      matches: [],
    };
  }

  const compact = clients.map((c) => ({
    client_id: c.client_id,
    client_name: c.client_name,
    risk_profile: c.risk_profile,
    status: c.status,
    client_since: c.client_since,
    total_aum: Math.round(c.total_aum),
    policy_count: c.policy_count,
    avg_1y_return_pct: c.avg_1y_return_pct,
    avg_quartile: c.avg_quartile,
    last_activity: c.last_activity,
    has_risk_mismatch: c.has_risk_mismatch,
    potential_annual_commission: Math.round(c.potential_annual_commission),
    is_post_retirement: c.is_post_retirement,
    la_drawdown_rate_pct: c.la_drawdown_rate_pct,
    years_to_retirement: c.years_to_retirement,
  }));

  const { output } = await generateText({
    model: llmModel,
    system: [
      "You are an AI search assistant for a South African investment advisor's client book.",
      "Given a list of clients and a natural-language query, return only the clients that match.",
      "Use every available field to interpret intent: status (active/dormant/inactive), AUM, 1Y return, average quartile, risk profile, risk-mismatch flag, retirement phase, living-annuity drawdown, years to retirement, last-activity date, and commission potential.",
      "Rank matches by how strongly they satisfy the query. Return an empty matches array if nothing plausibly matches.",
      "Keep reasons short (under 20 words) and specific, referencing actual numbers where relevant.",
      "Do not invent clients — only return client_id values that exist in the provided list.",
    ].join(" "),
    prompt: [
      `Advisor ID: ${advisorId}`,
      `Natural-language query: ${trimmedQuery}`,
      "Clients (JSON array):",
      JSON.stringify(compact),
    ].join("\n"),
    maxOutputTokens: 1500,
    output: Output.object({
      schema: searchResultSchema,
    }),
  });

  const clientById = new Map(clients.map((c) => [c.client_id, c]));
  const seen = new Set<number>();
  const matches: ClientSearchMatch[] = [];
  for (const match of output.matches) {
    const client = clientById.get(match.client_id);
    if (!client || seen.has(match.client_id)) continue;
    seen.add(match.client_id);
    matches.push({
      client_id: client.client_id,
      client_name: client.client_name,
      reason: match.reason.trim(),
    });
  }

  return {
    interpreted_query: output.interpreted_query.trim(),
    summary: output.summary.trim(),
    matches,
  };
}
