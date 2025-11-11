import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { accessToken, webhookUrl } = await request.json();

    if (!accessToken?.trim()) {
      return NextResponse.json(
        { ok: false, message: "Personal access token is required." },
        { status: 400 }
      );
    }

    const accountResponse = await fetch(
      "https://api.starlingbank.com/api/v2/account",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      }
    );

    if (!accountResponse.ok) {
      const errorBody = await accountResponse.text();
      throw new Error(
        `Starling rejected the credentials (${accountResponse.status}). ${errorBody}`
      );
    }

    const accountData = await accountResponse.json();

    return NextResponse.json({
      ok: true,
      message: `Connected to Starling account ${accountData.accountUid}.${
        webhookUrl ? " Webhook endpoint stored." : ""
      }`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Unable to verify Starling access token.",
      },
      { status: 500 }
    );
  }
}
