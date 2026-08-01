"use client"

import Image from "next/image"
import { PackageIcon } from "lucide-react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

import { buildSalesTrendData, type SalesTrendRow } from "./sales-trends"

const SERVICE_STYLES = [
  { color: "oklch(0.55 0.18 250)", dash: undefined },
  { color: "oklch(0.62 0.16 145)", dash: "7 4" },
  { color: "oklch(0.6 0.2 330)", dash: "2 3" },
  { color: "oklch(0.68 0.16 65)", dash: "10 4 2 4" },
  { color: "oklch(0.59 0.15 200)", dash: "10 3" },
  { color: "oklch(0.6 0.18 25)", dash: "1 3" },
]

const BRAND_ASSETS: Record<string, string> = {
  canva: "/brands/canva.ico",
  "chatgpt-private": "/brands/openai.svg",
  "chatgpt-shared": "/brands/openai.svg",
  disney: "/brands/disney-plus.ico",
  netflix: "/brands/netflix.ico",
  spotify: "/brands/spotify.png",
  "super-grok": "/brands/xai.ico",
}

const acquisitionConfig = {
  newSales: {
    label: "Clientes nuevos",
    color: "oklch(0.55 0.18 250)",
  },
  renewalSales: {
    label: "Renovaciones",
    color: "oklch(0.68 0.16 65)",
  },
} satisfies ChartConfig

function shortDate(value: string) {
  return value.slice(8, 10)
}

function longDate(value: string) {
  return new Intl.DateTimeFormat("es-BO", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`))
}

function ServiceLogo({ slug }: { slug: string }) {
  const src = BRAND_ASSETS[slug]

  return src ? (
    <Image
      src={src}
      alt=""
      aria-hidden="true"
      width={18}
      height={18}
      unoptimized
    />
  ) : (
    <PackageIcon aria-hidden="true" className="size-[18px]" />
  )
}

export function SalesTrendCharts({ rows }: { rows: SalesTrendRow[] }) {
  const { services, points } = buildSalesTrendData(rows)
  const serviceConfig = Object.fromEntries(
    services.map((service, index) => [
      service.key,
      {
        label: service.name,
        color: SERVICE_STYLES[index % SERVICE_STYLES.length].color,
      },
    ])
  ) satisfies ChartConfig
  const hasSales = services.length > 0

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Ventas por servicio</CardTitle>
          <CardDescription>
            Cantidad diaria según el inicio del período durante el mes actual.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {hasSales ? (
            <>
              <ChartContainer
                config={serviceConfig}
                className="aspect-auto h-[290px] w-full"
              >
                <LineChart
                  accessibilityLayer
                  responsive
                  width="100%"
                  height="100%"
                  data={points}
                  margin={{ left: -20, right: 12 }}
                  style={{ width: "100%", height: "100%" }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="day"
                    tickLine={false}
                    axisLine={false}
                    minTickGap={24}
                    tickFormatter={shortDate}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        indicator="line"
                        labelFormatter={(value) => longDate(String(value))}
                      />
                    }
                  />
                  {services.map((service, index) => {
                    const style = SERVICE_STYLES[index % SERVICE_STYLES.length]

                    return (
                      <Line
                        key={service.key}
                        type="monotone"
                        dataKey={service.key}
                        stroke={`var(--color-${service.key})`}
                        strokeWidth={2}
                        strokeDasharray={style.dash}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    )
                  })}
                </LineChart>
              </ChartContainer>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                {services.map((service, index) => {
                  const style = SERVICE_STYLES[index % SERVICE_STYLES.length]

                  return (
                    <div key={service.slug} className="flex items-center gap-2">
                      <ServiceLogo slug={service.slug} />
                      <svg
                        aria-hidden="true"
                        className="h-2 w-5 shrink-0"
                        viewBox="0 0 20 8"
                      >
                        <line
                          x1="0"
                          x2="20"
                          y1="4"
                          y2="4"
                          stroke={style.color}
                          strokeDasharray={style.dash}
                          strokeWidth="2"
                        />
                      </svg>
                      <span>{service.name}</span>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <p className="py-24 text-center text-sm text-muted-foreground">
              Todavía no hay ventas registradas este mes.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Nuevos y renovaciones</CardTitle>
          <CardDescription>
            Comparación diaria según el inicio de cada período.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasSales ? (
            <ChartContainer
              config={acquisitionConfig}
              className="aspect-auto h-[330px] w-full"
            >
              <LineChart
                accessibilityLayer
                responsive
                width="100%"
                height="100%"
                data={points}
                margin={{ left: -20, right: 12, bottom: 22 }}
                style={{ width: "100%", height: "100%" }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                  tickFormatter={shortDate}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      indicator="line"
                      labelFormatter={(value) => longDate(String(value))}
                    />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Line
                  type="monotone"
                  dataKey="newSales"
                  stroke="var(--color-newSales)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="renewalSales"
                  stroke="var(--color-renewalSales)"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ChartContainer>
          ) : (
            <p className="py-24 text-center text-sm text-muted-foreground">
              Todavía no hay ventas registradas este mes.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
