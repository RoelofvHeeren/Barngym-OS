import Stripe from "stripe";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  NormalizedTransaction,
  mapStripeCharge,
  mapStripeCheckoutSession,
  mapStripeInvoice,
  mapStripePaymentIntent,
  upsertTransactions,
} from "@/lib/transactions";

export const runtime = "nodejs";

type StripeSecret = {
  secretKey?: string;
  webhookSecret?: string;
};

type StripeEvent = Stripe.Event & {
  data: {
    object:
      | Stripe.Charge
      | Stripe.PaymentIntent
      | Stripe.Invoice
      | Stripe.Checkout.Session
      | Record<string, unknown>;
  };
};

function normalizeStripeEvent(event: StripeEvent): NormalizedTransaction[] {
  const object = event.data.object;
  switch (event.type) {
    case "charge.succeeded":
    case "charge.failed":
    case "charge.pending":
      return [mapStripeCharge(object as Stripe.Charge)];
    case "payment_intent.succeeded":
    case "payment_intent.processing":
    case "payment_intent.payment_failed":
      return [mapStripePaymentIntent(object as Stripe.PaymentIntent)];
    case "invoice.payment_succeeded":
    case "invoice.payment_failed":
      return [mapStripeInvoice(object as Stripe.Invoice)];
    case "checkout.session.completed":
    case "checkout.session.async_payment_failed":
    case "checkout.session.async_payment_succeeded":
      return [mapStripeCheckoutSession(object as Stripe.Checkout.Session)];
    default:
      return [];
  }
}

export async function POST(request: Request) {
  let body: string | null = null;
  try {
    body = await request.text();
    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return NextResponse.json({ ok: false, message: "Missing Stripe signature." }, { status: 400 });
    }

    const record = await prisma.connectionSecret.findUnique({ where: { provider: "stripe" } });
    const secret = (record?.secret as StripeSecret | null) ?? null;
    if (!secret?.webhookSecret || !secret?.secretKey) {
      return NextResponse.json(
        { ok: false, message: "Stripe webhook is not configured. Add the secret on the Connections page." },
        { status: 400 }
      );
    }

    const stripe = new Stripe(secret.secretKey);

    const event = stripe.webhooks.constructEvent(body, signature, secret.webhookSecret) as StripeEvent;
    const normalized = normalizeStripeEvent(event);

    if (!normalized.length) {
      return NextResponse.json({ ok: true, message: `Event ${event.type} ignored.` });
    }

    const result = await upsertTransactions(normalized);
    await prisma.syncLog.create({
      data: {
        source: "Stripe",
        detail: `Webhook ${event.type} processed. ${normalized.length} entr${
          normalized.length === 1 ? "y" : "ies"
        } normalized.`,
        records: result.added.toString(),
      },
    });

    return NextResponse.json({ ok: true, processed: normalized.length, stored: result.added });
  } catch (error) {
    console.error("Stripe webhook failed", error, body);
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Stripe webhook failed.",
      },
      { status: 500 }
    );
  }
}
