import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { apiKey, locationId } = (await request.json()) as {
      apiKey?: string;
      locationId?: string;
    };

    if (!apiKey || !apiKey.trim()) {
      return NextResponse.json(
        { ok: false, message: "GoHighLevel API key is required." },
        { status: 400 }
      );
    }

    const trimmedKey = apiKey.trim();
    const trimmedLocation = locationId?.trim() || null;

    await prisma.connectionSecret.upsert({
      where: { provider: "ghl" },
      update: {
        secret: { apiKey: trimmedKey, locationId: trimmedLocation },
        status: "connected",
        accountId: trimmedLocation,
        lastVerifiedAt: new Date(),
      },
      create: {
        provider: "ghl",
        secret: { apiKey: trimmedKey, locationId: trimmedLocation },
        status: "connected",
        accountId: trimmedLocation,
        lastVerifiedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true, message: "GoHighLevel credentials saved.", locationId: trimmedLocation });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save GoHighLevel connection.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
