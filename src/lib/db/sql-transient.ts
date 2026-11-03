import "server-only";

const TRANSIENT_CODE_FRAGMENTS = [
  "40613",
  "40197",
  "40501",
  "40540",
  "40544",
  "49918",
  "49919",
  "49920",
  "P1001",
  "P1002",
  "P1008",
  "P1017",
  "P2024",
];

const TRANSIENT_MESSAGE = /timeout|timed out|not currently available|database.*paused|connection.?lost|ECONNRESET|ETIMEDOUT|socket hang up|pre-login handshake|service is busy|temporarily unavailable/i;

export function isTransientDbError(error: unknown): boolean {
  if (!error) return false;
  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : String(error);
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
      ? (error as { code: string }).code
      : "";

  if (code && TRANSIENT_CODE_FRAGMENTS.some((part) => code.includes(part))) {
    return true;
  }
  if (TRANSIENT_CODE_FRAGMENTS.some((part) => message.includes(part))) {
    return true;
  }
  return TRANSIENT_MESSAGE.test(message);
}

export function isStaleConnectionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /P1017|P1001|connection.?closed|connection.?lost|ECONNRESET/i.test(
    message,
  );
}

export async function withDbRetry<T>(
  fn: () => Promise<T>,
  options?: {
    maxAttempts?: number;
    onRetry?: (attempt: number, error: unknown) => void | Promise<void>;
  },
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? 5;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !isTransientDbError(error)) {
        throw error;
      }
      await options?.onRetry?.(attempt, error);
      const pauseWakeMs = attempt === 1 ? 2500 : 0;
      const backoffMs = 600 * attempt;
      await new Promise((resolve) => setTimeout(resolve, pauseWakeMs + backoffMs));
    }
  }

  throw lastError;
}
