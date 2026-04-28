"use server";

import { revalidatePath } from "next/cache";
import {
  generateFamilyInsights,
  getFamilyInsights,
  StoredFamilyInsights,
} from "@/lib/family-insights";

export async function getFamilyInsightsAction(
  advisorId: number,
  familyId: number,
): Promise<StoredFamilyInsights> {
  return getFamilyInsights(advisorId, familyId);
}

export async function regenerateFamilyInsights(
  advisorId: number,
  familyId: number,
): Promise<void> {
  await generateFamilyInsights(advisorId, familyId);
  revalidatePath(`/families/${familyId}`);
}
