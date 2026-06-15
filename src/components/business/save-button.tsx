"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Heart } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export type SaveButtonProps = {
  businessId: string;
  /** Initial saved state (from server, when known). */
  initialSaved?: boolean;
  /** Compact heart-only icon button vs. labelled button. */
  variant?: "icon" | "button";
  size?: "sm" | "md";
  className?: string;
};

/**
 * Heart toggle with optimistic UI. POSTs to /api/businesses/:id/save which
 * returns `{ saved }`. Unauthenticated users are routed to /login. Rolls back
 * on error and surfaces a toast.
 */
export function SaveButton({
  businessId,
  initialSaved = false,
  variant = "icon",
  size = "md",
  className,
}: SaveButtonProps) {
  const router = useRouter();
  const { status } = useSession();
  const { toast } = useToast();
  const [saved, setSaved] = React.useState(initialSaved);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => setSaved(initialSaved), [initialSaved]);

  async function toggle(e: React.MouseEvent) {
    // Cards wrap the button in a link — never navigate when saving.
    e.preventDefault();
    e.stopPropagation();

    if (status === "unauthenticated") {
      router.push(
        `/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`,
      );
      return;
    }
    if (pending) return;

    const next = !saved;
    setSaved(next); // optimistic
    setPending(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/save`, {
        method: "POST",
      });
      if (res.status === 401) {
        setSaved(!next);
        router.push(
          `/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`,
        );
        return;
      }
      if (!res.ok) throw new Error("save_failed");
      const json = (await res.json()) as {
        ok: boolean;
        data?: { saved: boolean };
      };
      if (json.ok && json.data) setSaved(json.data.saved);
    } catch {
      setSaved(!next); // rollback
      toast({
        variant: "destructive",
        title: "Алдаа гарлаа",
        description: "Дахин оролдоно уу.",
      });
    } finally {
      setPending(false);
    }
  }

  const label = saved ? "Хадгалсан" : "Хадгалах";
  const heart = (
    <Heart
      className={cn(
        "transition-colors",
        saved ? "fill-soyombo text-soyombo" : "text-current",
      )}
    />
  );

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-pressed={saved}
        aria-label={label}
        disabled={pending}
        className={cn(
          "inline-flex items-center justify-center rounded-full bg-background/85 text-foreground shadow-sm backdrop-blur transition-all hover:scale-105 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
          size === "sm" ? "size-8 [&_svg]:size-4" : "size-9 [&_svg]:size-5",
          className,
        )}
      >
        {heart}
      </button>
    );
  }

  return (
    <Button
      type="button"
      variant={saved ? "secondary" : "outline"}
      size={size === "sm" ? "sm" : "default"}
      onClick={toggle}
      aria-pressed={saved}
      disabled={pending}
      className={className}
    >
      {heart}
      {label}
    </Button>
  );
}
