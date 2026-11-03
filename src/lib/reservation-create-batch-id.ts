const STORAGE_KEY = "mvqro_reservation_create_batch_id";

export function newReservationCreateBatchId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `rbatch_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Id estable solo durante un envío (reintentos iOS/Android); no reutilizar entre reservas distintas. */
export function getOrCreateReservationCreateBatchId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = sessionStorage.getItem(STORAGE_KEY)?.trim();
    if (!id) {
      id = newReservationCreateBatchId();
      sessionStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

export function rememberReservationCreateBatchId(id: string): void {
  if (typeof window === "undefined") return;
  const trimmed = id.trim();
  if (!trimmed) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, trimmed);
  } catch {
    /* ignore */
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
