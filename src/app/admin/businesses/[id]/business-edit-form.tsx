"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Save, Loader2 } from "lucide-react";

import type {
  Business,
  BusinessContact,
  BusinessHours,
  BusinessLocation,
} from "@/db/schema";
import { DAYS_MN, PRICE_LEVELS, UB_DISTRICTS } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { adminApi } from "../../_components/admin-fetch";

export type CategoryOption = { slug: string; label: string };

export type BusinessEditFormProps = {
  business: Business;
  location: BusinessLocation | null;
  contact: BusinessContact | null;
  hours: BusinessHours[];
  categoryOptions: CategoryOption[];
  /** Current primary category leaf slug (if any). */
  currentCategorySlug: string | null;
};

type HourRow = {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
};

const NONE = "__none__";

function buildHourRows(hours: BusinessHours[]): HourRow[] {
  // 0..6 (Sun..Sat) — ensure all days exist.
  return Array.from({ length: 7 }, (_, day) => {
    const h = hours.find((x) => x.dayOfWeek === day);
    return {
      dayOfWeek: day,
      openTime: h?.openTime?.slice(0, 5) ?? "09:00",
      closeTime: h?.closeTime?.slice(0, 5) ?? "18:00",
      isClosed: h?.isClosed ?? false,
    };
  });
}

