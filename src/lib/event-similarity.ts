function normalizeEventName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function levenshtein(a: string, b: string): number {
  const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

export function eventNameSimilarity(a: string, b: string): number {
  const left = normalizeEventName(a);
  const right = normalizeEventName(b);
  if (!left || !right) return 0;
  if (left === right) return 1;

  const distance = levenshtein(left, right);
  const maxLen = Math.max(left.length, right.length);
  return 1 - distance / maxLen;
}

export function findSimilarEventNames(
  input: string,
  candidates: string[],
  threshold = 0.85,
): { eventName: string; similarity: number }[] {
  const normalizedInput = normalizeEventName(input);
  if (!normalizedInput) return [];

  return candidates
    .map((candidate) => ({
      eventName: candidate,
      similarity: eventNameSimilarity(normalizedInput, candidate),
    }))
    .filter(
      (item) =>
        item.similarity >= threshold &&
        normalizeEventName(item.eventName) !== normalizedInput,
    )
    .sort((a, b) => b.similarity - a.similarity);
}

export function normalizeForCompare(value: string): string {
  return normalizeEventName(value);
}
