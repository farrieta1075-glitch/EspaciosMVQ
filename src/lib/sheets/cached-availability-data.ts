import "server-only";
import { unstable_cache } from "next/cache";
import { getActiveReservations, getAllReservationResources } from "@/lib/sheets/reservations";
import { getAllResources } from "@/lib/sheets/resources";

const REVALIDATE_SECONDS = 25;

export async function getCachedAvailabilityData() {
  return unstable_cache(
    async () => {
      const [reservations, reservationResources, resources] = await Promise.all([
        getActiveReservations(),
        getAllReservationResources(),
        getAllResources(),
      ]);
      return { reservations, reservationResources, resources };
    },
    ["mvqro-availability-data-v1"],
    { revalidate: REVALIDATE_SECONDS, tags: ["availability-data"] },
  )();
}
