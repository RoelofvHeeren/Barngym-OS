
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ChevronLeft, Calendar, User, Save, Target, Layout } from "lucide-react";
import AssetPanel from "../components/AssetPanel";
import ScriptEditor from "../components/ScriptEditor";

// Client component wrapper for simple interactions (would be better split, but keep simple)
import ProjectDetailClient from "../components/ProjectDetailClient";

export default async function ProjectDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const project = await prisma.videoProject.findUnique({
        where: { id },
        include: {
            assets: true,
        },
    });

    if (!project) {
        notFound();
    }

    // We need a client component to handle script updates
    return <ProjectDetailClient project={project} />;
}
