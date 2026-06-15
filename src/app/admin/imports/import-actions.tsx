"use client";

/**
 * Import console actions — CSV upload, OSM import trigger and search reindex.
 * Each posts to its /api/admin/* endpoint, toasts the outcome and refreshes the
 * server-rendered job log below.
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  Loader2,
  FileSpreadsheet,
  Globe,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { adminApi } from "../_components/admin-fetch";

type ImportResult = {
  jobId?: string;
  totalRows?: number;
  inserted?: number;
  updated?: number;
  duplicates?: number;
  errors?: number;
};

const MAX_CSV_BYTES = 10 * 1024 * 1024; // 10MB

export function ImportActions() {
  const router = useRouter();
  const { toast } = useToast();

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [uploading, setUploading] = React.useState(false);

  const [osmArea, setOsmArea] = React.useState("ulaanbaatar");
  const [osmCategory, setOsmCategory] = React.useState("all");
  const [osmRunning, setOsmRunning] = React.useState(false);

  const [reindexing, setReindexing] = React.useState(false);

  function summarize(res: ImportResult): string {
    const parts: string[] = [];
    if (res.inserted != null) parts.push(`${res.inserted} нэмсэн`);
    if (res.updated != null) parts.push(`${res.updated} шинэчилсэн`);
    if (res.duplicates != null) parts.push(`${res.duplicates} давхардсан`);
    if (res.errors != null) parts.push(`${res.errors} алдаа`);
    return parts.join(" · ") || "Дууссан";
  }

  async function uploadCsv() {
    if (!file) return;
    if (file.size > MAX_CSV_BYTES) {
      toast({
        title: "Файл хэтэрхий том",
        description: "CSV файл 10MB-аас ихгүй байх ёстой.",
        variant: "destructive",
      });
      return;
    }
    try {
      setUploading(true);
      const text = await file.text();
      const res = await adminApi.post<ImportResult>("/api/admin/imports", {
        source: "csv",
        fileName: file.name,
        content: text,
      });
      toast({
        title: "Импорт дууслаа",
        description: summarize(res),
        variant: "success",
      });
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    } catch (e) {
      toast({
        title: "Импорт амжилтгүй",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  }

  async function runOsm() {
    try {
      setOsmRunning(true);
      const res = await adminApi.post<ImportResult>("/api/admin/imports", {
        source: "osm",
        area: osmArea,
        category: osmCategory === "all" ? undefined : osmCategory,
      });
      toast({
        title: "OSM импорт эхэллээ",
        description: res.jobId
          ? "Ажил дэвсгэрт ажиллаж байна. Доорх жагсаалтаас хянаарай."
          : summarize(res),
        variant: "success",
      });
      router.refresh();
    } catch (e) {
      toast({
        title: "OSM импорт амжилтгүй",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setOsmRunning(false);
    }
  }

  async function reindex() {
    try {
      setReindexing(true);
      await adminApi.post("/api/admin/reindex-search");
      toast({
        title: "Хайлтын индекс шинэчлэгдлээ",
        variant: "success",
      });
      router.refresh();
    } catch (e) {
      toast({
        title: "Индексжүүлэлт амжилтгүй",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setReindexing(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* CSV upload */}
      <Card className="flex flex-col p-5">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FileSpreadsheet className="size-5" />
          </span>
          <div>
            <h2 className="font-display text-base font-semibold text-foreground">
              CSV импорт
            </h2>
            <p className="text-xs text-muted-foreground">name, phone, lat, lng, ...</p>
          </div>
        </div>

        <label
          htmlFor="csv-file"
          className={cn(
            "mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center transition-colors hover:border-primary/50 hover:bg-muted/50",
            file && "border-primary/50 bg-primary/5",
          )}
        >
          {file ? (
            <>
              <CheckCircle2 className="size-6 text-success" />
              <span className="max-w-full truncate text-sm font-medium text-foreground">
                {file.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(0)} KB
              </span>
            </>
          ) : (
            <>
              <Upload className="size-6 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                CSV файл сонгох
              </span>
            </>
          )}
          <input
            id="csv-file"
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>

        <Button
          className="mt-4"
          disabled={!file || uploading}
          onClick={uploadCsv}
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
          Импортлох
        </Button>
      </Card>

      {/* OSM import */}
      <Card className="flex flex-col p-5">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-9 items-center justify-center rounded-xl bg-secondary/15 text-secondary-foreground">
            <Globe className="size-5" />
          </span>
          <div>
            <h2 className="font-display text-base font-semibold text-foreground">
              OpenStreetMap импорт
            </h2>
            <p className="text-xs text-muted-foreground">Нийтийн газрын зургийн өгөгдөл</p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="osm-area">Бүс нутаг</Label>
            <Select value={osmArea} onValueChange={setOsmArea}>
              <SelectTrigger id="osm-area">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ulaanbaatar">Улаанбаатар</SelectItem>
                <SelectItem value="darkhan">Дархан</SelectItem>
                <SelectItem value="erdenet">Эрдэнэт</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="osm-cat">Ангилал</Label>
            <Select value={osmCategory} onValueChange={setOsmCategory}>
              <SelectTrigger id="osm-cat">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Бүх ангилал</SelectItem>
                <SelectItem value="restaurant">Ресторан · кафе</SelectItem>
                <SelectItem value="shop">Дэлгүүр</SelectItem>
                <SelectItem value="health">Эрүүл мэнд</SelectItem>
                <SelectItem value="services">Үйлчилгээ</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          variant="secondary"
          className="mt-4"
          disabled={osmRunning}
          onClick={runOsm}
        >
          {osmRunning ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Globe className="size-4" />
          )}
          Импорт эхлүүлэх
        </Button>
      </Card>

      {/* Reindex */}
      <Card className="flex flex-col p-5">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-9 items-center justify-center rounded-xl bg-success/15 text-success">
            <RefreshCw className="size-5" />
          </span>
          <div>
            <h2 className="font-display text-base font-semibold text-foreground">
              Хайлтын индекс
            </h2>
            <p className="text-xs text-muted-foreground">Бүх бизнесийг дахин индексжүүлэх</p>
          </div>
        </div>

        <p className="mt-4 flex-1 text-sm text-muted-foreground">
          Импорт хийсний дараа эсвэл өгөгдөл их өөрчлөгдсөн үед хайлтын индексийг
          шинэчилнэ. Энэ нь нэр, ангилал, байршлын хайлтыг шинэ өгөгдөлтэй
          нийцүүлнэ.
        </p>

        <Button
          variant="outline"
          className="mt-4"
          disabled={reindexing}
          onClick={reindex}
        >
          {reindexing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          Дахин индексжүүлэх
        </Button>
      </Card>
    </div>
  );
}
