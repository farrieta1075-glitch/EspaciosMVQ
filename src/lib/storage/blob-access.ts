import "server-only";

export type BlobAccessMode = "public" | "private";

export function getBlobAccessMode(): BlobAccessMode {
  const value = process.env.BLOB_ACCESS?.trim().toLowerCase();
  if (value === "public") return "public";
  return "private";
}
