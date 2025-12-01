import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      year: number;
      quarter?: number | null;
      revenueStream: string;
      targetAmount: number;
    };

    if (!body.year || !body.revenueStream || !body.targetAmount) {
      return NextResponse.json(
        { ok: false, message: "Provide year, revenueStream, and targetAmount." },
        { status: 400 }
      );
    }

    const goal = await prisma.revenueGoal.create({
      data: {
        year: body.year,
        quarter: body.quarter ?? null,
        revenueStream: body.revenueStream,
        targetAmount: new Prisma.Decimal(body.targetAmount),
      },
    });

    return NextResponse.json({ ok: true, goal });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Failed to create goal." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      id: string;
      year?: number;
      quarter?: number | null;
      revenueStream?: string;
      targetAmount?: number;
    };

    if (!body.id) {
      return NextResponse.json({ ok: false, message: "Provide goal id." }, { status: 400 });
    }

    const goal = await prisma.revenueGoal.update({
      where: { id: body.id },
      data: {
        year: body.year ?? undefined,
        quarter: body.quarter ?? undefined,
        revenueStream: body.revenueStream ?? undefined,
        targetAmount:
          body.targetAmount !== undefined ? new Prisma.Decimal(body.targetAmount) : undefined,
      },
    });

    return NextResponse.json({ ok: true, goal });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Failed to update goal." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = (await request.json()) as { id?: string };
    if (!id) {
      return NextResponse.json({ ok: false, message: "Provide goal id." }, { status: 400 });
    }
    await prisma.revenueGoal.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Failed to delete goal." },
      { status: 500 }
    );
  }
}
