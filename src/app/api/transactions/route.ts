
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";
import { listTransactions } from "@/lib/transactions";

export const runtime = "nodejs";

export async function GET() {
  try {
    const data = await listTransactions();
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to load transaction ledger.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { amount, productType, isCash, notes, mode, selectedLeadId, newClient } = body;

    let leadId = null;
    let personName = "Manual Entry";

    if (mode === "existing") {
      leadId = selectedLeadId;
      const contact = await prisma.contact.findUnique({ where: { id: leadId } });
      personName = contact?.fullName || personName;
    } else if (mode === "new" && newClient) {
      // Create new contact
      const contact = await prisma.contact.create({
        data: {
          fullName: newClient.name,
          email: newClient.email,
          status: "lead",
          sourceTags: ["Manual Transaction"],
        },
      });
      leadId = contact.id;
      personName = contact.fullName || personName;
    }

    const amountMinor = Math.round(parseFloat(amount) * 100);
    const transactionId = randomUUID();

    const transaction = await prisma.transaction.create({
      data: {
        externalId: `manual_${transactionId}`,
        transactionUid: transactionId,
        provider: isCash ? "Cash" : "Manual",
        source: "Manual",
        amountMinor,
        currency: "EUR",
        occurredAt: new Date(),
        personName,
        productType,
        status: "Completed",
        confidence: "High",
        description: notes || (isCash ? "Cash Payment" : "Manual Entry"),
        reference: isCash ? "Cash" : undefined,
        contactId: leadId, // Map to contactId
        metadata: {
          isCash,
          notes,
          manualEntry: true,
        },
      },
    });

    return NextResponse.json({ ok: true, data: transaction });
  } catch (error) {
    console.error("Create transaction error:", error);
    return NextResponse.json(
      { ok: false, message: "Failed to create transaction" },
      { status: 500 }
    );
  }
}
