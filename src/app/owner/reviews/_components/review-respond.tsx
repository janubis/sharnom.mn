"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MessageSquareReply, Loader2, Pencil, X } from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/**
 * Inline owner-response editor for a single review. Renders the existing
 * response (if any) and lets the owner add/edit it, posting to the owner
 * respond-review endpoint.
 */
export function ReviewRespond({
  businessId,
  reviewId,
  initialResponse,
  respondedAt,
}: {
  businessId: string;
  reviewId: string;
  initialResponse: string | null;
  respondedAt: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState(initialResponse ?? "");
  const [response, setResponse] = React.useState(initialResponse);
  const [respondedDate, setRespondedDate] = React.useState(respondedAt);
  const [submitting, setSubmitting] = React.useState(false);

  async function submit() {
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      toast({
        variant: "destructive",
        title: "Хариу хэт богино байна",
        description: "Дор хаяж 2 тэмдэгт бичнэ үү.",
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/owner/businesses/${businessId}/respond-review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reviewId, response: trimmed }),
        },
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Хариу илгээхэд алдаа гарлаа");
      }
      setResponse(trimmed);
      setRespondedDate(new Date().toISOString());
      setOpen(false);
      toast({ variant: "success", title: "Хариу хадгалагдлаа" });
      router.refresh();
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Алдаа гарлаа",
        description: (e as Error).message,
      });
    } finally {
      setSubmitting(false);
    }
  }

  // Existing response, not editing.
  if (response && !open) {
    return (
      <div className="mt-3 rounded-xl border border-border bg-muted/40 p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">
            Эзэмшигчийн хариу
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => {
              setValue(response);
              setOpen(true);
            }}
          >
            <Pencil className="size-3.5" />
            Засах
          </Button>
        </div>
        <p className="mt-1.5 whitespace-pre-line text-sm text-foreground/90">
          {response}
        </p>
        {respondedDate && (
          <p className="mt-1 text-xs text-muted-foreground">
            {new Date(respondedDate).toLocaleDateString("mn-MN")}
          </p>
        )}
      </div>
    );
  }

  // Editing / composing.
  if (open) {
    return (
      <div className="mt-3 space-y-2">
        <Textarea
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Сэтгэгдэлд эелдгээр хариулна уу..."
          maxLength={2000}
          className="min-h-[88px]"
        />
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={submitting}
            onClick={() => setOpen(false)}
          >
            <X className="size-4" />
            Цуцлах
          </Button>
          <Button type="button" size="sm" disabled={submitting} onClick={() => void submit()}>
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <MessageSquareReply className="size-4" />
            )}
            Хариу илгээх
          </Button>
        </div>
      </div>
    );
  }

  // No response yet — show the trigger.
  return (
    <div className="mt-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <MessageSquareReply className="size-4" />
        Хариулах
      </Button>
    </div>
  );
}
