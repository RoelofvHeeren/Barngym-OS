import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      category: string;
      period: string;
      targetAmount: number;
      notes?: string;
    };

    if (!body.category || !body.period || body.targetAmount === undefined) {
      return NextResponse.json(
        { ok: false, message: "Provide category, period, and targetAmount." },
        { status: 400 }
      );
    }

    const goal = await prisma.revenueGoal.create({
      data: {
        category: body.category,
        period: body.period,
        targetAmount: body.targetAmount,
        notes: body.notes,
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
      category?: string;
      period?: string;
      targetAmount?: number;
      notes?: string;
    };

    if (!body.id) {
      return NextResponse.json({ ok: false, message: "Provide goal id." }, { status: 400 });
    }

    const goal = await prisma.revenueGoal.update({
      where: { id: body.id },
      data: {
        category: body.category ?? undefined,
        period: body.period ?? undefined,
        targetAmount: body.targetAmount ?? undefined,
        notes: body.notes ?? undefined,
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
