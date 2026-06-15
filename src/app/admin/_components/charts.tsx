"use client";

/**
 * Recharts wrappers for the admin dashboard & analytics pages. Kept in one
 * "use client" module so the whole file can be lazy-loaded via next/dynamic
 * (ssr:false) — Recharts is heavy and purely client-side.
 *
 * Colors come from the design tokens via CSS variables so charts stay on-brand
 * and theme-aware. We read the HSL channel triplets and wrap them in hsl().
 */
import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type {
  TrafficPoint,
  MapInteractionPoint,
} from "@/db/queries/admin-stats";

/* ── token helpers ─────────────────────────────────────────────────────────── */

function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v ? `hsl(${v})` : fallback;
}

function useTokens() {
  const [tokens, setTokens] = React.useState({
    primary: "hsl(210 88% 45%)",
    secondary: "hsl(38 70% 52%)",
    soyombo: "hsl(0 72% 48%)",
    success: "hsl(150 55% 40%)",
    muted: "hsl(30 8% 90%)",
    mutedFg: "hsl(30 6% 45%)",
    border: "hsl(30 12% 88%)",
    card: "hsl(40 30% 99%)",
    fg: "hsl(25 20% 14%)",
  });

  React.useEffect(() => {
    setTokens({
      primary: cssVar("--primary", "hsl(210 88% 45%)"),
      secondary: cssVar("--secondary", "hsl(38 70% 52%)"),
      soyombo: cssVar("--soyombo", "hsl(0 72% 48%)"),
      success: cssVar("--success", "hsl(150 55% 40%)"),
      muted: cssVar("--muted", "hsl(30 8% 90%)"),
      mutedFg: cssVar("--muted-foreground", "hsl(30 6% 45%)"),
      border: cssVar("--border", "hsl(30 12% 88%)"),
      card: cssVar("--card", "hsl(40 30% 99%)"),
      fg: cssVar("--foreground", "hsl(25 20% 14%)"),
    });
  }, []);

  return tokens;
}

/** Short Mongolian-style date label: "2026-06-14" → "06/14". */
function shortDate(iso: string): string {
  const parts = iso.split("-");
  if (parts.length === 3) return `${parts[1]}/${parts[2]}`;
  return iso;
}

function tooltipStyle(t: ReturnType<typeof useTokens>): React.CSSProperties {
  return {
    borderRadius: 12,
    border: `1px solid ${t.border}`,
    background: t.card,
    color: t.fg,
    fontSize: 12,
    boxShadow: "0 8px 40px rgba(28, 25, 23, 0.14)",
  };
}

const AXIS_FONT = 11;

/* ── Traffic (page views + searches) ───────────────────────────────────────── */

export function TrafficChart({ data }: { data: TrafficPoint[] }) {
  const t = useTokens();
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="g-views" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={t.primary} stopOpacity={0.28} />
            <stop offset="100%" stopColor={t.primary} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="g-search" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={t.secondary} stopOpacity={0.28} />
            <stop offset="100%" stopColor={t.secondary} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={shortDate}
          tick={{ fill: t.mutedFg, fontSize: AXIS_FONT }}
          tickLine={false}
          axisLine={{ stroke: t.border }}
          minTickGap={24}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: t.mutedFg, fontSize: AXIS_FONT }}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <Tooltip
          contentStyle={tooltipStyle(t)}
          labelFormatter={(l) => String(l)}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: t.mutedFg }} iconType="circle" />
        <Area
          type="monotone"
          dataKey="pageViews"
          name="Хандалт"
          stroke={t.primary}
          strokeWidth={2}
          fill="url(#g-views)"
        />
        <Area
          type="monotone"
          dataKey="searches"
          name="Хайлт"
          stroke={t.secondary}
          strokeWidth={2}
          fill="url(#g-search)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ── Map interactions (pin / direction / phone) ────────────────────────────── */

export function MapInteractionChart({ data }: { data: MapInteractionPoint[] }) {
  const t = useTokens();
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={shortDate}
          tick={{ fill: t.mutedFg, fontSize: AXIS_FONT }}
          tickLine={false}
          axisLine={{ stroke: t.border }}
          minTickGap={24}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: t.mutedFg, fontSize: AXIS_FONT }}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <Tooltip contentStyle={tooltipStyle(t)} />
        <Legend wrapperStyle={{ fontSize: 12, color: t.mutedFg }} iconType="circle" />
        <Line
          type="monotone"
          dataKey="pinClicks"
          name="Пин дарсан"
          stroke={t.primary}
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="directionClicks"
          name="Чиглэл"
          stroke={t.success}
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="phoneClicks"
          name="Утас"
          stroke={t.secondary}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ── Generic horizontal bar chart (top categories / districts) ─────────────── */

export type BarDatum = { label: string; value: number };

export function HorizontalBarChart({
  data,
  tone = "primary",
  height = 320,
}: {
  data: BarDatum[];
  tone?: "primary" | "secondary" | "success";
  height?: number;
}) {
  const t = useTokens();
  const color = tone === "secondary" ? t.secondary : tone === "success" ? t.success : t.primary;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
        barCategoryGap={6}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={t.border} horizontal={false} />
        <XAxis
          type="number"
          allowDecimals={false}
          tick={{ fill: t.mutedFg, fontSize: AXIS_FONT }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          width={120}
          tick={{ fill: t.fg, fontSize: AXIS_FONT }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip cursor={{ fill: t.muted, opacity: 0.4 }} contentStyle={tooltipStyle(t)} />
        <Bar dataKey="value" name="Тоо" radius={[0, 6, 6, 0]} fill={color}>
          {data.map((_, i) => (
            <Cell key={i} fill={color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
