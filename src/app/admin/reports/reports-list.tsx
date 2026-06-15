"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  X,
  Loader2,
  Flag,
  Store,
  MessageSquare,
  Image as ImageIcon,
  User as UserIcon,
  ExternalLink,
} from "lucide-react";

import type { ReportStatus } from "@/db/schema";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/common/empty-state";
import { adminApi } from "../_components/admin-fetch";

export type AdminReportRow = {
  id: string;
  targetType: "BUSINESS" | "REVIEW" | "PHOTO" | "USER";
  targetId: string;
  reason: string;
  detail: string | null;
  status: ReportStatus;
  createdAt: string;
  reporterName: string | null;
  /** Resolved business link target when the report concerns a business/review. */
  businessId: string | null;
  businessName: string | null;
};

const TARGET_META: Record<
  AdminReportRow["targetType"],
  { label: string; icon: typeof Store }
> = {
  BUSINESS: { label: "Бизнес", icon: Store },
  REVIEW: { label: "Сэтгэгдэл", icon: MessageSquare },
  PHOTO: { label: "Зураг", icon: ImageIcon },
  USER: { label: "Хэрэглэгч", icon: UserIcon },
};

export function ReportsList({ reports }: { reports: AdminReportRow[] }) {
  if (reports.length === 0) {
    return (
      <EmptyState
        icon={Flag}
        title="Нээлттэй гомдол алга"
        description="Бүх гомдол шийдвэрлэгдсэн байна."
        compact
      />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {reports.map((report) => (
        <ReportCard key={report.id} report={report} />
      ))}
    </div>
  );
}

function ReportCard({ report }: { report: AdminReportRow }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState<ReportStatus | null>(null);
  const meta = TARGET_META[report.targetType];
  const Icon = meta.icon;

  async function resolve(status: "RESOLVED" | "DISMISSED") {
    try {
      setBusy(status);
      await adminApi.patch(`/api/admin/reports/${report.id}`, { status });
      toast({
        title: status === "RESOLVED" ? "Шийдвэрлэлээ" : "Цуцаллаа",
        variant: "success",
      });
      router.refresh();
    } catch (e) {
      toast({ title: "Алдаа", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-2">
        <Badge variant="outline">
          <Icon className="size-3" />
          {meta.label}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {new Date(report.createdAt).toLocaleDateString("mn-MN")}
        </span>
      </div>

      <p className="mt-3 font-medium text-foreground">{report.reason}</p>
      {report.detail && (
        <p className="mt-1 text-sm text-muted-foreground">{report.detail}</p>
      )}

      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
        <p>Мэдээлсэн: {report.reporterName ?? "Зочин"}</p>
        {report.businessId && report.businessName && (
          <Link
            href={`/admin/businesses/${report.businessId}`}
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            {report.businessName}
            <ExternalLink className="size-3" />
          </Link>
        )}
      </div>

      <div className="mt-4 flex justify-end gap-2 border-t border-border/60 pt-3">
        <Button
          variant="outline"
          size="sm"
          disabled={busy !== null}
          onClick={() => resolve("DISMISSED")}
        >
          {busy === "DISMISSED" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <X className="size-4" />
          )}
          Цуцлах
        </Button>
        <Button size="sm" disabled={busy !== null} onClick={() => resolve("RESOLVED")}>
          {busy === "RESOLVED" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Check className="size-4" />
          )}
          Шийдвэрлэх
        </Button>
      </div>
    </Card>
  );
}
