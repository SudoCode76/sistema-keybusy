"use client"

import dynamic from "next/dynamic"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { buildSalesTrendData, type SalesTrendRow } from "./sales-trends"
import type { ThreeSeries } from "./sales-trend-3d"

const SalesTrend3D = dynamic(
  () => import("./sales-trend-3d").then((module) => module.SalesTrend3D),
  {
    loading: () => <div className="h-[300px] animate-pulse rounded-xl bg-muted/40" />,
    ssr: false,
  }
)

const SERVICE_COLORS = [
  "#38bdf8",
  "#4ade80",
  "#fb7185",
  "#fbbf24",
  "#a78bfa",
  "#22d3ee",
]

const acquisitionSeries: ThreeSeries[] = [
  { key: "newSales", label: "Clientes nuevos", color: "#38bdf8" },
  { key: "renewalSales", label: "Renovaciones", color: "#f59e0b" },
]

function Legend({ series }: { series: ThreeSeries[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
      {series.map((item) => (
        <span className="flex items-center gap-2" key={item.key}>
          <span className="size-2.5 rounded-full shadow-[0_0_10px_currentColor]" style={{ color: item.color, backgroundColor: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  )
}

export function SalesTrendCharts({ rows }: { rows: SalesTrendRow[] }) {
  const { services, points } = buildSalesTrendData(rows)
  const serviceSeries = services.map((service, index) => ({
    key: service.key,
    label: service.name,
    color: SERVICE_COLORS[index % SERVICE_COLORS.length],
  }))

  if (!services.length) {
    return (
      <Card>
        <CardContent className="py-24 text-center text-sm text-muted-foreground">
          Todavía no hay ventas registradas este mes.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="overflow-hidden border-white/8 bg-card/90">
        <CardHeader>
          <CardTitle>Ventas por servicio</CardTitle>
          <CardDescription>Mapa 3D diario según el inicio del período.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <SalesTrend3D ariaLabel="Ventas diarias por servicio" points={points} series={serviceSeries} />
          <Legend series={serviceSeries} />
        </CardContent>
      </Card>
      <Card className="overflow-hidden border-white/8 bg-card/90">
        <CardHeader>
          <CardTitle>Nuevos y renovaciones</CardTitle>
          <CardDescription>Comparación 3D diaria de ambos tipos de venta.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <SalesTrend3D ariaLabel="Clientes nuevos y renovaciones por día" points={points} series={acquisitionSeries} />
          <Legend series={acquisitionSeries} />
        </CardContent>
      </Card>
    </div>
  )
}
