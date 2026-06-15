"use client";

import * as React from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

export type GalleryPhoto = {
  url: string;
  caption?: string | null;
  /** Optional uploader / source attribution. */
  credit?: string | null;
};

export type PhotoGalleryProps = {
  photos: GalleryPhoto[];
  /** Cap the number of thumbnails before "+N" overlay (grid mode). */
  maxThumbnails?: number;
  className?: string;
};

/**
 * Responsive photo gallery with a lightbox. The grid shows a hero tile plus a
 * 2x2 cluster; clicking any tile opens a keyboard-navigable lightbox dialog.
 */
export function PhotoGallery({
  photos,
  maxThumbnails = 5,
  className,
}: PhotoGalleryProps) {
  const [open, setOpen] = React.useState(false);
  const [index, setIndex] = React.useState(0);

  const count = photos.length;
  const visible = photos.slice(0, maxThumbnails);
  const remaining = count - visible.length;

  const go = React.useCallback(
    (dir: 1 | -1) => {
      setIndex((i) => (i + dir + count) % count);
    },
    [count],
  );

  function openAt(i: number) {
    setIndex(i);
    setOpen(true);
  }

  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go]);

  if (count === 0) {
    return (
      <div
        className={cn(
          "felt-surface flex aspect-video w-full items-center justify-center rounded-2xl border border-border text-muted-foreground",
          className,
        )}
      >
        <ImageIcon className="mr-2 size-5" aria-hidden />
        Зураг алга байна
      </div>
    );
  }

  const active = photos[index] ?? photos[0];
  if (!active) return null;

  return (
    <>
      <div
        className={cn(
          "grid gap-2 overflow-hidden rounded-2xl",
          visible.length === 1
            ? "grid-cols-1"
            : "grid-cols-2 sm:grid-cols-4 sm:grid-rows-2",
          className,
        )}
      >
        {visible.map((p, i) => {
          const isHero = visible.length > 1 && i === 0;
          const isLast = i === visible.length - 1;
          return (
            <button
              key={`${p.url}-${i}`}
              type="button"
              onClick={() => openAt(i)}
              aria-label={p.caption ?? `Зураг ${i + 1}`}
              className={cn(
                "group relative overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isHero
                  ? "aspect-square sm:col-span-2 sm:row-span-2 sm:aspect-auto"
                  : "aspect-square",
              )}
            >
              <Image
                src={p.url}
                alt={p.caption ?? ""}
                fill
                sizes={isHero ? "(max-width:640px) 100vw, 50vw" : "25vw"}
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
              {isLast && remaining > 0 && (
                <span className="absolute inset-0 flex items-center justify-center bg-foreground/55 text-lg font-semibold text-background">
                  +{remaining}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl border-none bg-transparent p-0 shadow-none">
          <DialogTitle className="sr-only">
            {active?.caption ?? "Зураг"}
          </DialogTitle>
          <div className="relative flex aspect-[3/2] w-full items-center justify-center">
            <Image
              src={active.url}
              alt={active.caption ?? ""}
              fill
              sizes="100vw"
              className="rounded-xl object-contain"
              priority
            />
          </div>

          {count > 1 && (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Өмнөх зураг"
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-background/85 p-2 text-foreground shadow-card backdrop-blur transition hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Дараах зураг"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-background/85 p-2 text-foreground shadow-card backdrop-blur transition hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ChevronRight className="size-5" />
              </button>
            </>
          )}

          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 rounded-b-xl bg-foreground/55 px-4 py-2.5 text-sm text-background">
            <span className="truncate">{active.caption}</span>
            <span className="shrink-0 tabular-nums">
              {index + 1} / {count}
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
