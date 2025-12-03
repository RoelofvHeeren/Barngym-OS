import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    data: {
      ghlWebhook: "/api/webhooks/ghl",
      expectedFields: ["firstName", "lastName", "email", "phone", "goal", "contactId", "utm fields"],
    },
  });
}
