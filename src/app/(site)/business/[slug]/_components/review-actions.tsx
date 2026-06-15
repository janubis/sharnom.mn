"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ThumbsUp, Laugh, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatCount } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type VoteType = "USEFUL" | "FUNNY" | "COOL";

const VOTES: { type: VoteType; label: string; Icon: typeof ThumbsUp }[] = [
  { type: "USEFUL", label: "Хэрэгтэй", Icon: ThumbsUp },
  { type: "FUNNY", label: "Хөгжилтэй", Icon: Laugh },
  { type: "COOL", label: "Гоё", Icon: Sparkles },
];

export type ReviewVoteCounts = {
  USEFUL: number;
  FUNNY: number;
  COOL: number;
};

export type ReviewActionsProps = {
  reviewId: string;
  initialCounts: ReviewVoteCounts;
  className?: string;
};

/**
 * The three vote toggles (Хэрэгтэй / Хөгжилтэй / Гоё) under a review.
 * Optimistic; POSTs to /api/reviews/:id/vote which returns { voted, count }.
 * Anonymous users are routed to /login.
 */
export function ReviewActions({
  reviewId,
  initialCounts,
  className,
}: ReviewActionsProps) {
  const router = useRouter();
  const { status } = useSession();
  const { toast } = useToast();

  const [counts, setCounts] = React.useState<ReviewVoteCounts>(initialCounts);
  const [active, setActive] = React.useState<Record<VoteType, boolean>>({
    USEFUL: false,
    FUNNY: false,
    COOL: false,
  });
  const [pending, setPending] = React.useState<VoteType | null>(null);

  async function vote(voteType: VoteType) {
    if (status === "unauthenticated") {
      router.push(
        `/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`,
      );
      return;
    }
    if (pending) return;

    const wasActive = active[voteType];
    // Optimistic update.
    setActive((a) => ({ ...a, [voteType]: !wasActive }));
    setCounts((c) => ({
      ...c,
      [voteType]: Math.max(0, c[voteType] + (wasActive ? -1 : 1)),
    }));
    setPending(voteType);

    try {
      const res = await fetch(`/api/reviews/${reviewId}/vote`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ voteType }),
      });
      if (res.status === 401) {
        router.push(
          `/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`,
        );
        // roll back
        setActive((a) => ({ ...a, [voteType]: wasActive }));
        setCounts((c) => ({
          ...c,
          [voteType]: Math.max(0, c[voteType] + (wasActive ? 1 : -1)),
        }));
        return;
      }
      if (!res.ok) throw new Error("vote_failed");
      const json = (await res.json()) as {
        ok: boolean;
        data?: { voted: boolean; count: number };
      };
      if (json.ok && json.data) {
        setActive((a) => ({ ...a, [voteType]: json.data!.voted }));
        setCounts((c) => ({ ...c, [voteType]: json.data!.count }));
      }
    } catch {
      // roll back
      setActive((a) => ({ ...a, [voteType]: wasActive }));
      setCounts((c) => ({
        ...c,
        [voteType]: Math.max(0, c[voteType] + (wasActive ? 1 : -1)),
      }));
      toast({
        variant: "destructive",
        title: "Алдаа гарлаа",
        description: "Дахин оролдоно уу.",
      });
    } finally {
      setPending(null);
    }
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {VOTES.map(({ type, label, Icon }) => {
        const isActive = active[type];
        const count = counts[type];
        return (
          <button
            key={type}
            type="button"
            onClick={() => vote(type)}
            disabled={pending === type}
            aria-pressed={isActive}
            aria-label={label}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:opacity-60",
              isActive
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <Icon className="size-4" />
            <span>{label}</span>
            {count > 0 && (
              <span className="tabular-nums">{formatCount(count)}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
