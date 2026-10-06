/**
 * Lee el cuerpo de un fetch como JSON sin fallar con "Unexpected end of JSON input"
 * cuando la respuesta viene vacía (p. ej. timeout 504 en móvil o cold start).
 */
export async function readJsonResponse<T = Record<string, unknown>>(
  response: Response,
): Promise<T> {
  let text: string;
  try {
    text = await response.text();
  } catch {
    throw new Error(
      "No se pudo leer la respuesta del servidor. Revisa tu conexión e intenta de nuevo.",
    );
  }

  const trimmed = text.trim();
  if (!trimmed) {
    if (response.status === 504 || response.status === 502 || response.status === 503) {
      throw new Error(
        "El servidor tardó demasiado en responder. Espera unos segundos e intenta de nuevo.",
      );
    }
    if (!response.ok) {
      throw new Error(
        `Error del servidor (${response.status}). Intenta de nuevo.`,
      );
    }
    return {} as T;
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw new Error(
      "Respuesta inválida del servidor. Comprueba tu conexión e intenta de nuevo.",
    );
  }
}

export function isLikelyTransientFetchError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("tardó demasiado") ||
    message.includes("conexión") ||
    message.includes("respuesta inválida") ||
    message.includes("failed to fetch") ||
    message.includes("network")
  );
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
