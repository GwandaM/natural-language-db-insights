import { NextRequest, NextResponse } from "next/server";
import { getProducts } from "@/lib/product-intelligence";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const providerIdRaw = searchParams.get("provider_id");
    const products = await getProducts({
      providerId: providerIdRaw ? Number(providerIdRaw) : null,
      providerType: searchParams.get("provider_type"),
      vehicleType: searchParams.get("vehicle_type"),
      productFamily: searchParams.get("product_family"),
      query: searchParams.get("q"),
    });

    return NextResponse.json({ products });
  } catch (error) {
    console.error("[api/products]", error);
    return NextResponse.json({ error: "Failed to load products" }, { status: 500 });
  }
}
