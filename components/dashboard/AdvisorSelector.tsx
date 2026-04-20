"use client";

import { useRouter, usePathname } from "next/navigation";
import { AdvisorInfo } from "@/lib/advisor-data";

interface Props {
  advisors: AdvisorInfo[];
  currentId: number;
}

export function AdvisorSelector({ advisors, currentId }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    router.push(`${pathname}?advisor=${e.target.value}`);
  };

  return (
    <select
      value={currentId}
      onChange={handleChange}
      className="text-sm font-medium border border-border rounded-full px-4 py-1.5 bg-card text-primary shadow-sm
                 focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
    >
      {advisors.map((a) => (
        <option key={a.advisor_id} value={a.advisor_id}>
          {a.advisor_name}
        </option>
      ))}
    </select>
  );
}
