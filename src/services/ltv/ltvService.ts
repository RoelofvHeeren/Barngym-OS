import { prisma } from "@/lib/prisma";

type LtvCategory =
  | "pt"
  | "classes"
  | "six_week"
  | "online_coaching"
  | "community"
  | "corporate"
  | "unknown";

type LtvUpdateInput = {
  leadId: string;
  amountCents: number;
  category: LtvCategory;
  fromAds: boolean;
};

export async function updateLtvTotals({ leadId, amountCents, category, fromAds }: LtvUpdateInput) {
  const value = Math.max(0, Math.round(amountCents));
  const data: Record<string, unknown> = {
    ltvAllCents: { increment: value },
  };

  if (fromAds) {
    data.ltvAdsCents = { increment: value };
  }

  const categoryFieldMap: Record<LtvCategory, string> = {
    pt: "ltvPTCents",
    classes: "ltvClassesCents",
    six_week: "ltvSixWeekCents",
    online_coaching: "ltvOnlineCoachingCents",
    community: "ltvCommunityCents",
    corporate: "ltvCorporateCents",
    unknown: "",
  };

  const field = categoryFieldMap[category];
  if (field) {
    data[field] = { increment: value };
  }

  return prisma.lead.update({
    where: { id: leadId },
    data,
  });
}
