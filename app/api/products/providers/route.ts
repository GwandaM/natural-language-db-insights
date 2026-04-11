import { NextRequest, NextResponse } from "next/server";
import { getProviders } from "@/lib/product-intelligence";

export async function GET(req: NextRequest) {
  try {
    const providerType = req.nextUrl.searchParams.get("provider_type");
    const providers = await getProviders(providerType);
    return NextResponse.json({ providers });
  } catch (error) {
    console.error("[api/products/providers]", error);
    return NextResponse.json({ error: "Failed to load providers" }, { status: 500 });
  }
}
