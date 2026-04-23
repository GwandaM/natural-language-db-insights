"use server";

import {
  getPortfolioDeepDiveSnapshot,
  PortfolioDeepDiveSnapshot,
} from "@/lib/portfolio-deepdive";

export async function fetchPortfolioDeepDive(
  advisorId: number,
  clientId: number | null,
): Promise<PortfolioDeepDiveSnapshot> {
  return getPortfolioDeepDiveSnapshot(advisorId, clientId);
}
