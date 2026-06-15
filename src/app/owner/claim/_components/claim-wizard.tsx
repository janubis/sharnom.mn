"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Loader2,
  Store,
  Check,
  ChevronLeft,
  ShieldCheck,
  UploadCloud,
  FileCheck2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type BizHit = {
  id: string;
  slug: string;
  name: string;
  district: string | null;
  verified: boolean;
};

type Method = "PHONE" | "EMAIL" | "DOCUMENT";

const METHODS: { value: Method; label: string; hint: string }[] = [
  { value: "PHONE", label: "Утсаар", hint: "Бүртгэлтэй утсаар баталгаажуулна" },
  { value: "EMAIL", label: "И-мэйлээр", hint: "Албан и-мэйлээр баталгаажуулна" },
  { value: "DOCUMENT", label: "Бичиг баримтаар", hint: "Гэрчилгээ, бичиг баримт хавсаргана" },
];

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif,application/pdf";
const MAX_BYTES = 8 * 1024 * 1024;

/** Fire-and-forget analytics ping. */
function track(event: string, extra?: Record<string, unknown>) {
  void fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, ...extra }),
    keepalive: true,
  }).catch(() => {});
}

/**
 * Three-step claim wizard:
 *  1) search & pick a business (autocomplete)
 *  2) submit an ownership request (method, phone, evidence, note)
 *  3) success — the parent page lists the resulting claim status.
 */
