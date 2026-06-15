"use client";

import * as React from "react";
import { PenLine, ImagePlus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SaveButton } from "@/components/business/save-button";
import {
  CallButton,
  WebsiteButton,
  DirectionsButton,
  ShareButton,
} from "./action-tracker";
import { ReviewDialog } from "./review-dialog";

export type ActionBarProps = {
  businessId: string;
  businessName: string;
  phone: string | null;
  website: string | null;
  lat: number | null;
  lng: number | null;
  saved: boolean;
};

/**
 * Primary action row for the business profile. Sticky to the bottom on mobile
 * (thumb-reachable), inline on desktop. Owns the review composer dialog so both
 * "Сэтгэгдэл бичих" and "Зураг нэмэх" open it.
 */
export function ActionBar({
  businessId,
  businessName,
  phone,
  website,
  lat,
  lng,
  saved,
}: ActionBarProps) {
  const [reviewOpen, setReviewOpen] = React.useState(false);

  return (
    <>
      {/* Desktop / tablet: inline action cluster */}
      <div className="hidden flex-wrap items-center gap-2 sm:flex">
        <DirectionsButton
          businessId={businessId}
          lat={lat}
          lng={lng}
          name={businessName}
        />
        <Button variant="secondary" onClick={() => setReviewOpen(true)}>
          <PenLine />
          Сэтгэгдэл бичих
        </Button>
        <Button variant="outline" onClick={() => setReviewOpen(true)}>
          <ImagePlus />
          Зураг нэмэх
        </Button>
        <SaveButton businessId={businessId} initialSaved={saved} variant="button" />
        {phone && <CallButton businessId={businessId} phone={phone} />}
        {website && <WebsiteButton businessId={businessId} website={website} />}
        <ShareButton name={businessName} />
      </div>

      {/* Mobile: a compact inline set + a sticky bottom bar for the primaries */}
      <div className="flex flex-wrap items-center gap-2 sm:hidden">
        <SaveButton businessId={businessId} initialSaved={saved} variant="button" />
        {phone && <CallButton businessId={businessId} phone={phone} />}
        {website && <WebsiteButton businessId={businessId} website={website} />}
        <ShareButton name={businessName} />
        <Button variant="outline" onClick={() => setReviewOpen(true)}>
          <ImagePlus />
          Зураг
        </Button>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t border-border bg-background/95 p-3 shadow-float backdrop-blur sm:hidden">
        <DirectionsButton
          businessId={businessId}
          lat={lat}
          lng={lng}
          name={businessName}
          className="flex-1"
        />
        <Button
          variant="secondary"
          className="flex-1"
          onClick={() => setReviewOpen(true)}
        >
          <PenLine />
          Сэтгэгдэл
        </Button>
      </div>
      {/* Spacer so the sticky bar never covers footer content on mobile. */}
      <div aria-hidden className="h-16 sm:hidden" />

      <ReviewDialog
        businessId={businessId}
        businessName={businessName}
        open={reviewOpen}
        onOpenChange={setReviewOpen}
      />
    </>
  );
}

/** Standalone "Сэтгэгдэл бичих" CTA used in the empty reviews state / header. */
export function WriteReviewButton({
  businessId,
  businessName,
  variant = "secondary",
  size = "default",
  className,
}: {
  businessId: string;
  businessName: string;
  variant?: "default" | "secondary" | "outline";
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={cn(className)}
        onClick={() => setOpen(true)}
      >
        <PenLine />
        Сэтгэгдэл бичих
      </Button>
      <ReviewDialog
        businessId={businessId}
        businessName={businessName}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