function Field({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

export function BusinessEditForm({
  business,
  location,
  contact,
  hours,
  categoryOptions,
  currentCategorySlug,
}: BusinessEditFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = React.useState(false);

  const [form, setForm] = React.useState({
    name: business.name,
    description: business.description ?? "",
    primaryCategorySlug: currentCategorySlug ?? NONE,
    priceLevel: business.priceLevel ? String(business.priceLevel) : NONE,
    phone: contact?.phone ?? "",
    email: contact?.email ?? "",
    website: contact?.website ?? "",
    facebookUrl: contact?.facebookUrl ?? "",
    instagramUrl: contact?.instagramUrl ?? "",
    addressText: location?.addressText ?? "",
    district: location?.district ?? NONE,
    khoroo: location?.khoroo ?? "",
    latitude: location?.latitude != null ? String(location.latitude) : "",
    longitude: location?.longitude != null ? String(location.longitude) : "",
  });

  const [hourRows, setHourRows] = React.useState<HourRow[]>(() => buildHourRows(hours));

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setHour(day: number, patch: Partial<HourRow>) {
    setHourRows((rows) =>
      rows.map((r) => (r.dayOfWeek === day ? { ...r, ...patch } : r)),
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        primaryCategorySlug:
          form.primaryCategorySlug === NONE ? undefined : form.primaryCategorySlug,
        priceLevel: form.priceLevel === NONE ? null : Number(form.priceLevel),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || "",
        website: form.website.trim() || "",
        facebookUrl: form.facebookUrl.trim() || "",
        instagramUrl: form.instagramUrl.trim() || "",
        addressText: form.addressText.trim() || undefined,
        district: form.district === NONE ? undefined : form.district,
        khoroo: form.khoroo.trim() || undefined,
        latitude: form.latitude ? Number(form.latitude) : undefined,
        longitude: form.longitude ? Number(form.longitude) : undefined,
        hours: hourRows.map((h) => ({
          dayOfWeek: h.dayOfWeek,
          openTime: h.isClosed ? null : h.openTime,
          closeTime: h.isClosed ? null : h.closeTime,
          isClosed: h.isClosed,
        })),
      };

      await adminApi.put(`/api/admin/businesses/${business.id}`, payload);
      toast({ title: "Хадгалагдлаа", variant: "success" });
      router.refresh();
    } catch (err) {
      toast({
        title: "Хадгалж чадсангүй",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Basics */}
      <Card className="space-y-4 p-6">
        <h2 className="font-display text-base font-semibold text-foreground">
          Үндсэн мэдээлэл
        </h2>
        <Field label="Нэр" htmlFor="name">
          <Input
            id="name"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            required
            minLength={2}
            maxLength={255}
          />
        </Field>
        <Field label="Тайлбар" htmlFor="description">
          <Textarea
            id="description"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            rows={4}
            maxLength={5000}
            placeholder="Бизнесийн тухай товч тайлбар…"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ангилал">
            <Select
              value={form.primaryCategorySlug}
              onValueChange={(v) => set("primaryCategorySlug", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Ангилал сонгох" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Сонгоогүй</SelectItem>
                {categoryOptions.map((c) => (
                  <SelectItem key={c.slug} value={c.slug}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Үнийн түвшин">
            <Select value={form.priceLevel} onValueChange={(v) => set("priceLevel", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Сонгох" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Тодорхойгүй</SelectItem>
                {PRICE_LEVELS.map((p) => (
                  <SelectItem key={p.value} value={String(p.value)}>
                    {p.label} · {p.hint}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </Card>

      {/* Contact */}
      <Card className="space-y-4 p-6">
        <h2 className="font-display text-base font-semibold text-foreground">Холбоо барих</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Утас" htmlFor="phone">
            <Input
              id="phone"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              inputMode="tel"
              placeholder="99112233"
            />
          </Field>
          <Field label="И-мэйл" htmlFor="email">
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </Field>
          <Field label="Вэб сайт" htmlFor="website">
            <Input
              id="website"
              value={form.website}
              onChange={(e) => set("website", e.target.value)}
              placeholder="https://"
            />
          </Field>
          <Field label="Facebook" htmlFor="facebook">
            <Input
              id="facebook"
              value={form.facebookUrl}
              onChange={(e) => set("facebookUrl", e.target.value)}
              placeholder="https://facebook.com/…"
            />
          </Field>
          <Field label="Instagram" htmlFor="instagram">
            <Input
              id="instagram"
              value={form.instagramUrl}
              onChange={(e) => set("instagramUrl", e.target.value)}
              placeholder="https://instagram.com/…"
            />
          </Field>
        </div>
      </Card>

      {/* Location */}
      <Card className="space-y-4 p-6">
        <h2 className="font-display text-base font-semibold text-foreground">Байршил</h2>
        <Field label="Хаяг" htmlFor="address">
          <Input
            id="address"
            value={form.addressText}
            onChange={(e) => set("addressText", e.target.value)}
            maxLength={500}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Дүүрэг">
            <Select value={form.district} onValueChange={(v) => set("district", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Сонгох" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Сонгоогүй</SelectItem>
                {UB_DISTRICTS.map((d) => (
                  <SelectItem key={d.slug} value={d.slug}>
                    {d.nameMn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Хороо" htmlFor="khoroo">
            <Input
              id="khoroo"
              value={form.khoroo}
              onChange={(e) => set("khoroo", e.target.value)}
              maxLength={40}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Өргөрөг" htmlFor="lat">
              <Input
                id="lat"
                value={form.latitude}
                onChange={(e) => set("latitude", e.target.value)}
                inputMode="decimal"
                placeholder="47.91"
              />
            </Field>
            <Field label="Уртраг" htmlFor="lng">
              <Input
                id="lng"
                value={form.longitude}
                onChange={(e) => set("longitude", e.target.value)}
                inputMode="decimal"
                placeholder="106.91"
              />
            </Field>
          </div>
        </div>
      </Card>

      {/* Hours */}
      <Card className="space-y-3 p-6">
        <h2 className="font-display text-base font-semibold text-foreground">Цагийн хуваарь</h2>
        <div className="space-y-2">
          {hourRows.map((h) => (
            <div
              key={h.dayOfWeek}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-border px-3 py-2"
            >
              <span className="w-16 text-sm font-medium text-foreground">
                {DAYS_MN[h.dayOfWeek]}
              </span>
              {h.isClosed ? (
                <span className="flex-1 text-sm text-muted-foreground">Амарна</span>
              ) : (
                <div className="flex flex-1 items-center gap-2">
                  <Input
                    type="time"
                    value={h.openTime}
                    onChange={(e) => setHour(h.dayOfWeek, { openTime: e.target.value })}
                    className="w-32"
                  />
                  <span className="text-muted-foreground">—</span>
                  <Input
                    type="time"
                    value={h.closeTime}
                    onChange={(e) => setHour(h.dayOfWeek, { closeTime: e.target.value })}
                    className="w-32"
                  />
                </div>
              )}
              <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
                Хаалттай
                <Switch
                  checked={h.isClosed}
                  onCheckedChange={(c) => setHour(h.dayOfWeek, { isClosed: c })}
                />
              </label>
            </div>
          ))}
        </div>
      </Card>

      <div className="sticky bottom-4 flex justify-end">
        <Button type="submit" disabled={saving} size="lg" className="shadow-float">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Хадгалах
        </Button>
      </div>
    </form>
  );
}
