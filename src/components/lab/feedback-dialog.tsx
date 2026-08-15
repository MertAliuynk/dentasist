"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc/client";

export function FeedbackDialog({
  labTreatmentId,
  open,
  onOpenChange,
}: {
  labTreatmentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [message, setMessage] = useState("");
  const utils = trpc.useUtils();

  const addFeedback = trpc.lab.treatment.addFeedback.useMutation({
    onSuccess: () => {
      toast.success("Geri bildirim gönderildi.");
      utils.lab.patient.getById.invalidate();
      utils.lab.feedback.list.invalidate();
      onOpenChange(false);
      setMessage("");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Geri Bildirim Ver</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Mesaj</Label>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button
            disabled={!message.trim() || addFeedback.isPending}
            onClick={() => addFeedback.mutate({ labTreatmentId, message: message.trim() })}
          >
            Gönder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
