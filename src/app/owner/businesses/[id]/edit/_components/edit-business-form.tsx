"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";

import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { upsertBusinessSchema, type UpsertBusinessInput } from "@/lib/validations";
import { DAYS_MN, PRICE_LEVELS, UB_DISTRICTS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type CategoryOption = { slug: string; nameMn: string; group: string };

export type HourRow = {
  dayOfWeek: number;
  openTime: string | null;
  closeTime: string | null;
  isClosed: boolean;
};

export type EditFormValues = UpsertBusinessInput;

/** Field-level error text. */
function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-destructive">{message}</p>;
}

/** Normalise a 7-row hours array (Sun..Sat) from whatever the DB returned. */
function buildHours(existing: HourRow[]): HourRow[] {
  return Array.from({ length: 7 }).map((_, day) => {
    const found = existing.find((h) => h.dayOfWeek === day);
    return {
      dayOfWeek: day,
      openTime: found?.openTime ?? "09:00",
      closeTime: found?.closeTime ?? "18:00",
      isClosed: found?.isClosed ?? false,
    };
  });
}

export function EditBusinessForm({
  businessId,
  categories,
  defaultValues,
  initialHours,
}: {
  businessId: string;
  categories: CategoryOption[];
  defaultValues: EditFormValues;
  initialHours: HourRow[];
}) {
  const router = useRouter();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<EditFormValues>({
    resolver: zodResolver(upsertBusinessSchema),
    defaultValues: {
      ...defaultValues,
      hours: buildHours(initialHours),
    },
  });

  // Group categories for the select.
  const grouped = React.useMemo(() => {
    const map = new Map<string, CategoryOption[]>();
    for (const c of categories) {
      const list = map.get(c.group) ?? [];
      list.push(c);
      map.set(c.group, list);
    }
    return [...map.entries()];
  }, [categories]);

  async function onSubmit(values: EditFormValues) {
    try {
      const res = await fetch(`/api/owner/businesses/${businessId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Хадгалахад алдаа гарлаа");
      }
      toast({ variant: "success", title: "Амжилттай хадгаллаа" });
      reset(values); // reset dirty state, keep entered values
      router.refresh();
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Алдаа гарлаа",
        description: (e as Error).message,
      });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Basic info */}
      <Card>
        <CardHeader>
          <CardTitle>Үндсэн мэдээлэл</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label htmlFor="name">Нэр</Label>
            <Input id="name" className="mt-1.5" {...register("name")} />
            <FieldError message={errors.name?.message} />
          </div>

          <div>
            <Label htmlFor="description">Тайлбар</Label>
            <Textarea
              id="description"
              className="mt-1.5 min-h-[120px]"
              placeholder="Бизнесийнхээ талаар товч танилцуулга бичнэ үү"
              {...register("description")}
            />
            <FieldError message={errors.description?.message} />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label>Ангилал</Label>
              <Controller
                control={control}
                name="primaryCategorySlug"
                render={({ field }) => (
                  <Select
                    value={field.value ?? undefined}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Ангилал сонгох" />
                    </SelectTrigger>
                    <SelectContent>
                      {grouped.map(([group, items]) => (
                        <SelectGroup key={group}>
                          <SelectLabel>{group}</SelectLabel>
                          {items.map((c) => (
                            <SelectItem key={c.slug} value={c.slug}>
                              {c.nameMn}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError message={errors.primaryCategorySlug?.message} />
            </div>

            <div>
              <Label>Үнийн түвшин</Label>
              <Controller
                control={control}
                name="priceLevel"
                render={({ field }) => (
                  <Select
                    value={field.value != null ? String(field.value) : undefined}
                    onValueChange={(v) => field.onChange(Number(v))}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Сонгох" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRICE_LEVELS.map((p) => (
                        <SelectItem key={p.value} value={String(p.value)}>
                          {p.label} — {p.hint}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError message={errors.priceLevel?.message} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contacts */}
      <Card>
        <CardHeader>
          <CardTitle>Холбоо барих</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="phone">Утас</Label>
            <Input
              id="phone"
              inputMode="tel"
              placeholder="99112233"
              className="mt-1.5"
              {...register("phone")}
            />
            <FieldError message={errors.phone?.message} />
          </div>
          <div>
            <Label htmlFor="email">И-мэйл</Label>
            <Input
              id="email"
              type="email"
              placeholder="info@example.mn"
              className="mt-1.5"
              {...register("email")}
            />
            <FieldError message={errors.email?.message} />
          </div>
          <div>
            <Label htmlFor="website">Вэбсайт</Label>
            <Input
              id="website"
              type="url"
              placeholder="https://example.mn"
              className="mt-1.5"
              {...register("website")}
            />
            <FieldError message={errors.website?.message} />
          </div>
          <div>
            <Label htmlFor="facebookUrl">Facebook</Label>
            <Input
              id="facebookUrl"
              type="url"
              placeholder="https://facebook.com/..."
              className="mt-1.5"
              {...register("facebookUrl")}
            />
            <FieldError message={errors.facebookUrl?.message} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="instagramUrl">Instagram</Label>
            <Input
              id="instagramUrl"
              type="url"
              placeholder="https://instagram.com/..."
              className="mt-1.5"
              {...register("instagramUrl")}
            />
            <FieldError message={errors.instagramUrl?.message} />
          </div>
        </CardContent>
      </Card>

      {/* Location */}
      <Card>
        <CardHeader>
          <CardTitle>Байршил</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label htmlFor="addressText">Хаяг</Label>
            <Input
              id="addressText"
              className="mt-1.5"
              placeholder="Жнэ: СБД, 1-р хороо, Энх тайвны өргөн чөлөө 12"
              {...register("addressText")}
            />
            <FieldError message={errors.addressText?.message} />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label>Дүүрэг</Label>
              <Controller
                control={control}
                name="district"
                render={({ field }) => (
                  <Select
                    value={field.value ?? undefined}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Дүүрэг сонгох" />
                    </SelectTrigger>
                    <SelectContent>
                      {UB_DISTRICTS.map((d) => (
                        <SelectItem key={d.slug} value={d.nameMn}>
                          {d.nameMn}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError message={errors.district?.message} />
            </div>
            <div>
              <Label htmlFor="khoroo">Хороо</Label>
              <Input
                id="khoroo"
                className="mt-1.5"
                placeholder="Жнэ: 5"
                {...register("khoroo")}
              />
              <FieldError message={errors.khoroo?.message} />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="latitude">Өргөрөг (lat)</Label>
              <Input
                id="latitude"
                type="number"
                step="any"
                inputMode="decimal"
                placeholder="47.918"
                className="mt-1.5"
                {...register("latitude", {
                  setValueAs: (v) => (v === "" || v == null ? undefined : Number(v)),
                })}
              />
              <FieldError message={errors.latitude?.message} />
            </div>
            <div>
              <Label htmlFor="longitude">Уртраг (lng)</Label>
              <Input
                id="longitude"
                type="number"
                step="any"
                inputMode="decimal"
                placeholder="106.917"
                className="mt-1.5"
                {...register("longitude", {
                  setValueAs: (v) => (v === "" || v == null ? undefined : Number(v)),
                })}
              />
              <FieldError message={errors.longitude?.message} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hours editor (7 rows) */}
      <Card>
        <CardHeader>
          <CardTitle>Цагийн хуваарь</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 7 }).map((_, day) => (
            <Controller
              key={day}
              control={control}
              name={`hours.${day}` as const}
              render={({ field }) => {
                const row = (field.value ?? {
                  dayOfWeek: day,
                  openTime: "09:00",
                  closeTime: "18:00",
                  isClosed: false,
                }) as HourRow;
                return (
                  <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border px-3 py-2.5">
                    <span className="w-16 text-sm font-medium text-foreground">
                      {DAYS_MN[day]}
                    </span>
                    <div
                      className={cn(
                        "flex items-center gap-2",
                        row.isClosed && "pointer-events-none opacity-40",
                      )}
                    >
                      <Input
                        type="time"
                        aria-label={`${DAYS_MN[day]} нээх цаг`}
                        value={row.openTime ?? ""}
                        disabled={row.isClosed}
                        onChange={(e) =>
                          field.onChange({ ...row, openTime: e.target.value })
                        }
                        className="h-9 w-28"
                      />
                      <span className="text-muted-foreground">–</span>
                      <Input
                        type="time"
                        aria-label={`${DAYS_MN[day]} хаах цаг`}
                        value={row.closeTime ?? ""}
                        disabled={row.isClosed}
                        onChange={(e) =>
                          field.onChange({ ...row, closeTime: e.target.value })
                        }
                        className="h-9 w-28"
                      />
                    </div>
                    <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
                      Амарна
                      <Switch
                        checked={row.isClosed}
                        onCheckedChange={(checked) =>
                          field.onChange({ ...row, isClosed: checked })
                        }
                        aria-label={`${DAYS_MN[day]} амарна`}
                      />
                    </label>
                  </div>
                );
              }}
            />
          ))}
        </CardContent>
      </Card>

      {/* Sticky submit bar */}
      <div className="sticky bottom-4 z-10 flex items-center justify-end gap-3 rounded-2xl border border-border bg-card/95 px-4 py-3 shadow-card backdrop-blur">
        {isDirty && (
          <span className="mr-auto text-sm text-muted-foreground">
            Хадгалаагүй өөрчлөлт байна
          </span>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Хадгалах
        </Button>
      </div>
    </form>
  );
}