export function ClaimWizard() {
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<BizHit[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [selected, setSelected] = React.useState<{ id: string; name: string; slug: string } | null>(
    null,
  );

  const [method, setMethod] = React.useState<Method>("PHONE");
  const [contactPhone, setContactPhone] = React.useState("");
  const [note, setNote] = React.useState("");
  const [evidenceUrl, setEvidenceUrl] = React.useState<string | null>(null);
  const [evidenceName, setEvidenceName] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  // Debounced autocomplete search.
  React.useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(q)}&pageSize=8`,
          { signal: ctrl.signal },
        );
        const data = await res.json();
        if (data.ok) {
          const items = (data.data?.items ?? []) as Array<{
            id: string;
            slug: string;
            name: string;
            district: string | null;
            verified: boolean;
          }>;
          setResults(
            items.map((it) => ({
              id: it.id,
              slug: it.slug,
              name: it.name,
              district: it.district,
              verified: it.verified,
            })),
          );
        }
      } catch {
        /* aborted / ignore */
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  /** Select a business from the results and advance to the request form. */
  function pick(hit: BizHit) {
    setSelected({ id: hit.id, name: hit.name, slug: hit.slug });
    setStep(2);
    track("claim_started", { businessId: hit.id });
  }

  async function handleEvidence(files: FileList | null) {
    const file = files?.[0];
    if (!file || !selected) return;
    if (file.size > MAX_BYTES) {
      toast({
        variant: "destructive",
        title: "Файл хэт том байна",
        description: "8MB-аас бага байх ёстой.",
      });
      return;
    }
    setUploading(true);
    try {
      const presignRes = await fetch("/api/photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: "business",
          targetId: selected.id,
          fileName: file.name,
          contentType: file.type,
          size: file.size,
        }),
      });
      const presign = await presignRes.json();
      if (!presignRes.ok || !presign.ok) {
        throw new Error(presign.error ?? "Файл бэлтгэхэд алдаа гарлаа");
      }
      const { url, publicUrl } = presign.data as { url: string; publicUrl: string };
      const put = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!put.ok) throw new Error("Файл байршуулахад алдаа гарлаа");
      setEvidenceUrl(publicUrl);
      setEvidenceName(file.name);
      toast({ variant: "success", title: "Баримт хавсаргалаа" });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Алдаа гарлаа",
        description: (e as Error).message,
      });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function submit() {
    if (!selected) return;
    if (method === "PHONE" && contactPhone.trim().length < 6) {
      toast({
        variant: "destructive",
        title: "Утасны дугаар оруулна уу",
      });
      return;
    }
    if (method === "DOCUMENT" && !evidenceUrl) {
      toast({
        variant: "destructive",
        title: "Нотлох баримт хавсаргана уу",
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/businesses/${selected.id}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verificationMethod: method,
          contactPhone: contactPhone.trim() || undefined,
          evidenceUrl: evidenceUrl ?? undefined,
          note: note.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Хүсэлт илгээхэд алдаа гарлаа");
      }
      track("claim_submitted", { businessId: selected.id });
      setStep(3);
      toast({ variant: "success", title: "Эзэмших хүсэлт илгээгдлээ" });
      router.refresh();
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Алдаа гарлаа",
        description: (e as Error).message,
      });
    } finally {
      setSubmitting(false);
    }
  }

  function restart() {
    setStep(1);
    setQuery("");
    setResults([]);
    setSelected(null);
    setMethod("PHONE");
    setContactPhone("");
    setNote("");
    setEvidenceUrl(null);
    setEvidenceName(null);
  }

  return (
    <Card>
      <CardHeader>
        <Stepper step={step} />
      </CardHeader>
      <CardContent>
        {/* Step 1 — search */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="claim-search">Бизнесээ хайх</Label>
              <div className="relative mt-1.5">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="claim-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Бизнесийн нэр бичнэ үү..."
                  className="pl-9"
                  autoComplete="off"
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
              </div>
            </div>

            {query.trim().length >= 2 && (
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {results.length === 0 && !searching ? (
                  <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                    Илэрц олдсонгүй. Жагсаалтад байхгүй бол шинээр бүртгүүлэх боломжтой.
                  </li>
                ) : (
                  results.map((hit) => (
                    <li key={hit.id}>
                      <button
                        type="button"
                        onClick={() => pick(hit)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent"
                      >
                        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Store className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate font-medium text-foreground">
                              {hit.name}
                            </span>
                            {hit.verified && (
                              <ShieldCheck className="size-3.5 shrink-0 text-primary" />
                            )}
                          </span>
                          {hit.district && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {hit.district}
                            </span>
                          )}
                        </span>
                        <ChevronLeft className="size-4 shrink-0 rotate-180 text-muted-foreground" />
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        )}

        {/* Step 2 — request form */}
        {step === 2 && selected && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3">
              <span className="inline-flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Store className="size-5" />
              </span>
              <div className="min-w-0">
                <div className="truncate font-semibold text-foreground">{selected.name}</div>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={restart}
                >
                  Өөр бизнес сонгох
                </button>
              </div>
            </div>

            <fieldset>
              <legend className="text-sm font-medium text-foreground">
                Баталгаажуулах арга
              </legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {METHODS.map((m) => {
                  const active = method === m.value;
                  return (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setMethod(m.value)}
                      aria-pressed={active}
                      className={cn(
                        "flex flex-col gap-1 rounded-xl border p-3 text-left transition-colors",
                        active
                          ? "border-primary bg-primary/5 ring-1 ring-inset ring-primary/20"
                          : "border-border hover:bg-accent",
                      )}
                    >
                      <span className="flex items-center justify-between text-sm font-semibold text-foreground">
                        {m.label}
                        {active && <Check className="size-4 text-primary" />}
                      </span>
                      <span className="text-xs text-muted-foreground">{m.hint}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div>
              <Label htmlFor="claim-phone">
                Холбоо барих утас{method === "PHONE" && " *"}
              </Label>
              <Input
                id="claim-phone"
                inputMode="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="99112233"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label>
                Нотлох баримт{method === "DOCUMENT" && " *"}
              </Label>
              <div className="mt-1.5">
                <input
                  ref={fileRef}
                  type="file"
                  accept={ACCEPT}
                  className="hidden"
                  onChange={(e) => void handleEvidence(e.target.files)}
                />
                {evidenceUrl ? (
                  <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/5 px-4 py-3 text-sm">
                    <FileCheck2 className="size-5 text-success" />
                    <span className="min-w-0 flex-1 truncate text-foreground">
                      {evidenceName}
                    </span>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setEvidenceUrl(null);
                        setEvidenceName(null);
                      }}
                    >
                      Устгах
                    </button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                    className="w-full"
                  >
                    {uploading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <UploadCloud className="size-4" />
                    )}
                    Баримт хавсаргах
                  </Button>
                )}
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Зураг эсвэл PDF — 8MB хүртэл (гэрчилгээ, нэхэмжлэх г.м).
                </p>
              </div>
            </div>

            <div>
              <Label htmlFor="claim-note">Нэмэлт тайлбар</Label>
              <Textarea
                id="claim-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={2000}
                placeholder="Та энэ бизнестэй ямар холбоотой болохоо тайлбарлана уу"
                className="mt-1.5"
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <Button type="button" variant="ghost" onClick={restart}>
                <ChevronLeft className="size-4" />
                Буцах
              </Button>
              <Button type="button" disabled={submitting} onClick={() => void submit()}>
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ShieldCheck className="size-4" />
                )}
                Хүсэлт илгээх
              </Button>
            </div>
          </div>
        )}

        {/* Step 3 — success */}
        {step === 3 && (
          <div className="flex flex-col items-center py-8 text-center">
            <span className="mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-success/15 text-success ring-1 ring-inset ring-success/25">
              <Check className="size-7" />
            </span>
            <h3 className="font-display text-xl font-semibold tracking-tight text-foreground">
              Эзэмших хүсэлт илгээгдлээ
            </h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Таны хүсэлтийг манай баг хянаж, баталгаажуулсны дараа танд мэдэгдэх болно.
              Доорх жагсаалтаас хүсэлтийн төлөвийг хянах боломжтой.
            </p>
            <Button type="button" variant="outline" className="mt-6" onClick={restart}>
              Өөр бизнес эзэмших
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Compact 3-step progress indicator. */
function Stepper({ step }: { step: 1 | 2 | 3 }) {
  const steps = [
    { n: 1 as const, label: "Бизнес хайх" },
    { n: 2 as const, label: "Хүсэлт илгээх" },
    { n: 3 as const, label: "Дууссан" },
  ];
  return (
    <ol className="flex items-center gap-2">
      {steps.map((s, i) => {
          const done = step > s.n;
          const active = step === s.n;
          return (
            <li key={s.n} className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex size-7 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                  done && "bg-success text-success-foreground",
                  active && "bg-primary text-primary-foreground",
                  !done && !active && "bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3.5" /> : s.n}
              </span>
              <span
                className={cn(
                  "hidden text-sm font-medium sm:inline",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {s.label}
              </span>
              {i < steps.length - 1 && (
              <span className="mx-1 hidden h-px w-6 bg-border sm:inline-block" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
