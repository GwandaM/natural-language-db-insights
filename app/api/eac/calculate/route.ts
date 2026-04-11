import { NextResponse } from "next/server";
import { calculateProductEacs, EacAssumptions } from "@/lib/product-intelligence";

interface RequestBody {
  product_ids?: number[];
  assumptions?: EacAssumptions;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;
    const productIds = (body.product_ids ?? []).filter((value) => Number.isFinite(value));

    if (productIds.length === 0) {
      return NextResponse.json({ error: "product_ids must contain at least one numeric id" }, { status: 400 });
    }

    const products = await calculateProductEacs(productIds, body.assumptions ?? {});
    return NextResponse.json({
      products,
      assumptions: body.assumptions ?? {},
    });
  } catch (error) {
    console.error("[api/eac/calculate]", error);
    return NextResponse.json({ error: "Failed to calculate EAC" }, { status: 500 });
  }
}
