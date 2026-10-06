import "server-only";

export type BlobAccessMode = "public" | "private";

export type BlobAuthMode = "vercel_oidc" | "read_write_token" | "unconfigured";

export function getBlobAccessMode(): BlobAccessMode {
  const value = process.env.BLOB_ACCESS?.trim().toLowerCase();
  if (value === "public") return "public";
  return "private";
}

function normalizeBlobToken(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let token = raw.trim();
  if (
    (token.startsWith('"') && token.endsWith('"')) ||
    (token.startsWith("'") && token.endsWith("'"))
  ) {
    token = token.slice(1, -1).trim();
  }
  return token || undefined;
}

export function getBlobAuthDiagnostics(): {
  authMode: BlobAuthMode;
  onVercel: boolean;
  hasStoreId: boolean;
  hasToken: boolean;
} {
  const storeId = process.env.BLOB_STORE_ID?.trim();
  const token = normalizeBlobToken(process.env.BLOB_READ_WRITE_TOKEN);
  const onVercel = process.env.VERCEL === "1";

  let authMode: BlobAuthMode = "unconfigured";
  if (onVercel && storeId) {
    authMode = "vercel_oidc";
  } else if (token) {
    authMode = "read_write_token";
  } else if (storeId) {
    authMode = "vercel_oidc";
  }

  return {
    authMode,
    onVercel,
    hasStoreId: Boolean(storeId),
    hasToken: Boolean(token),
  };
}

/** Opciones de auth para @vercel/blob (OIDC en Vercel si hay store vinculado). */
export function getBlobRequestOptions(): {
  token?: string;
  storeId?: string;
} {
  const storeId = process.env.BLOB_STORE_ID?.trim();
  const token = normalizeBlobToken(process.env.BLOB_READ_WRITE_TOKEN);
  const onVercel = process.env.VERCEL === "1";

  if (onVercel && storeId) {
    return { storeId };
  }

  if (token) {
    return { token };
  }

  if (storeId) {
    return { storeId };
  }

  return {};
}

export function isBlobConfigured(): boolean {
  const opts = getBlobRequestOptions();
  return Boolean(opts.token || opts.storeId);
}
