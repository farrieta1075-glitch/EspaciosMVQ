/**
 * Genera docs/MVQro-Instalar-App.pdf desde docs/guia-instalacion-pwa.html
 * Uso: node scripts/generate-install-guide-pdf.mjs
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const htmlPath = path.join(root, "docs", "guia-instalacion-pwa.html");
const pdfPath = path.join(root, "docs", "MVQro-Instalar-App.pdf");

if (!fs.existsSync(htmlPath)) {
  console.error("No se encontró:", htmlPath);
  process.exit(1);
}

const htmlFileUrl = `file:///${htmlPath.replace(/\\/g, "/")}`;

function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: "inherit", shell: true });
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exit ${code}`)),
    );
  });
}

async function main() {
  const cacheDir = path.join(root, "node_modules", ".cache", "puppeteer-install-guide");
  fs.mkdirSync(cacheDir, { recursive: true });

  const genScript = `
import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.goto(${JSON.stringify(htmlFileUrl)}, { waitUntil: 'networkidle0' });
await page.pdf({
  path: ${JSON.stringify(pdfPath)},
  format: 'A4',
  printBackground: true,
  preferCSSPageSize: true,
  margin: { top: '0', right: '0', bottom: '0', left: '0' },
});
await browser.close();
console.log('PDF generado:', ${JSON.stringify(pdfPath)});
`;
  const genPath = path.join(cacheDir, "gen.mjs");
  fs.writeFileSync(genPath, genScript, "utf8");

  console.log("Instalando puppeteer (solo si hace falta)…");
  await run("npm", ["install", "--no-save", "puppeteer@24"], root);
  console.log("Generando PDF…");
  await run("node", [genPath], root);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
