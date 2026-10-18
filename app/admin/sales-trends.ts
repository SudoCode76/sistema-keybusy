export type SalesTrendRow = {
  day: string
  service_slug: string
  service_name: string
  new_sales: number | string | null
  renewal_sales: number | string | null
  total_sales: number | string | null
}

export function buildSalesTrendData(rows: SalesTrendRow[]) {
  const totals = new Map<string, { name: string; total: number }>()
  let newSales = 0
  let renewalSales = 0

  for (const row of rows) {
    const current = totals.get(row.service_slug)
    totals.set(row.service_slug, {
      name: row.service_name,
      total: (current?.total ?? 0) + Number(row.total_sales ?? 0),
    })
    newSales += Number(row.new_sales ?? 0)
    renewalSales += Number(row.renewal_sales ?? 0)
  }

  const services = [...totals]
    .filter(([, service]) => service.total > 0)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([slug, service]) => ({
      slug,
      ...service,
    }))

  return {
    services,
    newSales,
    renewalSales,
  }
}
