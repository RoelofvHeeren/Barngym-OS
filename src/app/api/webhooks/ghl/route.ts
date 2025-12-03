import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { processLeadIntake } from "@/services/intake/leadIntakeService";

export const runtime = "nodejs";

async function logPayload(payload: unknown, response: unknown) {
  try {
    const dir = path.join(process.cwd(), "logs", "leads");
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, `${new Date().toISOString().slice(0, 10)}.log`);
    const line = JSON.stringify({
      timestamp: new Date().toISOString(),
      payload,
      response,
    });
    await fs.appendFile(file, `${line}\n`, "utf8");
  } catch (error) {
    console.error("Failed to write lead intake log", error);
  }
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    payload = null;
  }

  try {
    const result = await processLeadIntake(payload ?? {});
    const body = { ok: true, data: result };
    await logPayload(payload, body);
    return NextResponse.json(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to process lead intake.";
    const body = { ok: false, message };
    await logPayload(payload, body);
    return NextResponse.json(body, { status: 500 });
  }
}
