import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NormalizedTransaction, upsertTransactions, mapGlofoxPayment } from "@/lib/transactions";

export const runtime = "nodejs";

// ---- TYPES ----

type GlofoxSecret = {
  apiKey?: string;
  apiToken?: string;
  studioId?: string;
  webhookSalt?: string;
};

type GlofoxEvent = {
  Type?: string;
  type?: string;
  [key: string]: unknown;
};

// ---- HELPERS ----

function verifySignature(rawBody: string, provided: string | null, salt?: string | null) {
  if (!salt) return true;
  if (!provided) return false;
  // Glofox signature is HMAC-SHA256 of the raw body using the secret salt
  const digest = createHmac("sha256", salt).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(digest), Buffer.from(provided));
  } catch {
    return false;
  }
}

function extractPayments(payload: Record<string, unknown>): Record<string, unknown>[] {
  if (Array.isArray(payload.payments)) {
    return payload.payments as Record<string, unknown>[];
  }
  if (payload.payment && typeof payload.payment === "object") {
    return [payload.payment as Record<string, unknown>];
  }
  if (payload.sale && typeof payload.sale === "object") {
    return [payload.sale as Record<string, unknown>];
  }
  if (payload.data && Array.isArray((payload.data as { payments?: unknown[] }).payments)) {
    return ((payload.data as { payments?: unknown[] }).payments ?? []) as Record<string, unknown>[];
  }
  return [payload as Record<string, unknown>];
}

async function syncToGHL(endpoint: string, payload: Record<string, unknown>) {
  try {
    const record = await prisma.connectionSecret.findUnique({ where: { provider: "ghl" } });
    const secret = record?.secret as { apiKey?: string; locationId?: string } | null;

    if (!secret?.apiKey) {
      console.warn("Skipping GHL sync: No API key found.");
      return;
    }

    // Example GHL call - adjust based on actual GHL API requirements
    // Assuming we use the GHL v2 API or similar with Bearer token
    const res = await fetch(`https://services.leadconnectorhq.com/${endpoint}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${secret.apiKey}`,
        "Version": "2021-07-28", // Use appropriate version
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error("GHL Sync Failed", res.status, txt);
    }
  } catch (error) {
    console.error("GHL Sync Error", error);
  }
}

// ---- EVENT HANDLERS ----

// ---- USER EVENTS ----
async function handleMemberEvent(eventType: string, payload: Record<string, unknown>) {
  const memberId = payload.id || payload.member_id;
  if (!memberId) return;

  const data = {
    memberId: String(memberId),
    firstName: String(payload.first_name || ""),
    lastName: String(payload.last_name || ""),
    email: String(payload.email || ""),
    phone: String(payload.phone || payload.mobile || ""),
  };

  // Upsert Member
  await prisma.member.upsert({
    where: { memberId: data.memberId },
    update: {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
    },
    create: data,
  });

  // Sync to GHL
  // Store mapping in GlofoxGhlLink if needed, but for now just push to GHL
  await syncToGHL("contacts/upsert", {
    email: data.email,
    phone: data.phone,
    firstName: data.firstName,
    lastName: data.lastName,
    tags: ["Glofox"],
    customFields: [
      { key: "glofox_member_id", value: data.memberId }
    ]
  });
}

// ---- MEMBERSHIP EVENTS ----
async function handleMembershipEvent(eventType: string, payload: Record<string, unknown>) {
  const membershipId = String(payload.id || payload.membership_id);
  const memberId = String(payload.member_id || payload.user_id);

  if (!membershipId || !memberId) return;

  const data = {
    membershipId,
    memberId,
    status: String(payload.status || ""),
    name: String(payload.name || payload.membership_name || ""),
    startDate: payload.start_date ? new Date(String(payload.start_date)) : null,
    endDate: payload.end_date ? new Date(String(payload.end_date)) : null,
    price: Number(payload.price || payload.rate || 0),
    nextPaymentDate: payload.next_payment_date ? new Date(String(payload.next_payment_date)) : null,
  };

  // Upsert Membership
  // Ensure member exists first to avoid FK errors if events arrive out of order
  // (Optional: Upsert dummy member if missing, but typically Member Created comes first)
  try {
    await prisma.membership.upsert({
      where: { membershipId: data.membershipId },
      update: {
        status: data.status,
        name: data.name,
        startDate: data.startDate,
        endDate: data.endDate,
        price: data.price,
        nextPaymentDate: data.nextPaymentDate,
      },
      create: data,
    });
  } catch (e) {
    console.error(`Failed to upsert membership ${membershipId}: ${(e as Error).message}`);
    return; // Stop if member doesn't exist
  }

  // Update GHL
  // We need the member's email/phone to identify them in GHL upsert
  const member = await prisma.member.findUnique({ where: { memberId } });
  if (member?.email || member?.phone) {
    await syncToGHL("contacts/upsert", {
      email: member.email,
      phone: member.phone,
      customFields: [
        { key: "glofox_membership_status", value: data.status },
        { key: "glofox_membership_name", value: data.name },
        { key: "glofox_membership_expires_at", value: data.endDate ? data.endDate.toISOString() : "" }
      ]
    });
  }
}

