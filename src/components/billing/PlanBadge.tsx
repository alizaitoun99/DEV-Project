import type { Plan } from "@/generated/prisma/enums";

interface PlanBadgeProps {
  plan: Plan;
}

export function PlanBadge({ plan }: PlanBadgeProps) {
  const color = plan === "PRO"
    ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200"
    : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200";

  return (
    <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {plan === "PRO" ? "Pro" : "Free"}
    </span>
  );
}
