export type SalesTrendRow = {
  day: string
  service_slug: string
  service_name: string
  new_sales: number | string | null
  renewal_sales: number | string | null
  total_sales: number | string | null
}

export type SalesTrendPoint = {
  day: string
  newSales: number
  renewalSales: number
  [key: string]: number | string
}

export function buildSalesTrendData(rows: SalesTrendRow[]) {
  const totals = new Map<string, { name: string; total: number }>()

  for (const row of rows) {
    const current = totals.get(row.service_slug)
    totals.set(row.service_slug, {
      name: row.service_name,
      total: (current?.total ?? 0) + Number(row.total_sales ?? 0),
    })
  }

  const services = [...totals]
    .filter(([, service]) => service.total > 0)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([slug, service], index) => ({
      key: `service_${index}`,
      slug,
      ...service,
    }))
  const keyBySlug = new Map(
    services.map((service) => [service.slug, service.key])
  )
  const points = new Map<string, SalesTrendPoint>()

  for (const row of rows) {
    const key = keyBySlug.get(row.service_slug)
    if (!key) continue

    const point = points.get(row.day) ?? {
      day: row.day,
      newSales: 0,
      renewalSales: 0,
    }
    point[key] = Number(row.total_sales ?? 0)
    point.newSales += Number(row.new_sales ?? 0)
    point.renewalSales += Number(row.renewal_sales ?? 0)
    points.set(row.day, point)
  }

  return {
    services,
    points: [...points.values()].sort((a, b) => a.day.localeCompare(b.day)),
  }
}