// ---- INVOICE EVENTS ----
async function handleInvoiceEvent(eventType: string, payload: Record<string, unknown>) {
  const invoiceId = String(payload.id || payload.invoice_id);
  const memberId = String((payload.user as any)?.id || payload.member_id || "");
  const lineItems = (payload.line_items as Record<string, unknown>[]) || [];

  if (!invoiceId) return;

  // Helper to get full name
  const user = payload.user as any;
  const fullName = user?.name ||
    (user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : "") ||
    "Unknown Member";

  const transactions: NormalizedTransaction[] = lineItems.map((item, idx) => {
    const prodTypeRaw = String(item.type || "").toUpperCase();
    let productCat = "Other";
    if (prodTypeRaw.includes("APPOINTMENT")) productCat = "PT";
    else if (prodTypeRaw.includes("CLASS") || prodTypeRaw.includes("EVENT")) productCat = "Classes";
    else if (prodTypeRaw.includes("MEMBERSHIP")) productCat = "Membership";

    // Fallback: If amount/total generic fields are missing, try unit_price * quantity
    let amount = Number(item.amount || item.total);

    // If explicit amount is missing, calculate from unit_price
    if (isNaN(amount) && item.unit_price !== undefined) {
      const qty = Number(item.quantity || 1);
      const unitPrice = Number(item.unit_price || 0);
      // Webhook sends unit_price in MINOR units (e.g. 100 = £1.00)
      // We want 'amount' in Major units for the 'amount' variable (which is multiplied by 100 later for amountMinor)
      // Actually, let's keep 'amount' as Major to be consistent with the rest of the file.
      amount = (unitPrice * qty) / 100;
    }

    // Ensure we don't produce NaN
    if (isNaN(amount)) amount = 0;

    return {
      externalId: `${invoiceId}_${idx}`,
      provider: "Glofox",
      amountMinor: Math.round(amount * 100),
      status: String(payload.status || "Completed"),
      occurredAt: new Date(String(payload.created || payload.date || new Date())).toISOString(),
      productType: productCat,
      personName: String(fullName),
      leadId: null,
      currency: String(payload.currency || "EUR").toUpperCase(),
      confidence: "High",
      description: String(item.name || item.description || `Invoice ${invoiceId}`),
      reference: invoiceId,
      metadata: {
        invoiceId,
        memberId,
        itemType: prodTypeRaw,
      },
      raw: payload,
    };
  });

  if (transactions.length > 0) {
    await upsertTransactions(transactions);
  }
}

// ---- BOOKING EVENTS ----
async function handleBookingEvent(eventType: string, payload: Record<string, unknown>) {
  const bookingId = String(payload.id || payload.booking_id);
  const memberId = String(payload.user_id || payload.member_id);

  if (!bookingId || !memberId) return;

  const data = {
    bookingId,
    memberId,
    classType: String(payload.type || "Class"),
    startTime: payload.time_start ? new Date(String(payload.time_start)) : null,
    endTime: payload.time_finish ? new Date(String(payload.time_finish)) : null,
    paid: String(payload.paid ?? ""),
  };

  try {
    await prisma.booking.upsert({
      where: { bookingId: data.bookingId },
      update: {
        classType: data.classType,
        startTime: data.startTime,
        endTime: data.endTime,
        paid: data.paid,
      },
      create: data,
    });
  } catch (e) {
    console.error(`Booking upsert failed: ${e}`);
  }
}

