/**
 * Borra todas las filas de PushSubscriptions (útil tras rotar claves VAPID).
 * Uso: node --env-file=.env.local scripts/purge-push-subscriptions.mjs --confirm
 */
import { PrismaClient } from "@prisma/client";

const confirm = process.argv.includes("--confirm");
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.pushSubscription.count();
  console.log(`PushSubscriptions actuales: ${count}`);
  if (!confirm) {
    console.log("Dry-run. Añade --confirm para borrar.");
    return;
  }
  const result = await prisma.pushSubscription.deleteMany();
  console.log(`Eliminadas: ${result.count}. Cada dispositivo debe pulsar «Sincronizar dispositivo».`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
