import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { matchTransactionToMember } from "@/lib/matching/members";

export const runtime = "nodejs";

type SourceOption = "all" | "stripe" | "glofox" | "starling";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { source?: SourceOption };
    const source = (body.source || "all").toLowerCase() as SourceOption;

    const sourceFilter =
      source === "all"
        ? { in: ["Stripe", "Glofox", "Starling"] }
        : source === "stripe"
        ? { equals: "Stripe" }
        : source === "glofox"
        ? { equals: "Glofox" }
        : { equals: "Starling" };

    const unmatched = await prisma.manualMatchQueue.findMany({
      where: {
        resolvedAt: null,
        transaction: {
          provider: sourceFilter,
        },
      },
      include: { transaction: true },
    });

    let matched = 0;
    let failed = 0;
    let autoMapped = 0;

    for (const item of unmatched) {
      if (!item.transaction) continue;
      const tx = item.transaction;

      if (tx.provider === "Starling") {
        const counterparty = tx.personName || tx.reference || "";
        if (counterparty.trim().length) {
          const mapping = await prisma.counterpartyMapping.findFirst({
            where: { provider: "Starling", key: counterparty.toLowerCase() },
          });
          if (mapping) {
            await prisma.transaction.update({
              where: { id: tx.id },
              data: { leadId: mapping.leadId, confidence: "Matched", status: tx.status ?? "Completed" },
            });
            await prisma.manualMatchQueue.update({
              where: { id: item.id },
              data: { resolvedAt: new Date(), resolvedBy: "auto-mapping" },
            });
            autoMapped += 1;
            continue;
          }
        }
      }

      if (tx.provider === "Stripe" || tx.provider === "Glofox") {
        const raw = (tx.metadata as Record<string, unknown>)?.raw as Record<string, unknown> | undefined;
        const emailCandidate = raw?.["Email"] ?? (tx.metadata as Record<string, unknown>)?.email;
        const phoneCandidate = raw?.["Phone"] ?? (tx.metadata as Record<string, unknown>)?.phone;
        const email = typeof emailCandidate === "string" ? emailCandidate : undefined;
        const phone = typeof phoneCandidate === "string" ? phoneCandidate : undefined;
        const fullName =
          tx.personName ??
          (raw?.["Full name"] as string | undefined) ??
          (raw?.["Full Name"] as string | undefined);

        const match = await matchTransactionToMember({
          email,
          phone,
          fullName,
          glofoxMemberId:
            (raw?.["Member ID"] as string | undefined) ??
            (raw?.["member_id"] as string | undefined) ??
            undefined,
        });

        if (match.kind === "single_confident") {
          await prisma.transaction.update({
            where: { id: tx.id },
            data: { leadId: match.memberId, confidence: "Matched", status: tx.status ?? "Completed" },
          });
          await prisma.manualMatchQueue.update({
            where: { id: item.id },
            data: { resolvedAt: new Date(), resolvedBy: "bulk-retry" },
          });
          matched += 1;
          continue;
        }
      }

      failed += 1;
    }

    return NextResponse.json({
      ok: true,
      matched,
      autoMapped,
      failed,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Bulk match failed.",
      },
      { status: 500 }
    );
  }
}
