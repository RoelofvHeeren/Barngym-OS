
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { VideoAssetType } from "@prisma/client";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { projectId, filename, sizeBytes, mimeType, type, url } = body;

        const asset = await prisma.videoAsset.create({
            data: {
                projectId,
                filename,
                sizeBytes,
                mimeType,
                type: type as VideoAssetType || "RAW_FOOTAGE",
                url: url, // In real app, this would be from S3/UploadThing
            },
        });

        return NextResponse.json({ ok: true, data: asset });
    } catch (error) {
        console.error("Error creating asset:", error);
        return NextResponse.json({ ok: false, message: "Failed to create asset" }, { status: 500 });
    }
}
