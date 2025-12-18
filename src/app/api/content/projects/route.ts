
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { VideoProjectStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const status = searchParams.get("status");

        const where = status && status !== "ALL"
            ? { status: status as VideoProjectStatus }
            : {};

        const projects = await prisma.videoProject.findMany({
            where,
            orderBy: { updatedAt: "desc" },
            include: {
                _count: {
                    select: { assets: true },
                },
            },
        });

        return NextResponse.json({ ok: true, data: projects });
    } catch (error) {
        console.error("Error fetching video projects:", error);
        return NextResponse.json({ ok: false, message: "Failed to fetch projects" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { title, goal, platform, status } = body;

        if (!title) {
            return NextResponse.json({ ok: false, message: "Title is required" }, { status: 400 });
        }

        const project = await prisma.videoProject.create({
            data: {
                title,
                goal,
                platform: platform || "INSTAGRAM_REEL",
                status: status || "IDEA",
            },
        });

        return NextResponse.json({ ok: true, data: project });
    } catch (error) {
        console.error("Error creating video project:", error);
        return NextResponse.json({ ok: false, message: "Failed to create project" }, { status: 500 });
    }
}
