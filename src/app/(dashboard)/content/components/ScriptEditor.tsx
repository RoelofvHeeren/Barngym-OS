
"use client";

interface ScriptEditorProps {
    content: string | null;
    onChange: (value: string) => void;
    readOnly?: boolean;
}

export default function ScriptEditor({ content, onChange, readOnly }: ScriptEditorProps) {
    return (
        <div className="flex h-full flex-col">
            <textarea
                className="flex-1 w-full resize-none rounded-none border-0 bg-transparent p-6 text-lg leading-relaxed focus:ring-0 placeholder:text-muted/50 focus:outline-none"
                placeholder="# Video Title\n\n**Hook**\nStart with a question...\n\n**Body**\nExplain the concept..."
                value={content || ""}
                onChange={(e) => onChange(e.target.value)}
                readOnly={readOnly}
            />
        </div>
    );
}
