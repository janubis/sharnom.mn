"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { BadgePlus, Flag, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const REPORT_REASONS = [
  { value: "closed", label: "Хаагдсан / байхгүй болсон" },
  { value: "duplicate", label: "Давхардсан бүртгэл" },
  { value: "wrong-info", label: "Буруу мэдээлэл" },
  { value: "inappropriate", label: "Зохисгүй агуулга" },
  { value: "spam", label: "Спам / залилан" },
  { value: "other", label: "Бусад" },
];

export type FooterActionsProps = {
  businessId: string;
  businessSlug: string;
  /** Hide the claim CTA when the business already has a verified owner. */
  claimable: boolean;
};

/**
 * Profile footer: claim ownership (links to the owner claim flow) and report a
 * problem (POST /api/reports with the BUSINESS target).
 */
export function FooterActions({
  businessId,
  businessSlug,
  claimable,
}: FooterActionsProps) {
  const router = useRouter();
  const { status } = useSession();
  const { toast } = useToast();

  const [reportOpen, setReportOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [detail, setDetail] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  function openReport() {
    if (status === "unauthenticated") {
      router.push(
        `/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`,
      );
      return;
    }
    setReportOpen(true);
  }

  async function submitReport(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) {
      toast({ title: "Шалтгаанаа сонгоно уу" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetType: "BUSINESS",
          targetId: businessId,
          reason,
          detail: detail.trim() || undefined,
        }),
      });
      if (res.status === 401) {
        router.push(
          `/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`,
        );
        return;
      }
      if (!res.ok) throw new Error("report_failed");
      toast({
        title: "Гомдлыг хүлээн авлаа",
        description: "Манай баг шалгана. Баярлалаа!",
      });
      setReportOpen(false);
      setReason("");
      setDetail("");
    } catch {
      toast({
        variant: "destructive",
        title: "Алдаа гарлаа",
        description: "Дахин оролдоно уу.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {claimable && (
        <Button asChild variant="outline" size="sm">
          <Link href={`/owner/claim?business=${encodeURIComponent(businessSlug)}`}>
            <BadgePlus />
            Энэ бизнесийг эзэмших
          </Link>
        </Button>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={openReport}
      >
        <Flag />
        Алдаа мэдээлэх
      </Button>

      <Dialog open={reportOpen} onOpenChange={(v) => !submitting && setReportOpen(v)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Алдаа мэдээлэх</DialogTitle>
            <DialogDescription>
              Энэ бизнесийн талаар асуудал байвал бидэнд мэдэгдээрэй.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submitReport} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="report-reason">Шалтгаан</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger id="report-reason">
                  <SelectValue placeholder="Шалтгаан сонгох" />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="report-detail">Дэлгэрэнгүй</Label>
              <Textarea
                id="report-detail"
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder="Нэмэлт мэдээлэл (заавал биш)"
                maxLength={2000}
                className="min-h-24"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setReportOpen(false)}
                disabled={submitting}
              >
                Цуцлах
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="animate-spin" />}
                Илгээх
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
