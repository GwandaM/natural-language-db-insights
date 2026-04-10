import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { generateAllInsights } from "@/lib/insights";
import { createDashboardInsightsTable } from "@/lib/seed";

// Protect the endpoint — set CRON_SECRET in your environment variables.
// Vercel Cron automatically sends this via the Authorization header.
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // allow in local dev if no secret is configured
  const authHeader = req.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Ensure the table exists
    await createDashboardInsightsTable();

    // Generate all insights (SQL queries + LLM captions)
    const insights = await generateAllInsights();

    // Upsert each insight key as a separate row for easy partial reads
    const entries = Object.entries(insights) as [string, unknown][];
    for (const [key, value] of entries) {
      await sql`
        INSERT INTO dashboard_insights (insight_key, data, generated_at)
        VALUES (${key}, ${JSON.stringify(value)}, NOW())
        ON CONFLICT (insight_key)
        DO UPDATE SET data = EXCLUDED.data, generated_at = EXCLUDED.generated_at;
      `;
    }

    return NextResponse.json({
      success: true,
      generated_at: new Date().toISOString(),
      keys: entries.map(([k]) => k),
    });
  } catch (err) {
    console.error("[refresh-insights]", err);
    return NextResponse.json(
      { error: "Failed to refresh insights" },
      { status: 500 }
    );
  }
}

// Also allow GET so Vercel Cron can hit it (Vercel Cron uses GET by default)
export async function GET(req: NextRequest) {
  return POST(req);
}
