import { prisma } from "@/lib/prisma";

type AdsAttributionInput = {
  leadId: string;
  paymentId: string;
  amountCents: number;
  timestamp: Date;
  updateLeadLtv?: boolean;
};

export async function recordAdsAttribution({
  leadId,
  paymentId,
  amountCents,
  timestamp,
  updateLeadLtv = true,
}: AdsAttributionInput) {
  const value = Math.max(0, Math.round(amountCents));

  await prisma.$transaction([
    prisma.adsRevenue.create({
      data: {
        leadId,
        paymentId,
        amountCents: value,
        timestamp,
      },
    }),
    ...(updateLeadLtv
      ? [
          prisma.lead.update({
            where: { id: leadId },
            data: { ltvAdsCents: { increment: value } },
          }),
        ]
      : []),
  ]);
}
