import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  CommissionInputEntry,
  calculateCommission,
  commissionCalculationRequestSchema,
} from "@/lib/commission";
import { getClientCommissionCalculation } from "@/lib/commission-data";

export async function POST(req: Request) {
  try {
    const rawBody = await req.json();
    const body = commissionCalculationRequestSchema.parse(rawBody);

    if (body.entries?.length) {
      const result = calculateCommission(body.entries as CommissionInputEntry[]);
      return NextResponse.json(result);
    }

    if (body.advisor_id == null || body.client_id == null) {
      return NextResponse.json(
        { error: "Provide either entries or both advisor_id and client_id." },
        { status: 400 },
      );
    }

    const result = await getClientCommissionCalculation(body.advisor_id, body.client_id);
    if (!result) {
      return NextResponse.json(
        { error: "No commission-bearing policy data found for that client." },
        { status: 404 },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues.map((issue) => issue.message).join(" ") },
        { status: 400 },
      );
    }
    console.error("[api/commission/calculate]", error);
    return NextResponse.json({ error: "Failed to calculate commission" }, { status: 500 });
  }
}
