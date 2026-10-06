import { notFound } from "next/navigation";
import { getMapById } from "@/lib/sheets/maps";
import { getSpacesByMapId } from "@/lib/sheets/spaces";
import { MapEditorClient } from "@/components/admin/map-editor-client";

export default async function MapEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const map = await getMapById(id);
  if (!map) notFound();

  const spaces = await getSpacesByMapId(id);

  return <MapEditorClient map={map} initialSpaces={spaces} />;
}
