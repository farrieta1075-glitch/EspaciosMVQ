"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CalendarDays,
  CalendarRange,
  Loader2,
  MapPin,
  Maximize2,
  Package,
  Users,
} from "lucide-react";
import type { DashboardStats } from "@/lib/dashboard-metrics";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const CHART_COLORS = [
  "#8B6914",
  "#A0826D",
  "#6B5344",
  "#C4A77D",
  "#9C7B4F",
  "#B8956A",
  "#7A6248",
  "#D4B896",
];

type ChartId =
  | "space"
  | "area"
  | "resource"
  | "user"
  | "events"
  | "month";

const CHART_META: Record<
  ChartId,
  { title: string; description: string; empty: string }
> = {
  space: {
    title: "Reservas por espacio",
    description: "Top 10 espacios más reservados",
    empty: "Sin reservas en el periodo seleccionado.",
  },
  area: {
    title: "Reservas por área",
    description: "Distribución por área organizacional",
    empty: "Sin reservas por área.",
  },
  resource: {
    title: "Uso de recursos",
    description: "Cantidad reservada por recurso",
    empty: "Sin uso de recursos registrado.",
  },
  user: {
    title: "Reservas por usuario",
    description: "Top 10 usuarios con más reservas",
    empty: "Sin reservas por usuario.",
  },
  events: {
    title: "Eventos frecuentes",
    description: "Nombres de evento más utilizados",
    empty: "Sin eventos registrados.",
  },
  month: {
    title: "Tendencia mensual",
    description: "Reservas confirmadas por mes",
    empty: "Sin datos mensuales.",
  },
};

interface AdminDashboardClientProps {
  initialStats: DashboardStats;
}

function formatPeriodLabel(from: string, to: string): string {
  if (from && to) return `${from} — ${to}`;
  if (from) return `Desde ${from}`;
  if (to) return `Hasta ${to}`;
  return "Todo el historial";
}

function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 py-3 pb-1">
        <CardTitle className="text-xs font-medium sm:text-sm">{title}</CardTitle>
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      </CardHeader>
      <CardContent className="px-4 pb-3 pt-0">
        <div className="text-xl font-bold sm:text-2xl">{value}</div>
        <p className="line-clamp-2 text-[11px] text-muted-foreground sm:text-xs">
          {description}
        </p>
      </CardContent>
    </Card>
  );
}

function chartHasData(stats: DashboardStats, id: ChartId): boolean {
  switch (id) {
    case "space":
      return stats.reservationsBySpace.length > 0;
    case "area":
      return stats.reservationsByArea.length > 0;
    case "resource":
      return stats.resourceUsage.length > 0;
    case "user":
      return stats.reservationsByUser.length > 0;
    case "events":
      return stats.topEvents.length > 0;
    case "month":
      return stats.reservationsByMonth.length > 0;
    default:
      return false;
  }
}

function DashboardChart({
  stats,
  id,
  height,
  compact,
}: {
  stats: DashboardStats;
  id: ChartId;
  height: number;
  compact?: boolean;
}) {
  const meta = CHART_META[id];
  if (!chartHasData(stats, id)) {
    return (
      <div
        className="flex items-center justify-center text-xs text-muted-foreground sm:text-sm"
        style={{ height }}
      >
        {meta.empty}
      </div>
    );
  }

  const tickSize = compact ? 9 : 12;
  const pieRadius = compact ? 42 : 90;

  switch (id) {
    case "space":
      return (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={stats.reservationsBySpace} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: tickSize }} />
            <YAxis
              type="category"
              dataKey="name"
              width={compact ? 72 : 100}
              tick={{ fontSize: tickSize }}
            />
            <Tooltip />
            <Bar
              dataKey="count"
              name="Reservas"
              fill={CHART_COLORS[0]}
              radius={4}
            />
          </BarChart>
        </ResponsiveContainer>
      );
    case "area":
      return (
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={stats.reservationsByArea}
              dataKey="count"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={pieRadius}
              label={compact ? false : ({ name, value }) => `${name}: ${value}`}
            >
              {stats.reservationsByArea.map((entry, index) => (
                <Cell
                  key={entry.name}
                  fill={CHART_COLORS[index % CHART_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip />
            {!compact && <Legend />}
          </PieChart>
        </ResponsiveContainer>
      );
    case "resource":
      return (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={stats.resourceUsage}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: tickSize }}
              interval={0}
              angle={compact ? -35 : -20}
              textAnchor="end"
              height={compact ? 52 : 70}
            />
            <YAxis allowDecimals={false} tick={{ fontSize: tickSize }} />
            <Tooltip />
            <Bar
              dataKey="quantity"
              name="Cantidad"
              fill={CHART_COLORS[2]}
              radius={4}
            />
          </BarChart>
        </ResponsiveContainer>
      );
    case "user":
      return (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={stats.reservationsByUser}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: tickSize }}
              interval={0}
              angle={compact ? -35 : -20}
              textAnchor="end"
              height={compact ? 52 : 70}
            />
            <YAxis allowDecimals={false} tick={{ fontSize: tickSize }} />
            <Tooltip />
            <Bar
              dataKey="count"
              name="Reservas"
              fill={CHART_COLORS[4]}
              radius={4}
            />
          </BarChart>
        </ResponsiveContainer>
      );
    case "events":
      return (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={stats.topEvents} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: tickSize }} />
            <YAxis
              type="category"
              dataKey="name"
              width={compact ? 88 : 120}
              tick={{ fontSize: tickSize }}
            />
            <Tooltip />
            <Bar dataKey="count" name="Usos" fill={CHART_COLORS[5]} radius={4} />
          </BarChart>
        </ResponsiveContainer>
      );
    case "month":
      return (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={stats.reservationsByMonth}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="month" tick={{ fontSize: tickSize }} />
            <YAxis allowDecimals={false} tick={{ fontSize: tickSize }} />
            <Tooltip />
            <Bar
              dataKey="count"
              name="Reservas"
              fill={CHART_COLORS[1]}
              radius={4}
            />
          </BarChart>
        </ResponsiveContainer>
      );
    default:
      return null;
  }
}

