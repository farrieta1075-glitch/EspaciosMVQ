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
  Loader2,
  MapPin,
  Package,
  Users,
} from "lucide-react";
import type { DashboardStats } from "@/lib/dashboard-metrics";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

interface AdminDashboardClientProps {
  initialStats: DashboardStats;
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export function AdminDashboardClient({ initialStats }: AdminDashboardClientProps) {
  const [stats, setStats] = React.useState(initialStats);
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function applyFilter(event?: React.FormEvent) {
    event?.preventDefault();
    setLoading(true);
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const query = params.toString();
    const response = await fetch(
      `/api/admin/dashboard/stats${query ? `?${query}` : ""}`,
    );
    setStats(await response.json());
    setLoading(false);
  }

  async function clearFilter() {
    setFrom("");
    setTo("");
    setLoading(true);
    const response = await fetch("/api/admin/dashboard/stats");
    setStats(await response.json());
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Filtro por periodo</CardTitle>
          <CardDescription>
            Limita las métricas de reservas por rango de fechas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={applyFilter}
            className="flex flex-col gap-4 sm:flex-row sm:items-end"
          >
            <div className="space-y-2">
              <Label htmlFor="statsFrom">Desde</Label>
              <Input
                id="statsFrom"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="statsTo">Hasta</Label>
              <Input
                id="statsTo"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={loading} className="gap-2">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Aplicar
              </Button>
              <Button type="button" variant="outline" onClick={clearFilter}>
                Limpiar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Reservas"
          value={stats.summary.totalReservations}
          description={`${stats.summary.confirmedReservations} confirmadas · ${stats.summary.cancelledReservations} canceladas`}
          icon={CalendarDays}
        />
        <SummaryCard
          title="Espacios activos"
          value={stats.summary.activeSpaces}
          description="Espacios disponibles para reservar"
          icon={MapPin}
        />
        <SummaryCard
          title="Recursos activos"
          value={stats.summary.activeResources}
          description="Recursos técnicos y consumibles"
          icon={Package}
        />
        <SummaryCard
          title="Usuarios"
          value={stats.summary.activeUsers}
          description={`${stats.summary.totalUsers} registrados en total`}
          icon={Users}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Reservas por espacio</CardTitle>
            <CardDescription>Top 10 espacios más reservados</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.reservationsBySpace.length === 0 ? (
              <EmptyChart message="Sin reservas en el periodo seleccionado." />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stats.reservationsBySpace} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip />
                  <Bar dataKey="count" name="Reservas" fill={CHART_COLORS[0]} radius={4} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reservas por área</CardTitle>
            <CardDescription>Distribución por área organizacional</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.reservationsByArea.length === 0 ? (
              <EmptyChart message="Sin reservas por área." />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={stats.reservationsByArea}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {stats.reservationsByArea.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Uso de recursos</CardTitle>
            <CardDescription>Cantidad reservada por recurso</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.resourceUsage.length === 0 ? (
              <EmptyChart message="Sin uso de recursos registrado." />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stats.resourceUsage}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={70} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="quantity" name="Cantidad" fill={CHART_COLORS[2]} radius={4} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reservas por usuario</CardTitle>
            <CardDescription>Top 10 usuarios con más reservas</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.reservationsByUser.length === 0 ? (
              <EmptyChart message="Sin reservas por usuario." />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stats.reservationsByUser}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={70} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="Reservas" fill={CHART_COLORS[4]} radius={4} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Eventos frecuentes</CardTitle>
            <CardDescription>Nombres de evento más utilizados</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.topEvents.length === 0 ? (
              <EmptyChart message="Sin eventos registrados." />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stats.topEvents} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip />
                  <Bar dataKey="count" name="Usos" fill={CHART_COLORS[5]} radius={4} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tendencia mensual</CardTitle>
            <CardDescription>Reservas confirmadas por mes</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.reservationsByMonth.length === 0 ? (
              <EmptyChart message="Sin datos mensuales." />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stats.reservationsByMonth}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="Reservas" fill={CHART_COLORS[1]} radius={4} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
