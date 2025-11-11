import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { secretKey, webhookSecret } = await request.json();

    if (!secretKey?.trim()) {
      return NextResponse.json(
        { ok: false, message: "Stripe secret key is required." },
        { status: 400 }
      );
    }

    const accountResponse = await fetch("https://api.stripe.com/v1/accounts", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
    });

    if (!accountResponse.ok) {
      const errorBody = await accountResponse.text();
      throw new Error(
        `Stripe rejected the credentials (${accountResponse.status}). ${errorBody}`
      );
    }

    const accountData = await accountResponse.json();

    return NextResponse.json({
      ok: true,
      message: `Connected to Stripe account ${accountData.id}.${
        webhookSecret ? " Webhook secret captured." : ""
      }`,
      accountId: accountData.id,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to verify Stripe credentials.",
      },
      { status: 500 }
    );
  }
}