function ChartThumbnail({
  stats,
  id,
  onOpen,
}: {
  stats: DashboardStats;
  id: ChartId;
  onOpen: () => void;
}) {
  const meta = CHART_META[id];
  const hasData = chartHasData(stats, id);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group w-full rounded-lg border border-border bg-card text-left shadow-sm transition-colors",
        "hover:border-primary/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <div className="flex items-start justify-between gap-2 px-3 pt-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{meta.title}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {meta.description}
          </p>
        </div>
        <Maximize2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground opacity-60 group-hover:opacity-100" />
      </div>
      <div className="pointer-events-none px-1 pb-2 pt-1">
        {hasData ? (
          <DashboardChart stats={stats} id={id} height={112} compact />
        ) : (
          <div className="flex h-[112px] items-center justify-center px-3 text-center text-[11px] text-muted-foreground">
            {meta.empty}
          </div>
        )}
      </div>
    </button>
  );
}

const CHART_ORDER: ChartId[] = [
  "space",
  "area",
  "resource",
  "user",
  "events",
  "month",
];

export function AdminDashboardClient({ initialStats }: AdminDashboardClientProps) {
  const [stats, setStats] = React.useState(initialStats);
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [draftFrom, setDraftFrom] = React.useState("");
  const [draftTo, setDraftTo] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [activeChart, setActiveChart] = React.useState<ChartId | null>(null);

  async function fetchStats(nextFrom: string, nextTo: string) {
    setLoading(true);
    const params = new URLSearchParams();
    if (nextFrom) params.set("from", nextFrom);
    if (nextTo) params.set("to", nextTo);
    const query = params.toString();
    const response = await fetch(
      `/api/admin/dashboard/stats${query ? `?${query}` : ""}`,
    );
    setStats(await response.json());
    setLoading(false);
  }

  function openFilterDialog() {
    setDraftFrom(from);
    setDraftTo(to);
    setFilterOpen(true);
  }

  async function applyFilter(event?: React.FormEvent) {
    event?.preventDefault();
    setFrom(draftFrom);
    setTo(draftTo);
    setFilterOpen(false);
    await fetchStats(draftFrom, draftTo);
  }

  async function clearFilter() {
    setDraftFrom("");
    setDraftTo("");
    setFrom("");
    setTo("");
    setFilterOpen(false);
    await fetchStats("", "");
  }

  const periodLabel = formatPeriodLabel(from, to);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Métricas de reservas
          {from || to ? (
            <span className="text-foreground"> · {periodLabel}</span>
          ) : null}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={openFilterDialog}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CalendarRange className="h-4 w-4" />
          )}
          Periodo: {periodLabel}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard
          title="Reservas"
          value={stats.summary.totalReservations}
          description={`${stats.summary.confirmedReservations} confirmadas · ${stats.summary.cancelledReservations} canceladas`}
          icon={CalendarDays}
        />
        <SummaryCard
          title="Espacios activos"
          value={stats.summary.activeSpaces}
          description="Disponibles para reservar"
          icon={MapPin}
        />
        <SummaryCard
          title="Recursos activos"
          value={stats.summary.activeResources}
          description="Técnicos y consumibles"
          icon={Package}
        />
        <SummaryCard
          title="Usuarios"
          value={stats.summary.activeUsers}
          description={`${stats.summary.totalUsers} registrados`}
          icon={Users}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {CHART_ORDER.map((id) => (
          <ChartThumbnail
            key={id}
            stats={stats}
            id={id}
            onOpen={() => setActiveChart(id)}
          />
        ))}
      </div>

      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Filtro por periodo</DialogTitle>
            <DialogDescription>
              Limita las métricas de reservas al rango de fechas indicado.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={applyFilter} className="space-y-4 pt-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="statsFrom">Desde</Label>
                <Input
                  id="statsFrom"
                  type="date"
                  value={draftFrom}
                  onChange={(e) => setDraftFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="statsTo">Hasta</Label>
                <Input
                  id="statsTo"
                  type="date"
                  value={draftTo}
                  onChange={(e) => setDraftTo(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={clearFilter}>
                Limpiar
              </Button>
              <Button type="submit" disabled={loading} className="gap-2">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Aplicar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={activeChart !== null}
        onOpenChange={(open) => !open && setActiveChart(null)}
      >
        <DialogContent className="flex max-h-[min(90dvh,720px)] w-[min(96vw,42rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          {activeChart && (
            <>
              <DialogHeader className="shrink-0 border-b px-6 py-4 text-left">
                <DialogTitle>{CHART_META[activeChart].title}</DialogTitle>
                <DialogDescription>
                  {CHART_META[activeChart].description}
                </DialogDescription>
              </DialogHeader>
              <div className="min-h-0 flex-1 overflow-auto p-4">
                <DashboardChart
                  stats={stats}
                  id={activeChart}
                  height={360}
                />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
