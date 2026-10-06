let pdfjsModulePromise: Promise<Awaited<typeof import("pdfjs-dist/legacy/build/pdf.mjs")>> | null =
  null;

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

export async function renderPdfFirstPage(source: string | ArrayBuffer): Promise<{
  dataUrl: string;
  width: number;
  height: number;
}> {
  const pdfjs = await getPdfJs();

  const loadingTask =
    typeof source === "string"
      ? pdfjs.getDocument({ url: source })
      : pdfjs.getDocument({ data: source });

  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1.5 });

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No se pudo crear el canvas");

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvasContext: context, viewport, canvas }).promise;

  return {
    dataUrl: canvas.toDataURL("image/jpeg", 0.92),
    width: viewport.width,
    height: viewport.height,
  };
}