// ---- MAIN HANDLER ----

export async function POST(request: Request) {
  let rawBody: string | null = null;
  try {
    rawBody = await request.text();
    const record = await prisma.connectionSecret.findUnique({ where: { provider: "glofox" } });
    const secret = (record?.secret as GlofoxSecret | null) ?? null;

    // 1. Verify Signature
    const signature = request.headers.get("x-glofox-signature");
    if (secret?.webhookSalt) {
      // Verify signature
      if (!verifySignature(rawBody, signature, secret?.webhookSalt)) {
        console.warn("[Glofox Webhook] Signature verification failed", {
          provided: signature,
          calculated: createHmac("sha256", secret.webhookSalt!).update(rawBody).digest("hex")
        });
        return NextResponse.json({ message: "Invalid signature" }, { status: 401 });
      }
    }

    if (!rawBody) {
      return NextResponse.json({ ok: true, message: "Empty body" });
    }

    const payload = JSON.parse(rawBody) as any;
    const eventType = (payload.Type || payload.type || "").toString().toUpperCase();

    // 2. Comprehensive Logging - Log ALL incoming webhooks
    console.log(`[Glofox Webhook] Received event: ${eventType}`);
    console.log(`[Glofox Webhook] Payload preview:`, JSON.stringify(payload).slice(0, 500));

    await prisma.syncLog.create({
      data: {
        source: "Glofox",
        detail: `Webhook received: ${eventType || "UNKNOWN"}`,
        records: rawBody.slice(0, 1000),
      },
    });

    if (!eventType) {
      console.warn("[Glofox Webhook] No event type found in payload");
      return NextResponse.json({ ok: true, message: "No event type" });
    }

    // 3. Event Routing
    if (eventType.startsWith("MEMBER")) {
      await handleMemberEvent(eventType, payload);
    } else if (eventType.startsWith("MEMBERSHIP")) {
      await handleMembershipEvent(eventType, payload);
    } else if (eventType.includes("INVOICE")) {
      await handleInvoiceEvent(eventType, payload);
    } else if (eventType.includes("BOOKING")) {
      await handleBookingEvent(eventType, payload);
    } else if (eventType.includes("ACCESS") || eventType.includes("EVENT") || eventType.includes("SERVICE")) {
      // Ignore for now
      console.log(`[Glofox Webhook] Ignoring event type: ${eventType}`);
    } else {
      // Unknown or Legacy event - Try to extract payments using fallback logic
      console.log(`[Glofox Webhook] Unknown event type: ${eventType}, attempting fallback payment extraction`);
      const payments = extractPayments(payload).filter(Boolean);
      if (payments.length > 0) {
        try {
          const normalized: NormalizedTransaction[] = payments.map((payment) =>
            mapGlofoxPayment(payment as any)
          );
          await upsertTransactions(normalized);
          console.log(`[Glofox Webhook] Fallback processed ${normalized.length} payments`);

          // Log success
          await prisma.syncLog.create({
            data: {
              source: "Glofox",
              detail: `Processed ${normalized.length} payment(s) from ${eventType}`,
              records: normalized.length.toString(),
            },
          });
        } catch (err) {
          console.error("[Glofox Webhook] Fallback payment processing failed", err);
          await prisma.syncLog.create({
            data: {
              source: "Glofox",
              detail: `Failed to process payments from ${eventType}`,
              errors: err instanceof Error ? err.message : "Unknown error",
            },
          });
        }
      } else {
        console.log(`[Glofox Webhook] Unknown event type and no payments found: ${eventType}`);
        await prisma.syncLog.create({
          data: {
            source: "Glofox",
            detail: `Unknown event type: ${eventType} (no payments extracted)`,
            records: rawBody.slice(0, 500),
          },
        });
      }
    }

    return NextResponse.json({ ok: true });

  } catch (error) {
    console.error("[Glofox Webhook] Error:", error, rawBody ? rawBody.slice(0, 100) : "<empty>");

    // Log error to database
    await prisma.syncLog.create({
      data: {
        source: "Glofox",
        detail: "Webhook processing failed",
        errors: error instanceof Error ? error.message : "Unknown error",
        records: rawBody?.slice(0, 500),
      },
    }).catch(e => console.error("Failed to log error to database:", e));

    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Glofox webhook failed." },
      { status: 500 }
    );
  }
}
