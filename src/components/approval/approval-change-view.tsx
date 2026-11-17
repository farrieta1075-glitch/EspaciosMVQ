import type { ApprovalChangeSummary } from "@/lib/approval-change-summary";

export function ApprovalChangeView({
  summary,
}: {
  summary: ApprovalChangeSummary;
}) {
  if (summary.action === "CREATE") {
    return (
      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Recursos solicitados</h2>
        {summary.resources.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ninguno</p>
        ) : (
          <ul className="list-inside list-disc text-sm">
            {summary.resources.map((item) => (
              <li key={item.resourceId}>
                {item.resourceName} × {item.quantity}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (summary.action === "CANCEL") {
    return (
      <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
        <h2 className="text-sm font-semibold">Cancelación solicitada</h2>
        <p className="text-sm text-muted-foreground">
          Se solicita cancelar la reserva confirmada con los recursos actuales.
        </p>
        <ul className="list-inside list-disc text-sm">
          {summary.resources.map((item) => (
            <li key={item.resourceId}>
              {item.resourceName} × {item.quantity}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">Cambios solicitados</h2>
      <div className="space-y-2 sm:hidden">
        {summary.changes.map((change) => (
          <div
            key={change.label}
            className="rounded-lg border border-border bg-muted/20 p-3 text-sm"
          >
            <p className="font-medium">{change.label}</p>
            <p className="mt-1 text-muted-foreground">
              <span className="font-medium text-foreground/80">Actual: </span>
              {change.before}
            </p>
            <p className="text-foreground">
              <span className="font-medium">Solicitado: </span>
              {change.after}
            </p>
          </div>
        ))}
      </div>
      <div className="hidden overflow-x-auto rounded-lg border border-border sm:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-3 py-2 font-medium">Campo</th>
              <th className="px-3 py-2 font-medium">Actual</th>
              <th className="px-3 py-2 font-medium">Solicitado</th>
            </tr>
          </thead>
          <tbody>
            {summary.changes.map((change) => (
              <tr key={change.label} className="border-t border-border">
                <td className="px-3 py-2 font-medium">{change.label}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {change.before}
                </td>
                <td className="px-3 py-2">{change.after}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
