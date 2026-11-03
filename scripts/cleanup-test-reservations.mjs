/**
 * Elimina datos de prueba y conserva reservas activas de «Gratitud y Visión».
 *
 * Uso:
 *   node --env-file=.env.local scripts/cleanup-test-reservations.mjs --dry-run
 *   node --env-file=.env.local scripts/cleanup-test-reservations.mjs --confirm
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function normalizeEventName(name) {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function isKeepReservation(reservation) {
  if (reservation.status === "CANCELLED") return false;
  const n = normalizeEventName(reservation.eventName);
  return n.includes("gratitud") && n.includes("vision");
}

function parseArgs() {
  const dryRun = process.argv.includes("--dry-run");
  const confirm = process.argv.includes("--confirm");
  if (!dryRun && !confirm) {
    console.error(
      "Indica --dry-run (simular) o --confirm (ejecutar borrado).",
    );
    process.exit(1);
  }
  return { dryRun: dryRun || !confirm, confirm };
}

async function main() {
  const { dryRun } = parseArgs();
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("Falta DATABASE_URL (usa --env-file=.env.local).");
    process.exit(1);
  }

  const all = await prisma.reservation.findMany({
    select: { id: true, eventName: true, status: true, areaId: true },
  });

  const keep = all.filter(isKeepReservation);
  const keepIds = new Set(keep.map((r) => r.id));

  console.log(`Reservas totales: ${all.length}`);
  console.log(`Se conservan (${keep.length}):`);
  for (const r of keep) {
    console.log(`  · ${r.id} — ${r.eventName} [${r.status}]`);
  }
  console.log(`Se eliminarán: ${all.length - keep.length} reserva(s)`);

  if (keep.length === 0) {
    console.warn(
      "⚠ No se encontró ninguna reserva activa «Gratitud y Visión». Abortando.",
    );
    process.exit(1);
  }

  const deleteReservationIds = all
    .filter((r) => !keepIds.has(r.id))
    .map((r) => r.id);

  const allHistory = await prisma.eventHistory.findMany();
  const historyToDelete = allHistory.filter((row) => {
    const n = normalizeEventName(row.eventName);
    return !(n.includes("gratitud") && n.includes("vision"));
  });

  const notifications = await prisma.notification.findMany({
    select: { id: true, reservationId: true },
  });
  const notificationsToDelete = notifications.filter(
    (n) => !keepIds.has(n.reservationId?.trim() ?? ""),
  );

  const rrCount = await prisma.reservationResource.count({
    where: { reservationId: { in: deleteReservationIds } },
  });

  console.log("\nResumen de borrado:");
  console.log(`  ReservationResources: ${rrCount}`);
  console.log(`  Reservations: ${deleteReservationIds.length}`);
  console.log(`  EventHistory filas: ${historyToDelete.length}`);
  console.log(`  Notifications: ${notificationsToDelete.length}`);

  if (dryRun) {
    console.log("\n(dry-run) No se modificó la base de datos.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (deleteReservationIds.length > 0) {
      await tx.reservationResource.deleteMany({
        where: { reservationId: { in: deleteReservationIds } },
      });
      await tx.reservation.deleteMany({
        where: { id: { in: deleteReservationIds } },
      });
    }
    for (const row of historyToDelete) {
      await tx.eventHistory.delete({
        where: {
          eventName_areaId: {
            eventName: row.eventName,
            areaId: row.areaId,
          },
        },
      });
    }
    if (notificationsToDelete.length > 0) {
      await tx.notification.deleteMany({
        where: { id: { in: notificationsToDelete.map((n) => n.id) } },
      });
    }
  });

  console.log("\nLimpieza completada.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
