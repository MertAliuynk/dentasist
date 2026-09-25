"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { ScanLine, Upload, Trash2, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
const MAX_SIZE_BYTES = 20 * 1024 * 1024;

function isAllowedType(type: string): type is (typeof ALLOWED_TYPES)[number] {
  return (ALLOWED_TYPES as readonly string[]).includes(type);
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(date));
}

export function PatientXraySection({ patientId }: { patientId: string }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const { data: xrays } = trpc.patientXray.list.useQuery({ patientId });
  const createUploadUrl = trpc.patientXray.createUploadUrl.useMutation();
  const confirmUpload = trpc.patientXray.confirmUpload.useMutation();
  const remove = trpc.patientXray.delete.useMutation({
    onSuccess: () => {
      toast.success("Görüntü silindi.");
      utils.patientXray.list.invalidate({ patientId });
    },
    onError: (e) => toast.error(e.message),
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!isAllowedType(file.type)) {
      toast.error("Yalnızca JPEG, PNG, WEBP veya PDF dosyaları yüklenebilir.");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      toast.error("Dosya boyutu 20 MB'ı aşamaz.");
      return;
    }
    const contentType = file.type;

    setUploading(true);
    try {
      const { uploadUrl, objectKey } = await createUploadUrl.mutateAsync({
        patientId,
        fileName: file.name,
        contentType,
        sizeBytes: file.size,
      });

      const res = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": contentType } });
      if (!res.ok) throw new Error("Dosya depolama alanına yüklenemedi.");

      await confirmUpload.mutateAsync({
        patientId,
        objectKey,
        fileName: file.name,
        contentType,
        sizeBytes: file.size,
      });

      toast.success("Görüntü yüklendi.");
      utils.patientXray.list.invalidate({ patientId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Yükleme başarısız oldu.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card className="print:hidden">
      <CardHeader className="flex flex-col items-start gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
        <div>
          <CardTitle className="text-sm">Röntgen Görüntüleri</CardTitle>
          <CardDescription>JPEG, PNG, WEBP veya PDF · 20 MB&apos;a kadar</CardDescription>
        </div>
        <Button size="sm" variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>
          <Upload className="size-3.5" />
          {uploading ? "Yükleniyor…" : "Görüntü Yükle"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_TYPES.join(",")}
          className="hidden"
          onChange={handleFileChange}
        />
      </CardHeader>
      <CardContent>
        {!xrays || xrays.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border py-8 text-center">
            <ScanLine className="size-5 text-muted-foreground" strokeWidth={1.5} />
            <p className="text-xs text-muted-foreground">Henüz görüntü yüklenmemiş.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {xrays.map((x) => (
              <div key={x.id} className="group relative overflow-hidden rounded-md border border-border">
                <a href={x.viewUrl} target="_blank" rel="noopener noreferrer" className="block">
                  {x.contentType === "application/pdf" ? (
                    <div className="flex aspect-square flex-col items-center justify-center gap-1.5 bg-muted">
                      <FileText className="size-6 text-muted-foreground" />
                      <span className="px-1 text-[10px] text-muted-foreground">PDF</span>
                    </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL, not an optimizable static/remote asset
                    <img src={x.viewUrl} alt={x.fileName} className="aspect-square w-full object-cover" />
                  )}
                </a>
                <div className="flex items-center justify-between gap-1 border-t border-border bg-background/95 px-1.5 py-1">
                  <div className="min-w-0">
                    <p className="truncate text-[10px] font-medium">{x.fileName}</p>
                    <p className="text-[9px] text-muted-foreground">
                      {formatSize(x.sizeBytes)} · {formatDate(x.createdAt)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 shrink-0"
                    aria-label="Sil"
                    onClick={() => {
                      if (confirm(`${x.fileName} silinsin mi?`)) remove.mutate({ id: x.id });
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
