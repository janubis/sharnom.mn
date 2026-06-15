"use client";

import * as React from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { CategoryGlyph } from "@/components/business/category-icon";
import { Input } from "@/components/ui/input";

/**
 * Curated set of lucide icon names supported by CategoryGlyph (must stay a
 * subset of the ICONS map in components/business/category-icon.tsx so previews
 * never fall back).
 */
export const ICON_CHOICES = [
  "Store",
  "UtensilsCrossed",
  "Utensils",
  "Coffee",
  "Beef",
  "Beer",
  "Croissant",
  "Bike",
  "HeartPulse",
  "Stethoscope",
  "Smile",
  "Sparkles",
  "Scissors",
  "Dumbbell",
  "Flower2",
  "ShoppingBag",
  "ShoppingCart",
  "Shirt",
  "Flower",
  "Smartphone",
  "Lamp",
  "Wrench",
  "Car",
  "WashingMachine",
  "Scale",
  "Calculator",
  "Laptop",
  "Printer",
  "GraduationCap",
  "School",
  "Baby",
  "BookOpen",
  "PartyPopper",
  "Mic2",
  "Clapperboard",
  "Gamepad2",
  "Plane",
  "BedDouble",
  "TreePalm",
  "Tent",
  "MapPin",
] as const;

export function IconPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (icon: string) => void;
}) {
  const [filter, setFilter] = React.useState("");
  const choices = ICON_CHOICES.filter((c) =>
    c.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className="space-y-2">
      <Input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Дүрс хайх (lucide нэр)…"
        className="h-9"
      />
      <div className="grid max-h-44 grid-cols-7 gap-1.5 overflow-y-auto rounded-xl border border-border p-2">
        {choices.map((icon) => {
          const active = value === icon;
          return (
            <button
              key={icon}
              type="button"
              onClick={() => onChange(icon)}
              title={icon}
              className={cn(
                "relative flex aspect-square items-center justify-center rounded-lg border transition-colors",
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <CategoryGlyph name={icon} className="size-4" />
              {active && (
                <Check className="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-primary text-primary-foreground" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
