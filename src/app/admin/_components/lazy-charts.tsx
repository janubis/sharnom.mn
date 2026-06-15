"use client";

/**
 * next/dynamic wrappers (ssr:false) for the Recharts components. Recharts is a
 * large client-only dependency, so we keep it out of the server bundle and show
 * a shimmer skeleton while it loads.
 */
import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

const ChartSkeleton = ({ height = 280 }: { height?: number }) => (
  <Skeleton className="w-full rounded-xl" style={{ height }} />
);

export const TrafficChart = dynamic(
  () => import("./charts").then((m) => m.TrafficChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

export const MapInteractionChart = dynamic(
  () => import("./charts").then((m) => m.MapInteractionChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

export const HorizontalBarChart = dynamic(
  () => import("./charts").then((m) => m.HorizontalBarChart),
  { ssr: false, loading: () => <ChartSkeleton height={320} /> },
);
