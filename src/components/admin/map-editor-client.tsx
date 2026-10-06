"use client";

import dynamic from "next/dynamic";
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
  return <SpaceMapEditor map={map} initialSpaces={initialSpaces} />;
}
