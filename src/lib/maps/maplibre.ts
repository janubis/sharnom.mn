/**
 * MapLibre GL JS implementation of MapProvider.
 *
 * Uses self-hosted OpenMapTiles vector tiles (NEXT_PUBLIC_MAP_STYLE_URL).
 * Pins are rendered as a clustered GeoJSON source so we never paint thousands
 * of DOM markers — the map stays smooth at city scale.
 *
 * `maplibre-gl` is imported dynamically so it only loads on the client when a
 * map is actually mounted (keeps initial JS small, satisfies "lazy load maps").
 */
import type {
  MapBounds,
  MapInitOptions,
  MapInstance,
  MapPin,
  MapProvider,
} from "./provider";

const SOURCE_ID = "businesses";
const CLUSTER_LAYER = "clusters";
const CLUSTER_COUNT_LAYER = "cluster-count";
const UNCLUSTERED_LAYER = "pin";

function pinsToGeoJSON(pins: MapPin[]) {
  return {
    type: "FeatureCollection" as const,
    features: pins.map((p) => ({
      type: "Feature" as const,
      properties: { ...p },
      geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
    })),
  };
}

function debounce<T extends (...args: never[]) => void>(fn: T, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export const maplibreProvider: MapProvider = {
  name: "maplibre",
  async create(options: MapInitOptions): Promise<MapInstance> {
    const maplibregl = (await import("maplibre-gl")).default;
    await import("maplibre-gl/dist/maplibre-gl.css");

    const map = new maplibregl.Map({
      container: options.container,
      style: options.styleUrl,
      center: [options.center.lng, options.center.lat],
      zoom: options.zoom,
      attributionControl: { compact: true },
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
      }),
      "top-right",
    );

    const popup = new maplibregl.Popup({
      closeButton: false,
      offset: 16,
      maxWidth: "280px",
    });

    const getBounds = (): MapBounds => {
      const b = map.getBounds();
      return { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() };
    };

    await new Promise<void>((resolve) => map.on("load", () => resolve()));

    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: pinsToGeoJSON([]),
      cluster: true,
      clusterMaxZoom: 15,
      clusterRadius: 48,
    });

    // Cluster bubbles — khadag blue scale.
    map.addLayer({
      id: CLUSTER_LAYER,
      type: "circle",
      source: SOURCE_ID,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": "#1366c2",
        "circle-opacity": 0.9,
        "circle-radius": ["step", ["get", "point_count"], 16, 10, 22, 50, 30],
        "circle-stroke-width": 3,
        "circle-stroke-color": "rgba(255,255,255,0.85)",
      },
    });
    map.addLayer({
      id: CLUSTER_COUNT_LAYER,
      type: "symbol",
      source: SOURCE_ID,
      filter: ["has", "point_count"],
      layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-size": 13,
      },
      paint: { "text-color": "#ffffff" },
    });
    map.addLayer({
      id: UNCLUSTERED_LAYER,
      type: "circle",
      source: SOURCE_ID,
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": ["case", ["get", "verified"], "#1366c2", "#d9483b"],
        "circle-radius": 8,
        "circle-stroke-width": 3,
        "circle-stroke-color": "#ffffff",
      },
    });

    // Expand clusters on click.
    map.on("click", CLUSTER_LAYER, (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: [CLUSTER_LAYER] });
      const clusterId = features[0]?.properties?.cluster_id;
      const src = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource;
      if (clusterId == null || !src) return;
      void src.getClusterExpansionZoom(clusterId).then((zoom) => {
        const geom = features[0]!.geometry as GeoJSON.Point;
        map.easeTo({ center: geom.coordinates as [number, number], zoom });
      });
    });

    // Individual pin → popup + callback.
    map.on("click", UNCLUSTERED_LAYER, (e) => {
      const f = e.features?.[0];
      if (!f) return;
      const p = f.properties as unknown as MapPin;
      const coords = (f.geometry as GeoJSON.Point).coordinates as [number, number];
      popup
        .setLngLat(coords)
        .setHTML(
          `<a href="/business/${p.slug}" class="block p-3">
             <div style="font-weight:600">${escapeHtml(String(p.name))}</div>
             <div style="font-size:12px;opacity:.7">★ ${p.rating ?? "—"} · ${p.reviewCount ?? 0} сэтгэгдэл</div>
           </a>`,
        )
        .addTo(map);
      options.onPinClick?.(p);
    });

    const setCursor = (cursor: string) => () => (map.getCanvas().style.cursor = cursor);
    map.on("mouseenter", CLUSTER_LAYER, setCursor("pointer"));
    map.on("mouseleave", CLUSTER_LAYER, setCursor(""));
    map.on("mouseenter", UNCLUSTERED_LAYER, setCursor("pointer"));
    map.on("mouseleave", UNCLUSTERED_LAYER, setCursor(""));

    if (options.onBoundsChange) {
      const emit = debounce(() => options.onBoundsChange!(getBounds(), map.getZoom()), 350);
      map.on("moveend", emit);
    }

    return {
      setPins(pins: MapPin[]) {
        const src = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
        src?.setData(pinsToGeoJSON(pins));
      },
      flyTo(center, zoom) {
        map.flyTo({ center: [center.lng, center.lat], zoom: zoom ?? map.getZoom() });
      },
      fitBounds(bounds, padding = 48) {
        map.fitBounds(
          [
            [bounds.west, bounds.south],
            [bounds.east, bounds.north],
          ],
          { padding },
        );
      },
      getBounds,
      highlightPin() {
        /* handled via hover state; reserved for list↔map sync */
      },
      resize() {
        map.resize();
      },
      destroy() {
        popup.remove();
        map.remove();
      },
    };
  },
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
