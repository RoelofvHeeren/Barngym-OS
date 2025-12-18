
"use client";

import { useState } from "react";
import { Upload, FileVideo, Download, Trash2, File } from "lucide-react";
import { VideoAsset, VideoAssetType } from "@prisma/client";

interface AssetPanelProps {
    projectId: string;
    assets: VideoAsset[];
    onUpload?: () => void; // Trigger refresh
}

export default function AssetPanel({ projectId, assets, onUpload }: AssetPanelProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);

    async function handleFiles(files: FileList | null) {
        if (!files || files.length === 0) return;

        setUploading(true);
        // Simulate upload for now (needs actual storage bucket logic in API)
        // We will just create a DB entry pointing to a dummy URL
        try {
            // Sequential upload simulation
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                await fetch(`/api/content/assets`, {
                    method: "POST",
                    body: JSON.stringify({
                        projectId,
                        filename: file.name,
                        sizeBytes: file.size,
                        mimeType: file.type,
                        type: "RAW_FOOTAGE", // Default for drag drop
                        url: "https://placehold.co/600x400.mp4", // Dummy
                    })
                });
            }
            if (onUpload) onUpload();
        } catch (e) {
            console.error("Upload failed", e);
        } finally {
            setUploading(false);
        }
    }

    return (
        <div className="flex h-full flex-col rounded-2xl border border-emerald-900/10 bg-white">
            <div className="border-b border-emerald-900/10 px-4 py-3">
                <h3 className="font-semibold">Assets</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
                {assets.length === 0 ? (
                    <div className="flex h-32 items-center justify-center text-sm text-muted">
                        No assets yet
                    </div>
                ) : (
                    <div className="space-y-2">
                        {assets.map(asset => (
                            <div key={asset.id} className="group flex items-center justify-between rounded-lg border border-emerald-900/5 bg-emerald-50/30 p-2 hover:bg-emerald-50/60">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-100/50 text-emerald-700">
                                        {asset.mimeType?.includes('video') ? <FileVideo size={16} /> : <File size={16} />}
                                    </div>
                                    <div className="overflow-hidden">
                                        <p className="truncate text-xs font-medium">{asset.filename}</p>
                                        <p className="text-[10px] text-muted uppercase">{asset.type.replace('_', ' ')}</p>
                                    </div>
                                </div>
                                <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                    <button className="rounded p-1 text-muted hover:bg-white hover:text-primary">
                                        <Download size={14} />
                                    </button>
                                    <button className="rounded p-1 text-muted hover:bg-white hover:text-rose-600">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div
                className={`m-2 flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-colors ${isDragging ? "border-emerald-500 bg-emerald-50" : "border-emerald-900/10 bg-emerald-50/10"}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    handleFiles(e.dataTransfer.files);
                }}
            >
                <Upload className={`mb-2 h-6 w-6 ${isDragging ? "text-emerald-600" : "text-muted"}`} />
                <p className="text-xs font-medium text-muted">Drag & Drop files</p>
                <input
                    type="file"
                    multiple
                    className="hidden"
                    id="file-upload"
                    onChange={(e) => handleFiles(e.target.files)}
                />
                <label htmlFor="file-upload" className="mt-2 cursor-pointer text-[10px] text-emerald-600 underline">
                    or browse
                </label>
            </div>
        </div>
    );
}
