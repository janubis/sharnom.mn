"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Owner-area error boundary — friendly retry on unexpected failures. */
export default function OwnerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="felt-surface flex flex-col items-center justify-center rounded-2xl border border-border px-6 py-16 text-center">
      <span className="mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/15">
        <AlertTriangle className="size-7" aria-hidden />
      </span>
      <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
        Алдаа гарлаа
      </h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Хуудсыг ачаалах үед алдаа гарлаа. Дахин оролдоно уу.
      </p>
      <Button onClick={reset} className="mt-6">
        Дахин оролдох
      </Button>
    </div>
  );
}
