export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const sameOrigin =
      src.startsWith("/") ||
      (typeof window !== "undefined" && src.startsWith(window.location.origin));
    if (!sameOrigin) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
