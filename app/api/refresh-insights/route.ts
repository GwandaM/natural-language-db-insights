import { NextRequest, NextResponse } from "next/server";
import { generateAllInsights } from "@/lib/insights";
import { getAdvisors } from "@/lib/advisor-data";
import { ensureDashboardInsightsTable } from "@/lib/cockpit-storage";
import { storeDashboardInsights } from "@/lib/insights";

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
    await ensureDashboardInsightsTable();

    const advisorParam = req.nextUrl.searchParams.get("advisor");
    const advisorIds = advisorParam
      ? [Number(advisorParam)]
      : (await getAdvisors()).map((advisor) => advisor.advisor_id);

    if (advisorIds.length === 0 || advisorIds.some((advisorId) => !Number.isFinite(advisorId))) {
      return NextResponse.json({ error: "Invalid advisor scope" }, { status: 400 });
    }

    await Promise.all(
      advisorIds.map(async (advisorId) => {
        const insights = await generateAllInsights(advisorId);
        await storeDashboardInsights(advisorId, insights);
      }),
    );

    return NextResponse.json({
      success: true,
      generated_at: new Date().toISOString(),
      advisor_ids: advisorIds,
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
