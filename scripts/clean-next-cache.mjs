import { rmSync } from "node:fs";
import { join } from "node:path";

const target = join(process.cwd(), ".next");

try {
  rmSync(target, { recursive: true, force: true });
  console.log("Caché .next eliminada.");
} catch (error) {
  console.warn("No se pudo eliminar .next:", error);
}
