const STORAGE_KEY = "mvqro_reservation_create_batch_id";

export function getOrCreateReservationCreateBatchId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = sessionStorage.getItem(STORAGE_KEY)?.trim();
    if (!id) {
      id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `rbatch_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      sessionStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

export function clearReservationCreateBatchId(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
