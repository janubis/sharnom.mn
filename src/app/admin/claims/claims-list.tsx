"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  X,
  Loader2,
  Phone,
  FileText,
  ExternalLink,
  BadgeCheck,
} from "lucide-react";

import type { AdminClaimRow } from "@/db/queries/claims";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState } from "@/components/common/empty-state";
import { adminApi } from "../_components/admin-fetch";

const METHOD_LABEL: Record<string, string> = {
  PHONE: "Утсаар",
  EMAIL: "И-мэйлээр",
  DOCUMENT: "Бичиг баримтаар",
  MANUAL: "Гар аргаар",
};

const STATUS_BADGE: Record<
  AdminClaimRow["status"],
  { label: string; variant: "warning" | "success" | "soyombo" }
> = {
  PENDING: { label: "Хүлээгдэж буй", variant: "warning" },
  APPROVED: { label: "Зөвшөөрсөн", variant: "success" },
  REJECTED: { label: "Татгалзсан", variant: "soyombo" },
};

export function ClaimsList({ claims }: { claims: AdminClaimRow[] }) {
  if (claims.length === 0) {
    return (
      <EmptyState
        icon={BadgeCheck}
        title="Хүсэлт алга"
        description="Шийдвэрлэх эзэмших хүсэлт одоогоор алга байна."
        compact
      />
    );
  }

  return (
    <div className="space-y-4">
      {claims.map((claim) => (
        <ClaimCard key={claim.id} claim={claim} />
      ))}
    </div>
  );
}

function ClaimCard({ claim }: { claim: AdminClaimRow }) {
  const router = useRouter();
  const { toast } = useToast();
  const [note, setNote] = React.useState(claim.adminNote ?? "");
  const [busy, setBusy] = React.useState<"APPROVED" | "REJECTED" | null>(null);
  const pending = claim.status === "PENDING";

  async function decide(decision: "APPROVED" | "REJECTED") {
    try {
      setBusy(decision);
      await adminApi.patch(`/api/admin/claims/${claim.id}`, {
        decision,
        adminNote: note.trim() || undefined,
      });
      toast({
        title: decision === "APPROVED" ? "Зөвшөөрлөө" : "Татгалзлаа",
        variant: "success",
      });
      router.refresh();
    } catch (e) {
      toast({ title: "Алдаа", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  const statusBadge = STATUS_BADGE[claim.status];

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar className="size-10">
            {claim.user?.image && (
              <AvatarImage src={claim.user.image} alt={claim.user.name ?? ""} />
            )}
            <AvatarFallback className="bg-primary/10 text-xs text-primary">
              {(claim.user?.name ?? claim.user?.email ?? "?").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium text-foreground">
              {claim.user?.name ?? "Хэрэглэгч"}
            </p>
            <p className="text-xs text-muted-foreground">{claim.user?.email}</p>
          </div>
        </div>
        <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
      </div>

      <div className="mt-4 rounded-xl border border-border bg-muted/30 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Бизнес
          </span>
          {claim.business && (
            <Link
              href={`/admin/businesses/${claim.business.id}`}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Засах <ExternalLink className="size-3" />
            </Link>
          )}
        </div>
        <p className="mt-1 text-sm font-medium text-foreground">
          {claim.business?.name ?? "—"}
        </p>
      </div>

      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        {claim.verificationMethod && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <BadgeCheck className="size-4" />
            {METHOD_LABEL[claim.verificationMethod] ?? claim.verificationMethod}
          </div>
        )}
        {claim.contactPhone && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="size-4" />
            {claim.contactPhone}
          </div>
        )}
        {claim.evidenceUrl && (
          <a
            href={claim.evidenceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-primary hover:underline"
          >
            <FileText className="size-4" />
            Нотлох баримт
          </a>
        )}
      </div>

      {claim.note && (
        <p className="mt-3 rounded-xl bg-muted/40 p-3 text-sm text-foreground">
          “{claim.note}”
        </p>
      )}

      {pending ? (
        <div className="mt-4 space-y-3">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Админ тэмдэглэл (заавал биш)…"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              className="border-soyombo/40 text-soyombo hover:bg-soyombo/10"
              disabled={busy !== null}
              onClick={() => decide("REJECTED")}
            >
              {busy === "REJECTED" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <X className="size-4" />
              )}
              Татгалзах
            </Button>
            <Button disabled={busy !== null} onClick={() => decide("APPROVED")}>
              {busy === "APPROVED" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              Зөвшөөрөх
            </Button>
          </div>
        </div>
      ) : (
        claim.adminNote && (
          <p className="mt-3 text-xs text-muted-foreground">
            Тэмдэглэл: {claim.adminNote}
          </p>
        )
      )}
    </Card>
  );
}
