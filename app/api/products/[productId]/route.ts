import { NextResponse } from "next/server";
import { getProductDetail } from "@/lib/product-intelligence";

export async function GET(
  _req: Request,
  context: { params: Promise<{ productId: string }> },
) {
  try {
    const { productId } = await context.params;
    const id = Number(productId);

    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "Invalid product id" }, { status: 400 });
    }

    const product = await getProductDetail(id);
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error("[api/products/:productId]", error);
    return NextResponse.json({ error: "Failed to load product" }, { status: 500 });
  }
}
