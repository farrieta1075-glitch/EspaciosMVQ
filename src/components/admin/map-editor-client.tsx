"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { MapFloorSettings } from "@/components/admin/map-floor-settings";
import type { FloorMap, Space } from "@/types/space";

const SpaceMapEditor = dynamic(
  () =>
    import("@/components/admin/space-map-editor").then(
      (mod) => mod.SpaceMapEditor,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Cargando editor...
      </div>
    ),
  },
);

interface MapEditorClientProps {
  map: FloorMap;
  initialSpaces: Space[];
}

export function MapEditorClient({ map, initialSpaces }: MapEditorClientProps) {
  const [currentMap, setCurrentMap] = React.useState(map);
  return (
    <div className="space-y-4">
      <MapFloorSettings map={currentMap} onUpdated={setCurrentMap} />
      <SpaceMapEditor map={currentMap} initialSpaces={initialSpaces} />
    </div>
  );
}
