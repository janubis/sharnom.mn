import * as React from "react";
import {
  type LucideIcon,
  type LucideProps,
  // Curated set covering the seed taxonomy in src/lib/constants.ts.
  Store,
  UtensilsCrossed,
  Utensils,
  Coffee,
  Beef,
  Beer,
  Croissant,
  Bike,
  HeartPulse,
  Stethoscope,
  Smile,
  Sparkles,
  Scissors,
  Dumbbell,
  Flower2,
  ShoppingBag,
  ShoppingCart,
  Shirt,
  Flower,
  Smartphone,
  Lamp,
  Wrench,
  Car,
  WashingMachine,
  Scale,
  Calculator,
  Laptop,
  Printer,
  GraduationCap,
  School,
  Baby,
  BookOpen,
  PartyPopper,
  Mic2,
  Clapperboard,
  Gamepad2,
  Plane,
  BedDouble,
  TreePalm,
  Tent,
  MapPin,
} from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Maps a lucide icon name (as stored on `category.icon`) to its component.
 * Falls back to a neutral marker so unknown/new categories still render.
 */
const ICONS: Record<string, LucideIcon> = {
  Store,
  UtensilsCrossed,
  Utensils,
  Coffee,
  Beef,
  Beer,
  Croissant,
  Bike,
  HeartPulse,
  Stethoscope,
  Smile,
  Sparkles,
  Scissors,
  Dumbbell,
  Flower2,
  ShoppingBag,
  ShoppingCart,
  Shirt,
  Flower,
  Smartphone,
  Lamp,
  Wrench,
  Car,
  WashingMachine,
  Scale,
  Calculator,
  Laptop,
  Printer,
  GraduationCap,
  School,
  Baby,
  BookOpen,
  PartyPopper,
  Mic2,
  Clapperboard,
  Gamepad2,
  Plane,
  BedDouble,
  TreePalm,
  Tent,
  MapPin,
};

/** Resolve a lucide component by name with a safe fallback. */
export function lucideByName(name?: string | null): LucideIcon {
  if (name && ICONS[name]) return ICONS[name];
  return Store;
}

export type CategoryIconProps = {
  /** lucide icon name from `category.icon`. */
  name?: string | null;
  /** Size of the tile. */
  size?: "sm" | "md" | "lg";
  /** Visual treatment of the surrounding tile. */
  tone?: "primary" | "secondary" | "muted";
  className?: string;
  iconProps?: LucideProps;
};

const TILE_SIZES = {
  sm: "h-9 w-9 rounded-lg",
  md: "h-12 w-12 rounded-xl",
  lg: "h-16 w-16 rounded-2xl",
} as const;

const ICON_SIZES = {
  sm: "size-4",
  md: "size-5",
  lg: "size-7",
} as const;

const TONES = {
  primary: "bg-primary/10 text-primary",
  secondary: "bg-secondary/15 text-secondary-foreground",
  muted: "bg-muted text-muted-foreground",
} as const;

/** Renders the resolved lucide icon inside a rounded tile. */
export function CategoryIcon({
  name,
  size = "md",
  tone = "primary",
  className,
  iconProps,
}: CategoryIconProps) {
  const Icon = lucideByName(name);
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center",
        TILE_SIZES[size],
        TONES[tone],
        className,
      )}
    >
      <Icon
        aria-hidden
        {...iconProps}
        className={cn(ICON_SIZES[size], iconProps?.className)}
      />
    </span>
  );
}

/** Bare icon (no tile) — handy inside chips and inline labels. */
export function CategoryGlyph({
  name,
  className,
  ...props
}: { name?: string | null } & LucideProps) {
  const Icon = lucideByName(name);
  return <Icon aria-hidden className={cn("size-4", className)} {...props} />;
}
