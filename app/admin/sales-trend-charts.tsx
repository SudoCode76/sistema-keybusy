"use client"

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

import { buildSalesTrendData, type SalesTrendRow } from "./sales-trends"

const SERVICE_COLORS = [
  "#38bdf8",
  "#4ade80",
  "#fb7185",
  "#fbbf24",
  "#a78bfa",
  "#22d3ee",
]

type Slice = {
  key: string
  label: string
  value: number
  color: string
}

function SalesPie({ label, slices }: { label: string; slices: Slice[] }) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0)

  if (total === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-xl border border-border/60 bg-muted/20 px-4 text-center text-sm text-muted-foreground" role="status">
        Todavía no hay datos para esta comparación.
      </div>
    )
  }

  return (
    <>
      <ChartContainer
        aria-label={label}
        className="h-[280px] w-full rounded-xl border border-border/60 bg-muted/20"
        config={{}}
        role="img"
      >
        <ResponsiveContainer
          width="100%"
          height="100%"
          initialDimension={{ width: 240, height: 280 }}
        >
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="label"
              outerRadius="82%"
              stroke="var(--card)"
              strokeWidth={2}
            >
              {slices.map((slice) => (
                <Cell fill={slice.color} key={slice.key} />
              ))}
            </Pie>
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
          </PieChart>
        </ResponsiveContainer>
      </ChartContainer>
      <ul className="grid gap-2 text-sm">
        {slices.map((slice) => (
          <li className="flex items-center gap-3" key={slice.key}>
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: slice.color }}
            />
            <span className="min-w-0 flex-1">{slice.label}</span>
            <span className="shrink-0 text-muted-foreground tabular-nums">
              {slice.value.toLocaleString("es-BO")} ·{" "}
              {((slice.value / total) * 100).toLocaleString("es-BO", {
                maximumFractionDigits: 1,
              })}{" "}
              %
            </span>
          </li>
        ))}
      </ul>
    </>
  )
}

export function SalesTrendCharts({ rows }: { rows: SalesTrendRow[] }) {
  const { services, newSales, renewalSales } = buildSalesTrendData(rows)
  const serviceSlices = services.map((service, index) => ({
    key: service.slug,
    label: service.name,
    value: service.total,
    color: SERVICE_COLORS[index % SERVICE_COLORS.length],
  }))
  const acquisitionSlices = [
    { key: "new", label: "Ventas nuevas", value: newSales, color: "#38bdf8" },
    {
      key: "renewal",
      label: "Renovaciones",
      value: renewalSales,
      color: "#f59e0b",
    },
  ]

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
          <CardDescription>
            Distribución acumulada del mes según el inicio del período.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <SalesPie
            label="Distribución de ventas por servicio este mes"
            slices={serviceSlices}
          />
        </CardContent>
      </Card>
      <Card className="overflow-hidden border-white/8 bg-card/90">
        <CardHeader>
          <CardTitle>Nuevos y renovaciones</CardTitle>
          <CardDescription>
            Distribución acumulada del mes según el inicio del período.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <SalesPie
            label="Distribución de ventas nuevas y renovaciones este mes"
            slices={acquisitionSlices}
          />
        </CardContent>
      </Card>
    </div>
  )
}

export function RenewalComparisonCharts({
  comparison,
}: {
  comparison: {
    renewedCount: number
    notRenewedCount: number
    newSalesCount: number
  } | null
}) {
  if (!comparison) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No se pudo cargar la comparación de renovaciones.
        </CardContent>
      </Card>
    )
  }

  const renewalSlices = [
    { key: "renewed", label: "Renovaron", value: comparison.renewedCount, color: "#f59e0b" },
    { key: "not-renewed", label: "Aún no renovaron", value: comparison.notRenewedCount, color: "#fb7185" },
  ]
  const replacementSlices = [
    renewalSlices[1],
    { key: "new", label: "Ventas nuevas", value: comparison.newSalesCount, color: "#38bdf8" },
  ]

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="overflow-hidden border-white/8 bg-card/90">
        <CardHeader>
          <CardTitle>Renovaron y aún no renovaron</CardTitle>
          <CardDescription>
            Accesos pagados que vencían este mes, hasta hoy.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <SalesPie label="Proporción de accesos vencidos que renovaron y que aún no renovaron" slices={renewalSlices} />
        </CardContent>
      </Card>
      <Card className="overflow-hidden border-white/8 bg-card/90">
        <CardHeader>
          <CardTitle>Sin renovar y ventas nuevas</CardTitle>
          <CardDescription>
            Comparación de cantidades del mes. Cada porcentaje usa solo la suma de estas dos categorías.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <SalesPie label="Proporción entre accesos sin renovar y ventas nuevas del mes" slices={replacementSlices} />
        </CardContent>
      </Card>
    </div>
  )
}
