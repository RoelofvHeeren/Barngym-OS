"use client";

import { FileText, Download, Upload, Filter, Search } from "lucide-react";
import { useRef } from "react";
import { handleFileUpload } from "../actions";

type DocFile = {
    id: string;
    name: string;
    type: "PDF" | "DOC" | "XLS";
    tag: "Coaching" | "Retreats" | "Workshops" | "General";
    date: string;
    size: string;
};

const documents: DocFile[] = [];

export default function DocumentLibrary() {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const formData = new FormData();
            formData.append("file", e.target.files[0]);
            try {
                await handleFileUpload(formData);
                alert("File uploaded (placeholder functionality)");
            } catch (error) {
                console.error("Upload failed", error);
            }
        }
    };

    return (
        <div className="glass-panel min-h-[200px]">
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-xl font-semibold">Document Library</h2>
                    <p className="text-sm text-muted">Central repository for all corporate assets.</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                        <input
                            type="text"
                            placeholder="Search files..."
                            className="h-10 rounded-full border border-emerald-900/10 bg-white/40 pl-9 pr-4 text-sm outline-none focus:border-emerald-500/50 focus:bg-white/60"
                        />
                    </div>
                    <button className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-900/10 bg-white/40 text-emerald-800 hover:bg-white/60">
                        <Filter size={18} />
                    </button>
                    <button
                        onClick={handleUploadClick}
                        className="btn-primary flex items-center gap-2 text-sm shadow-md hover:shadow-lg"
                    >
                        <Upload size={16} />
                        <span>Upload</span>
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleFileChange}
                    />
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {documents.map((doc) => (
                    <div key={doc.id} className="group relative flex flex-col justify-between rounded-2xl border border-white/40 bg-white/40 p-4 transition-all hover:-translate-y-1 hover:border-emerald-500/20 hover:bg-white/60 hover:shadow-md">
                        <div className="mb-4 flex items-start justify-between">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100/50 text-emerald-700">
                                <FileText size={20} />
                            </div>
                            <button className="rounded-full p-2 text-muted hover:bg-emerald-100/30 hover:text-emerald-700">
                                <Download size={16} />
                            </button>
                        </div>

                        <div>
                            <h3 className="mb-1 truncate font-medium text-primary" title={doc.name}>{doc.name}</h3>
                            <div className="flex items-center justify-between">
                                <span className="rounded-md bg-white/50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
                                    {doc.tag}
                                </span>
                                <span className="text-xs text-muted opacity-80">{doc.size}</span>
                            </div>
                        </div>
                    </div>
                ))}

                {/* Drop zone placeholder */}
                <div
                    onClick={handleUploadClick}
                    className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-emerald-900/10 bg-black/[0.01] p-4 text-center transition-colors hover:bg-emerald-50/30"
                >
                    <Upload size={24} className="text-muted opacity-50" />
                    <p className="text-xs font-medium text-muted">Drop files to upload</p>
                </div>
            </div>
        </div>
    );
}
