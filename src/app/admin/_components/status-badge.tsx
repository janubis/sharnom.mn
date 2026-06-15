import { Badge } from "@/components/ui/badge";
import type {
  BusinessStatus,
  VerificationStatus,
  ReviewStatus,
  PhotoStatus,
} from "@/db/schema";

type BadgeVariant =
  | "default"
  | "secondary"
  | "outline"
  | "success"
  | "warning"
  | "soyombo";

const BUSINESS_STATUS: Record<BusinessStatus, { label: string; variant: BadgeVariant }> = {
  DRAFT: { label: "Ноорог", variant: "outline" },
  ACTIVE: { label: "Идэвхтэй", variant: "success" },
  CLOSED: { label: "Хаагдсан", variant: "warning" },
  DUPLICATE: { label: "Давхардсан", variant: "secondary" },
  DELETED: { label: "Устгасан", variant: "soyombo" },
};

const VERIFICATION_STATUS: Record<
  VerificationStatus,
  { label: string; variant: BadgeVariant }
> = {
  UNVERIFIED: { label: "Баталгаажаагүй", variant: "outline" },
  CLAIMED: { label: "Эзэмшсэн", variant: "secondary" },
  VERIFIED: { label: "Баталгаажсан", variant: "default" },
};

const REVIEW_STATUS: Record<ReviewStatus, { label: string; variant: BadgeVariant }> = {
  PUBLISHED: { label: "Нийтлэгдсэн", variant: "success" },
  PENDING: { label: "Хүлээгдэж буй", variant: "warning" },
  HIDDEN: { label: "Нуусан", variant: "secondary" },
  DELETED: { label: "Устгасан", variant: "soyombo" },
};

const PHOTO_STATUS: Record<PhotoStatus, { label: string; variant: BadgeVariant }> = {
  PENDING: { label: "Хүлээгдэж буй", variant: "warning" },
  APPROVED: { label: "Зөвшөөрсөн", variant: "success" },
  REJECTED: { label: "Татгалзсан", variant: "soyombo" },
};

export function BusinessStatusBadge({ status }: { status: BusinessStatus }) {
  const s = BUSINESS_STATUS[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const s = VERIFICATION_STATUS[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  const s = REVIEW_STATUS[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

export function PhotoStatusBadge({ status }: { status: PhotoStatus }) {
  const s = PHOTO_STATUS[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}
