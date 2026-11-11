/**
 * Descarga mapas/recursos desde Vercel Blob y actualiza URLs en PostgreSQL a /uploads/...
 * Tras esto puedes quitar BLOB_* de Dokploy y montar volumen en public/uploads.
 *
 * Uso (con acceso a la BD y token Blob):
 *   node --env-file=.env.local scripts/migrate-blob-to-vps-uploads.mjs
 *   node --env-file=.env.local scripts/migrate-blob-to-vps-uploads.mjs --dry-run
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, join, basename } from "node:path";
import { get } from "@vercel/blob";
import { PrismaClient } from "@prisma/client";

const dryRun = process.argv.includes("--dry-run");

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvLocal();

function blobToken() {
  let t = process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1);
  }
  return t;
}

function pathnameFromStored(stored) {
  const value = stored.trim();
  if (!value) return null;
  if (value.startsWith("blob:")) return value.slice("blob:".length);
  if (value.startsWith("/uploads/")) return value.slice("/uploads/".length);
  if (value.startsWith("http")) {
    try {
      const { pathname } = new URL(value);
      const normalized = pathname.replace(/^\/+/, "");
      if (normalized.startsWith("maps/") || normalized.startsWith("resources/")) {
        return normalized;
      }
    } catch {
      return null;
    }
  }
  if (value.startsWith("maps/") || value.startsWith("resources/")) return value;
  return null;
}

async function downloadToUploads(pathname, token) {
  const folder = pathname.startsWith("maps/") ? "maps" : "resources";
  const filename = basename(pathname);
  const destDir = join(process.cwd(), "public", "uploads", folder);
  const destPath = join(destDir, filename);

  if (dryRun) {
    console.log(`[dry-run] bajaría ${pathname} → ${destPath}`);
    return `/uploads/${folder}/${filename}`;
  }

  const result = await get(pathname, { access: "private", token });
  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new Error(`Blob no encontrado: ${pathname}`);
  }

  const chunks = [];
  for await (const chunk of result.stream) {
    chunks.push(Buffer.from(chunk));
  }
  const buffer = Buffer.concat(chunks);

  mkdirSync(destDir, { recursive: true });
  writeFileSync(destPath, buffer);
  console.log(`OK ${pathname} → ${destPath} (${buffer.length} bytes)`);
  return `/uploads/${folder}/${filename}`;
}

async function migrateUrl(stored, token, cache) {
  if (!stored?.trim()) return stored;
  const pathname = pathnameFromStored(stored);
  if (!pathname) return stored;
  if (stored.startsWith("/uploads/")) {
    console.log(`ya local: ${stored}`);
    return stored;
  }
  if (cache.has(pathname)) return cache.get(pathname);
  const localUrl = await downloadToUploads(pathname, token);
  cache.set(pathname, localUrl);
  return localUrl;
}

async function main() {
  const token = blobToken();
  if (!token) {
    throw new Error("Falta BLOB_READ_WRITE_TOKEN (última vez antes de quitar Blob).");
  }

  const prisma = new PrismaClient();
  const cache = new Map();
  try {
    const maps = await prisma.floorMap.findMany();
    for (const map of maps) {
      const nextPrimary = await migrateUrl(map.backgroundUrl, token, cache);
      const nextSecondary = await migrateUrl(
        map.secondaryBackgroundUrl,
        token,
        cache,
      );
      if (
        nextPrimary !== map.backgroundUrl ||
        nextSecondary !== map.secondaryBackgroundUrl
      ) {
        if (!dryRun) {
          await prisma.floorMap.update({
            where: { id: map.id },
            data: {
              backgroundUrl: nextPrimary,
              secondaryBackgroundUrl: nextSecondary,
            },
          });
        }
        console.log(`Mapa ${map.id}: URLs actualizadas en BD`);
      }
    }

    const resources = await prisma.resource.findMany();
    for (const resource of resources) {
      const nextImage = await migrateUrl(resource.imageUrl, token, cache);
      if (nextImage !== resource.imageUrl) {
        if (!dryRun) {
          await prisma.resource.update({
            where: { id: resource.id },
            data: { imageUrl: nextImage },
          });
        }
        console.log(`Recurso ${resource.id}: imageUrl actualizada`);
      }
    }

    console.log(
      dryRun
        ? "Dry-run terminado."
        : "Listo. En Dokploy: volumen persistente en public/uploads y luego quita BLOB_*.",
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
