"use client";

import dynamic from "next/dynamic";

export const SpaceMapViewer = dynamic(
  () =>
    import("@/components/map-date/space-map-viewer").then(
      (mod) => mod.SpaceMapViewer,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Cargando mapa...
      </div>
    ),
  },
);
