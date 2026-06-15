import { Clock } from "lucide-react";

import { cn } from "@/lib/utils";
import { DAYS_MN } from "@/lib/constants";

/**
 * Minimal hours shape compatible with the `BusinessHours` row
 * (db/schema). Time strings are "HH:MM" or "HH:MM:SS"; dayOfWeek is
 * 0=Sunday..6=Saturday.
 */
export type HoursEntry = {
  dayOfWeek: number;
  openTime: string | null;
  closeTime: string | null;
  isClosed?: boolean | null;
};

type Status = {
  open: boolean;
  /** Localized label for the upcoming change, e.g. "22:00 цагт хаана". */
  changeLabel: string | null;
};

/** Parse "HH:MM[:SS]" into minutes-from-midnight. */
function toMinutes(t: string | null | undefined): number | null {
  if (!t) return null;
  const [h, m] = t.split(":");
  const hh = Number(h);
  const mm = Number(m);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return hh * 60 + mm;
}

function hhmm(mins: number): string {
  const m = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/**
 * Compute open/closed at `now` from a week of hours. Handles overnight
 * intervals (close < open) and rolls over to the next open day.
 */
export function computeOpenStatus(
  hours: HoursEntry[],
  now: Date = new Date(),
): Status {
  if (!hours?.length) return { open: false, changeLabel: null };

  const byDay = new Map<number, HoursEntry>();
  for (const h of hours) byDay.set(h.dayOfWeek, h);

  const day = now.getDay();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  // Check today + previous day (for overnight spillover).
  for (const offset of [0, -1]) {
    const d = (day + offset + 7) % 7;
    const entry = byDay.get(d);
    if (!entry || entry.isClosed) continue;
    const open = toMinutes(entry.openTime);
    const close = toMinutes(entry.closeTime);
    if (open == null || close == null) continue;

    const overnight = close <= open;
    if (offset === 0 && !overnight) {
      if (nowMin >= open && nowMin < close) {
        return { open: true, changeLabel: `${hhmm(close)} цагт хаана` };
      }
    } else if (offset === 0 && overnight) {
      if (nowMin >= open) {
        return { open: true, changeLabel: `${hhmm(close)} цагт хаана` };
      }
    } else if (offset === -1 && overnight) {
      // Yesterday's overnight session may still be running this morning.
      if (nowMin < close) {
        return { open: true, changeLabel: `${hhmm(close)} цагт хаана` };
      }
    }
  }

  // Closed now — find the next opening within the next 7 days.
  for (let i = 0; i < 7; i++) {
    const d = (day + i) % 7;
    const entry = byDay.get(d);
    if (!entry || entry.isClosed) continue;
    const open = toMinutes(entry.openTime);
    if (open == null) continue;
    if (i === 0 && open <= nowMin) continue; // already passed today
    const prefix = i === 0 ? "" : i === 1 ? "маргааш " : `${DAYS_MN[d]} `;
    return { open: false, changeLabel: `${prefix}${hhmm(open)} цагт нээнэ` };
  }

  return { open: false, changeLabel: null };
}

export type OpenStatusProps = {
  hours: HoursEntry[];
  /** Override "now" — mainly for testing / SSR determinism. */
  now?: Date;
  /** Show the "… цагт хаана/нээнэ" hint after the status. */
  showNextChange?: boolean;
  /** Show the clock glyph. */
  showIcon?: boolean;
  className?: string;
};

/**
 * "Нээлттэй" / "Хаалттай" badge with an optional next-change hint.
 * Green when open, muted when closed.
 */
export function OpenStatus({
  hours,
  now,
  showNextChange = true,
  showIcon = true,
  className,
}: OpenStatusProps) {
  const { open, changeLabel } = computeOpenStatus(hours, now);

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm", className)}>
      {showIcon && (
        <Clock
          className={cn(
            "size-4 shrink-0",
            open ? "text-success" : "text-muted-foreground",
          )}
        />
      )}
      <span
        className={cn(
          "font-semibold",
          open ? "text-success" : "text-muted-foreground",
        )}
      >
        {open ? "Нээлттэй" : "Хаалттай"}
      </span>
      {showNextChange && changeLabel && (
        <span className="text-muted-foreground">· {changeLabel}</span>
      )}
    </span>
  );
}
