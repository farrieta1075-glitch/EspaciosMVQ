"use client";

import * as React from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { readJsonResponse } from "@/lib/read-json-response";

type LogRow = {
  id: string;
  userId: string;
  userLabel: string;
  email: string | null;
  username: string | null;
  areaId: string;
  action: string;
  actionLabel: string;
  summary: string;
  path: string;
  createdAt: string;
};

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function displayUser(row: LogRow) {
  return row.username || row.email || row.userLabel || row.userId;
}

export function AdminLogsClient() {
  const [logs, setLogs] = React.useState<LogRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [days, setDays] = React.useState(30);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        days: String(days),
        limit: "300",
      });
      const response = await fetch(`/api/admin/logs?${params}`);
      const data = await readJsonResponse<{
        logs?: LogRow[];
        message?: string;
        error?: string;
      }>(response);
      if (!response.ok) {
        throw new Error(data.error ?? "No se pudieron cargar los logs");
      }
      setLogs(data.logs ?? []);
      if (data.message) setError(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void load();
  }, [days]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Últimos
          <select
            className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={7}>7 días</option>
            <option value={30}>30 días</option>
            <option value={90}>90 días</option>
          </select>
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Actualizar
        </Button>
        <p className="text-xs text-muted-foreground">
          Solo usuarios con rol General (sin administradores ni visualización).
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Fecha</th>
              <th className="px-3 py-2 font-medium">Usuario</th>
              <th className="px-3 py-2 font-medium">Acción</th>
              <th className="px-3 py-2 font-medium">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {loading && logs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                  Cargando…
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                  No hay registros en este periodo.
                </td>
              </tr>
            ) : (
              logs.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="whitespace-nowrap px-3 py-2 align-top text-muted-foreground">
                    {formatWhen(row.createdAt)}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="font-medium">{displayUser(row)}</div>
                    {row.email && row.username ? (
                      <div className="text-xs text-muted-foreground">{row.email}</div>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 align-top">
                    {row.actionLabel}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div>{row.summary}</div>
                    {row.path ? (
                      <div className="text-xs text-muted-foreground">{row.path}</div>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
