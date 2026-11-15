let pdfjsModulePromise: Promise<
  Awaited<typeof import("pdfjs-dist/legacy/build/pdf.mjs")>
> | null = null;

/** Límite para no reventar el canvas (planos CAD/PDF de alta resolución). */
const MAX_RENDER_EDGE = 2048;

async function getPdfJs() {
  if (typeof window === "undefined") {
    throw new Error("La renderización PDF solo está disponible en el navegador.");
  }

  if (!pdfjsModulePromise) {
    pdfjsModulePromise = import("pdfjs-dist/legacy/build/pdf.mjs").then(
      (pdfjs) => {
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/legacy/build/pdf.worker.min.mjs`;
        return pdfjs;
      },
    );
  }

  return pdfjsModulePromise;
}

async function pdfBytesFromSource(source: string | ArrayBuffer): Promise<Uint8Array> {
  if (typeof source !== "string") {
    return new Uint8Array(source);
  }

  const response = await fetch(source, {
    credentials: source.startsWith("/") ? "same-origin" : "omit",
  });
  if (!response.ok) {
    throw new Error(`No se pudo descargar el PDF (${response.status})`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

let renderQueue: Promise<unknown> = Promise.resolve();

export async function renderPdfFirstPage(source: string | ArrayBuffer): Promise<{
  dataUrl: string;
  width: number;
  height: number;
}> {
  const run = async () => {
    const pdfjs = await getPdfJs();
    const data = await pdfBytesFromSource(source);
    const pdf = await pdfjs.getDocument({
      data,
      disableAutoFetch: true,
      disableStream: true,
    }).promise;
    const page = await pdf.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(
      MAX_RENDER_EDGE / Math.max(baseViewport.width, 1),
      MAX_RENDER_EDGE / Math.max(baseViewport.height, 1),
      1.5,
    );
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("No se pudo crear el canvas");

    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));

    await page.render({ canvasContext: context, viewport, canvas }).promise;

    return {
      dataUrl: canvas.toDataURL("image/jpeg", 0.85),
      width: canvas.width,
      height: canvas.height,
    };
  };

  const result = renderQueue.then(run, run);
  renderQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}
