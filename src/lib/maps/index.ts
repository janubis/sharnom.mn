/** Resolves the active map provider from env (client-safe). */
import { clientConfig } from "@/lib/env";
import { googleProvider } from "./google";
import { maplibreProvider } from "./maplibre";
import type { MapProvider } from "./provider";

export function getMapProvider(): MapProvider {
  return clientConfig.NEXT_PUBLIC_MAP_PROVIDER === "google"
    ? googleProvider
    : maplibreProvider;
}

export * from "./provider";
