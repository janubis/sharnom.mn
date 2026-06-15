"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Loader2, PencilLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { UB_DISTRICTS } from "@/lib/constants";

export type SuggestEditDialogProps = {
  businessId: string;
  /** Current values to pre-fill the form. */
  initial: {
    name: string;
    phone: string | null;
    website: string | null;
    addressText: string | null;
    district: string | null;
    description: string | null;
  };
};

type FieldKey = "phone" | "website" | "addressText" | "district" | "description";

/**
 * Lets any signed-in user propose corrections to a business profile. Only
 * changed fields are submitted as a payload to
 * POST /api/businesses/:id/suggest-edit (suggestEditSchema). Moderators review.
 */
export function SuggestEditDialog({ businessId, initial }: SuggestEditDialogProps) {
  const router = useRouter();
  const { status } = useSession();
  const { toast } = useToast();

  const [open, setOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [form, setForm] = React.useState({
    phone: initial.phone ?? "",
    website: initial.website ?? "",
    addressText: initial.addressText ?? "",
    district: initial.district ?? "",
    description: initial.description ?? "",
    note: "",
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleTrigger() {
    if (status === "unauthenticated") {
      router.push(
        `/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`,
      );
      return;
    }
    setOpen(true);
  }

  function buildPayload(): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    const fields: FieldKey[] = [
      "phone",
      "website",
      "addressText",
      "district",
      "description",
    ];
    for (const key of fields) {
      const current = (initial[key] ?? "") as string;
      const next = form[key].trim();
      if (next !== current.trim()) payload[key] = next;
    }
    if (form.note.trim()) payload.note = form.note.trim();
    return payload;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = buildPayload();
    if (Object.keys(payload).length === 0) {
      toast({ title: "Өөрчлөлт алга", description: "Дор хаяж нэг талбар засна уу." });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/suggest-edit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ payload }),
      });
      if (res.status === 401) {
        router.push(
          `/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`,
        );
        return;
      }
      if (!res.ok) throw new Error("suggest_failed");
      toast({
        title: "Саналыг хүлээн авлаа",
        description: "Манай баг шалгаад баталгаажуулна. Баярлалаа!",
      });
      setOpen(false);
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
    <>
      <Button variant="outline" size="sm" onClick={handleTrigger}>
        <PencilLine />
        Мэдээлэл засах санал
      </Button>

      <Dialog open={open} onOpenChange={(v) => !submitting && setOpen(v)}>
        <DialogContent className="max-h-[92dvh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Мэдээлэл засах санал</DialogTitle>
            <DialogDescription>
              {initial.name} — буруу эсвэл дутуу мэдээллийг засаж илгээнэ үү.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="se-phone">Утас</Label>
              <Input
                id="se-phone"
                inputMode="tel"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="99112233"
                maxLength={40}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="se-website">Вэбсайт</Label>
              <Input
                id="se-website"
                inputMode="url"
                value={form.website}
                onChange={(e) => set("website", e.target.value)}
                placeholder="https://..."
                maxLength={255}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="se-address">Хаяг</Label>
              <Input
                id="se-address"
                value={form.addressText}
                onChange={(e) => set("addressText", e.target.value)}
                placeholder="Дэлгэрэнгүй хаяг"
                maxLength={500}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="se-district">Дүүрэг</Label>
              <Select
                value={form.district || undefined}
                onValueChange={(v) => set("district", v)}
              >
                <SelectTrigger id="se-district">
                  <SelectValue placeholder="Дүүрэг сонгох" />
                </SelectTrigger>
                <SelectContent>
                  {UB_DISTRICTS.map((d) => (
                    <SelectItem key={d.slug} value={d.slug}>
                      {d.nameMn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="se-description">Тухай</Label>
              <Textarea
                id="se-description"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Бизнесийн тухай товч тайлбар"
                maxLength={5000}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="se-note">Нэмэлт тайлбар</Label>
              <Textarea
                id="se-note"
                value={form.note}
                onChange={(e) => set("note", e.target.value)}
                placeholder="Юу өөрчилснөө тайлбарлавал бидэнд тус болно"
                maxLength={2000}
                className="min-h-20"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
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
    </>
  );
}
