"use client";

import * as React from "react";
import { Navigation, Phone, Globe, Share2, Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { AnalyticsEventName } from "@/lib/constants";

/**
 * Fire-and-forget analytics ping. Never blocks navigation or throws into the
 * UI — the API contract treats /api/track as best-effort.
 */
function ping(event: AnalyticsEventName, businessId: string) {
  try {
    const body = JSON.stringify({ event, businessId });
    const blob = new Blob([body], { type: "application/json" });
    // sendBeacon survives page unload (tel:/external nav) better than fetch.
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/track", blob);
      return;
    }
  } catch {
    /* fall through to fetch */
  }
  void fetch("/api/track", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event, businessId }),
    keepalive: true,
  }).catch(() => {});
}

type TrackedButtonProps = {
  businessId: string;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "secondary" | "outline" | "ghost";
  className?: string;
};

/** "Залгах" — opens tel: and records phone_clicked. */
export function CallButton({
  businessId,
  phone,
  size = "default",
  variant = "outline",
  className,
}: TrackedButtonProps & { phone: string }) {
  return (
    <Button
      asChild
      variant={variant}
      size={size}
      className={className}
      onClick={() => ping("phone_clicked", businessId)}
    >
      <a href={`tel:${phone.replace(/\s+/g, "")}`}>
        <Phone />
        Залгах
      </a>
    </Button>
  );
}

/** "Вэбсайт" — opens the site in a new tab and records website_clicked. */
export function WebsiteButton({
  businessId,
  website,
  size = "default",
  variant = "outline",
  className,
}: TrackedButtonProps & { website: string }) {
  const href = website.startsWith("http") ? website : `https://${website}`;
  return (
    <Button
      asChild
      variant={variant}
      size={size}
      className={className}
      onClick={() => ping("website_clicked", businessId)}
    >
      <a href={href} target="_blank" rel="noopener noreferrer nofollow">
        <Globe />
        Вэбсайт
      </a>
    </Button>
  );
}

/**
 * "Чиглэл авах" — opens a map directions URL (or falls back to scrolling to
 * the in-page map) and records direction_clicked.
 */
export function DirectionsButton({
  businessId,
  lat,
  lng,
  name,
  size = "default",
  variant = "default",
  className,
}: TrackedButtonProps & {
  lat: number | null;
  lng: number | null;
  name: string;
}) {
  const hasGeo = lat != null && lng != null;
  const href = hasGeo
    ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${encodeURIComponent(
        name,
      )}`
    : undefined;

  function handleClick() {
    ping("direction_clicked", businessId);
    if (!hasGeo) {
      document
        .getElementById("map")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  if (href) {
    return (
      <Button
        asChild
        variant={variant}
        size={size}
        className={className}
        onClick={handleClick}
      >
        <a href={href} target="_blank" rel="noopener noreferrer">
          <Navigation />
          Чиглэл авах
        </a>
      </Button>
    );
  }

  return (
    <Button variant={variant} size={size} className={className} onClick={handleClick}>
      <Navigation />
      Чиглэл авах
    </Button>
  );
}

/** "Хуваалцах" — Web Share API with a clipboard fallback. */
export function ShareButton({
  name,
  size = "default",
  variant = "outline",
  className,
}: {
  name: string;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "secondary" | "outline" | "ghost";
  className?: string;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = React.useState(false);

  async function handleShare() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const shareData = { title: name, text: `${name} — Mongol Local`, url };
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share(shareData);
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({ title: "Холбоос хуулагдлаа" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* user cancelled the share sheet — ignore */
    }
  }

  return (
    <Button variant={variant} size={size} className={className} onClick={handleShare}>
      {copied ? <Check className={cn("text-success")} /> : <Share2 />}
      Хуваалцах
    </Button>
  );
}
