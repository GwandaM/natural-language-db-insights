import { NextRequest, NextResponse } from "next/server";
import { calculateProductEacs, EacAssumptions } from "@/lib/product-intelligence";

function parseNumber(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const ids = (searchParams.get("product_ids") ?? "")
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value));

    if (ids.length === 0) {
      return NextResponse.json({ error: "At least one product id is required" }, { status: 400 });
    }

    const assumptions: EacAssumptions = {
      investmentAmount: parseNumber(searchParams.get("investment_amount")),
      ongoingAdvicePct: parseNumber(searchParams.get("ongoing_advice_pct")),
      initialAdvicePct: parseNumber(searchParams.get("initial_advice_pct")),
    };

    const products = await calculateProductEacs(ids, assumptions);
    return NextResponse.json({ products, assumptions });
  } catch (error) {
    console.error("[api/eac]", error);
    return NextResponse.json({ error: "Failed to calculate EAC" }, { status: 500 });
  }
}
