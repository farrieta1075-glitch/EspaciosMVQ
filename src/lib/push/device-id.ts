const DEVICE_ID_KEY = "mvqro_device_id";
const LAST_USER_ID_KEY = "mvqro_last_user_id";

function randomId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `dev_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = randomId();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export function rememberLastLoggedInUserId(userId: string): void {
  if (typeof window === "undefined" || !userId) return;
  localStorage.setItem(LAST_USER_ID_KEY, userId);
}

export function getLastLoggedInUserId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LAST_USER_ID_KEY);
}
