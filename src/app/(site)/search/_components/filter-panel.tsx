"use client";

import * as React from "react";
import { Star, RotateCcw } from "lucide-react";

import { cn } from "@/lib/utils";
import { PRICE_LEVELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { DistrictChips } from "@/components/common/district-chips";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CategoryIcon } from "@/components/business/category-icon";

export type SearchFilters = {
  category?: string;
  district?: string;
  minRating?: number;
  price: number[];
  openNow: boolean;
  verified: boolean;
  /** Distance radius in km (only meaningful when geo is active). */
  radius?: number;
};

export type CategoryOption = {
  slug: string;
  nameMn: string;
  icon: string | null;
  /** Parent group label, for the grouped <Select>. */
  group: string;
};

export type FilterPanelProps = {
  filters: SearchFilters;
  onChange: (next: Partial<SearchFilters>) => void;
  onReset: () => void;
  categories: CategoryOption[];
  /** Whether a geo search is active (enables the distance slider). */
  hasGeo?: boolean;
  className?: string;
};

const RATING_STEPS = [
  { value: 0, label: "Бүгд" },
  { value: 3, label: "3.0+" },
  { value: 3.5, label: "3.5+" },
  { value: 4, label: "4.0+" },
  { value: 4.5, label: "4.5+" },
];

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2.5 text-sm font-semibold text-foreground">{children}</h3>
  );
}

/**
 * The search filter panel: category, rating, distance, price level, district,
 * "open now" and "verified only" toggles. Fully controlled — the parent owns
 * the filter state and syncs it to the URL.
 */
export function FilterPanel({
  filters,
  onChange,
  onReset,
  categories,
  hasGeo = false,
  className,
}: FilterPanelProps) {
  const togglePrice = (level: number) => {
    const set = new Set(filters.price);
    if (set.has(level)) set.delete(level);
    else set.add(level);
    onChange({ price: [...set].sort() });
  };

  const hasActive =
    !!filters.category ||
    !!filters.district ||
    (filters.minRating ?? 0) > 0 ||
    filters.price.length > 0 ||
    filters.openNow ||
    filters.verified;

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-base font-semibold text-foreground">
          Шүүлтүүр
        </h2>
        {hasActive && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="h-8 gap-1.5 text-muted-foreground"
          >
            <RotateCcw className="size-3.5" />
            Цэвэрлэх
          </Button>
        )}
      </div>

      {/* Category */}
      <div>
        <FieldLabel>Ангилал</FieldLabel>
        <Select
          value={filters.category ?? "__all"}
          onValueChange={(v) =>
            onChange({ category: v === "__all" ? undefined : v })
          }
        >
          <SelectTrigger aria-label="Ангилал">
            <SelectValue placeholder="Бүх ангилал" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="__all">Бүх ангилал</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.slug} value={c.slug}>
                <span className="inline-flex items-center gap-2">
                  <CategoryIcon
                    name={c.icon}
                    size="sm"
                    tone="muted"
                    className="size-5 rounded-md [&_svg]:size-3"
                  />
                  {c.nameMn}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Rating */}
      <div>
        <FieldLabel>Хамгийн бага үнэлгээ</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {RATING_STEPS.map((step) => {
            const active = (filters.minRating ?? 0) === step.value;
            return (
              <button
                key={step.value}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ minRating: step.value || undefined })}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:bg-accent",
                )}
              >
                {step.value > 0 && (
                  <Star
                    className={cn(
                      "size-3.5",
                      active ? "fill-current" : "fill-secondary text-secondary",
                    )}
                  />
                )}
                {step.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Distance — only when a geo search is active */}
      {hasGeo && (
        <div>
          <FieldLabel>
            Зай:{" "}
            <span className="font-normal text-muted-foreground">
              {(filters.radius ?? 5).toFixed(0)} км дотор
            </span>
          </FieldLabel>
          <Slider
            value={[filters.radius ?? 5]}
            min={1}
            max={30}
            step={1}
            onValueChange={(v) => onChange({ radius: v[0] })}
            aria-label="Зай"
          />
          <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
            <span>1 км</span>
            <span>30 км</span>
          </div>
        </div>
      )}

      {/* Price level */}
      <div>
        <FieldLabel>Үнийн түвшин</FieldLabel>
        <div className="flex gap-2">
          {PRICE_LEVELS.map((p) => {
            const active = filters.price.includes(p.value);
            return (
              <button
                key={p.value}
                type="button"
                aria-pressed={active}
                title={p.hint}
                onClick={() => togglePrice(p.value)}
                className={cn(
                  "flex-1 rounded-xl border py-2 text-center text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:bg-accent",
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* District */}
      <div>
        <FieldLabel>Дүүрэг</FieldLabel>
        <DistrictChips
          mode="filter"
          showAll
          selected={filters.district ?? null}
          onSelect={(slug) => onChange({ district: slug ?? undefined })}
        />
      </div>

      {/* Toggles */}
      <div className="space-y-4 border-t border-border pt-5">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="open-now" className="cursor-pointer text-sm">
            Одоо нээлттэй
          </Label>
          <Switch
            id="open-now"
            checked={filters.openNow}
            onCheckedChange={(v) => onChange({ openNow: v })}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="verified-only" className="cursor-pointer text-sm">
            Зөвхөн баталгаажсан
          </Label>
          <Switch
            id="verified-only"
            checked={filters.verified}
            onCheckedChange={(v) => onChange({ verified: v })}
          />
        </div>
      </div>
    </div>
  );
}
