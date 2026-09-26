"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Paperclip, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type ImageType = (typeof TYPES)[number];
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 5;

export type UploadedAttachment = { objectKey: string; fileName: string; contentType: ImageType; sizeBytes: number };

type Pending = { id: string; file: File; preview: string; status: "uploading" | "done" | "error"; result?: UploadedAttachment };

/**
 * Message box with optional image attachments. Images upload straight to
 * storage through a presigned URL as soon as they're picked/pasted/dropped,
 * so pressing Gönder only sends the message.
 */
export function TicketComposer({
  canAttach,
  attachHint,
  requestUpload,
  onSend,
  pending,
  placeholder = "Mesajınızı yazın…",
  extra,
}: {
  canAttach: boolean;
  attachHint?: string;
  requestUpload: (file: { fileName: string; contentType: ImageType; sizeBytes: number }) => Promise<{ uploadUrl: string; objectKey: string }>;
  onSend: (data: { body: string; attachments: UploadedAttachment[] }) => Promise<unknown>;
  pending: boolean;
  placeholder?: string;
  extra?: React.ReactNode;
}) {
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<Pending[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function add(list: FileList | File[]) {
    if (!canAttach) return;
    const incoming = [...list];
    if (files.length + incoming.length > MAX_FILES) {
      toast.error(`En fazla ${MAX_FILES} görsel ekleyebilirsiniz.`);
      return;
    }
    for (const file of incoming) {
      if (!TYPES.includes(file.type as ImageType)) {
        toast.error(`${file.name}: yalnızca JPG, PNG, WEBP veya GIF görsel eklenebilir.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name}: görsel en fazla 10 MB olabilir.`);
        continue;
      }
      const id = crypto.randomUUID();
      const name = file.name || `ekran-goruntusu-${new Date().toISOString().slice(0, 19)}.png`;
      setFiles((f) => [...f, { id, file, preview: URL.createObjectURL(file), status: "uploading" }]);
      try {
        const meta = { fileName: name, contentType: file.type as ImageType, sizeBytes: file.size };
        const { uploadUrl, objectKey } = await requestUpload(meta);
        const res = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
        if (!res.ok) throw new Error();
        setFiles((f) => f.map((p) => (p.id === id ? { ...p, status: "done", result: { ...meta, objectKey } } : p)));
      } catch (e) {
        setFiles((f) => f.map((p) => (p.id === id ? { ...p, status: "error" } : p)));
        toast.error(e instanceof Error && e.message ? e.message : `${name} yüklenemedi, tekrar deneyin.`);
      }
    }
  }

  function remove(id: string) {
    setFiles((f) => {
      const p = f.find((x) => x.id === id);
      if (p) URL.revokeObjectURL(p.preview);
      return f.filter((x) => x.id !== id);
    });
  }

  const uploading = files.some((f) => f.status === "uploading");
  const ready = files.filter((f) => f.status === "done" && f.result).map((f) => f.result!);
  const canSend = !pending && !uploading && (body.trim().length > 0 || ready.length > 0);

  async function send() {
    if (!canSend) return;
    try {
      await onSend({ body: body.trim(), attachments: ready });
    } catch {
      return; // the caller already showed the error; keep the draft
    }
    files.forEach((f) => URL.revokeObjectURL(f.preview));
    setBody("");
    setFiles([]);
  }

  return (
    <div
      className={`rounded-xl border bg-background p-2 transition-colors ${dragging ? "border-primary bg-primary/5" : "border-input"}`}
      onDragOver={(e) => {
        if (!canAttach) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        if (!canAttach) return;
        e.preventDefault();
        setDragging(false);
        add(e.dataTransfer.files);
      }}
    >
      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {files.map((f) => (
            <div key={f.id} className="relative size-16 overflow-hidden rounded-md border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.preview} alt="" className="size-full object-cover" />
              {f.status === "uploading" && (
                <span className="absolute inset-0 flex items-center justify-center bg-background/60">
                  <Loader2 className="size-4 animate-spin" />
                </span>
              )}
              {f.status === "error" && <span className="absolute inset-0 bg-destructive/40" />}
              <button
                type="button"
                aria-label="Kaldır"
                onClick={() => remove(f.id)}
                className="absolute right-0.5 top-0.5 rounded-full bg-background/90 p-0.5"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="resize-none border-0 bg-transparent p-1.5 shadow-none focus-visible:ring-0"
        onPaste={(e) => {
          const images = [...e.clipboardData.files].filter((f) => f.type.startsWith("image/"));
          if (images.length && canAttach) {
            e.preventDefault();
            add(images);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            send();
          }
        }}
      />
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {canAttach ? (
          <>
            <input
              ref={inputRef}
              type="file"
              accept={TYPES.join(",")}
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files) add(e.target.files);
                e.target.value = "";
              }}
            />
            <Button type="button" variant="ghost" size="sm" onClick={() => inputRef.current?.click()}>
              <Paperclip className="size-4" /> Görsel ekle
            </Button>
          </>
        ) : (
          attachHint && <span className="px-1.5 text-xs text-muted-foreground">{attachHint}</span>
        )}
        {extra}
        <span className="ml-auto hidden text-[11px] text-muted-foreground sm:inline">Ctrl + Enter ile gönder</span>
        <Button type="button" size="sm" disabled={!canSend} onClick={send}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Gönder
        </Button>
      </div>
    </div>
  );
}
