"use client";

import type { FloorMap, Space } from "@/types/space";
import type { MapDateSelection } from "@/types/reservation";
import { MapDateSelector } from "@/components/map-date/map-date-selector";

interface MapDateSelectorWrapperProps {
  maps: FloorMap[];
  spaces: Space[];
  defaultMapId?: string;
  initialDate?: string;
  showResourcePanel?: boolean;
  showCalendarLink?: boolean;
  readOnly?: boolean;
  compact?: boolean;
  onSelectionChange?: (selection: MapDateSelection) => void;
}

export function MapDateSelectorWrapper(props: MapDateSelectorWrapperProps) {
  return <MapDateSelector {...props} />;
}
