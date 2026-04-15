import { sql } from "@/lib/db";
import {
  CommissionCalculationResult,
  CommissionInputEntry,
  calculateCommission,
} from "@/lib/commission";

interface PolicyCommissionInput extends CommissionInputEntry {
  client_id: number;
  client_name: string;
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toInt(value: unknown, fallback = 0): number {
  return Math.trunc(toNumber(value, fallback));
}

function mapPolicyRow(row: Record<string, unknown>): PolicyCommissionInput {
  return {
    client_id: toInt(row.client_id),
    client_name: String(row.client_name),
    entry_id: `policy:${toInt(row.policy_id)}`,
    source_type: "policy",
    source_label: String(row.policy_number),
    product_type: String(row.policy_type),
    status: row.status ? String(row.status) : null,
    current_value: toNumber(row.current_value),
  };
}

async function getPolicyCommissionInputs(
  advisorId: number,
  clientId?: number,
): Promise<PolicyCommissionInput[]> {
  const result = clientId != null
    ? await sql`
        SELECT
          c.client_id,
          c.first_name || ' ' || c.last_name AS client_name,
          p.policy_id,
          p.policy_number,
          p.policy_type,
          p.status,
          COALESCE(p.current_value, 0)::NUMERIC AS current_value
        FROM policy p
        JOIN client c ON c.client_id = p.client_id
        WHERE c.advisor_id = ${advisorId}
          AND c.client_id = ${clientId}
          AND COALESCE(p.current_value, 0) > 0
        ORDER BY p.current_value DESC, p.policy_id ASC;
      `
    : await sql`
        SELECT
          c.client_id,
          c.first_name || ' ' || c.last_name AS client_name,
          p.policy_id,
          p.policy_number,
          p.policy_type,
          p.status,
          COALESCE(p.current_value, 0)::NUMERIC AS current_value
        FROM policy p
        JOIN client c ON c.client_id = p.client_id
        WHERE c.advisor_id = ${advisorId}
          AND COALESCE(p.current_value, 0) > 0
        ORDER BY c.client_id ASC, p.current_value DESC, p.policy_id ASC;
      `;

  return result.rows.map((row) => mapPolicyRow(row as Record<string, unknown>));
}

export async function getClientCommissionCalculation(
  advisorId: number,
  clientId: number,
): Promise<CommissionCalculationResult | null> {
  const inputs = await getPolicyCommissionInputs(advisorId, clientId);
  if (inputs.length === 0) return null;
  return calculateCommission(inputs);
}

export async function getAdvisorClientCommissionCalculations(
  advisorId: number,
): Promise<Map<number, CommissionCalculationResult>> {
  const inputs = await getPolicyCommissionInputs(advisorId);
  const grouped = new Map<number, CommissionInputEntry[]>();

  for (const input of inputs) {
    const bucket = grouped.get(input.client_id) ?? [];
    bucket.push({
      entry_id: input.entry_id,
      source_type: input.source_type,
      source_label: input.source_label,
      product_type: input.product_type,
      status: input.status,
      current_value: input.current_value,
    });
    grouped.set(input.client_id, bucket);
  }

  return new Map(
    Array.from(grouped.entries()).map(([clientId, entries]) => [
      clientId,
      calculateCommission(entries),
    ]),
  );
}
