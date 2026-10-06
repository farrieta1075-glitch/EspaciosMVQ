"use client";

import Image from "next/image";
import { resolveAssetUrl } from "@/lib/storage/resolve-asset-url";
import { cn } from "@/lib/utils";

interface AssetImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  sizes?: string;
  fill?: boolean;
  width?: number;
  height?: number;
}

/** Imagen de mapa/recurso; usa proxy /api/storage y evita el optimizador de Next. */
export function AssetImage({
  src,
  alt,
  className,
  sizes,
  fill,
  width,
  height,
}: AssetImageProps) {
  const resolved = resolveAssetUrl(src);
  if (!resolved) return null;

  return (
    <Image
      src={resolved}
      alt={alt}
      fill={fill}
      width={width}
      height={height}
      sizes={sizes}
      unoptimized
      className={cn(className)}
    />
  );
}
