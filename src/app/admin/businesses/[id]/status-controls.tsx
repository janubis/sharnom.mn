"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import type { Business, BusinessStatus, VerificationStatus } from "@/db/schema";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { adminApi } from "../../_components/admin-fetch";

const STATUS: { value: BusinessStatus; label: string }[] = [
  { value: "ACTIVE", label: "Идэвхтэй" },
  { value: "DRAFT", label: "Ноорог" },
  { value: "CLOSED", label: "Хаагдсан" },
  { value: "DUPLICATE", label: "Давхардсан" },
];

const VERIFICATION: { value: VerificationStatus; label: string }[] = [
  { value: "UNVERIFIED", label: "Баталгаажаагүй" },
  { value: "CLAIMED", label: "Эзэмшсэн" },
  { value: "VERIFIED", label: "Баталгаажсан" },
];

/** Admin-only quick controls for lifecycle status and verification. */
export function StatusControls({ business }: { business: Business }) {
  const router = useRouter();
  const { toast } = useToast();
  const [status, setStatus] = React.useState<BusinessStatus>(business.status);
  const [verification, setVerification] = React.useState<VerificationStatus>(
    business.verificationStatus,
  );

  async function patch(body: Record<string, unknown>) {
    try {
      await adminApi.put(`/api/admin/businesses/${business.id}`, body);
      toast({ title: "Шинэчлэгдлээ", variant: "success" });
      router.refresh();
    } catch (e) {
      toast({
        title: "Алдаа",
        description: (e as Error).message,
        variant: "destructive",
      });
    }
  }

  return (
    <Card className="space-y-4 p-6">
      <h2 className="font-display text-base font-semibold text-foreground">
        Төлөв ба баталгаа
      </h2>
      <div className="space-y-1.5">
        <Label>Төлөв</Label>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as BusinessStatus);
            void patch({ status: v });
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Баталгаажуулалт</Label>
        <Select
          value={verification}
          onValueChange={(v) => {
            setVerification(v as VerificationStatus);
            void patch({ verificationStatus: v });
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VERIFICATION.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </Card>
  );
}
