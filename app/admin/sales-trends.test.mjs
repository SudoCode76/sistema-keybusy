import assert from "node:assert/strict"
import test from "node:test"

import { buildSalesTrendData } from "./sales-trends.ts"

test("agrupa ventas diarias y omite servicios sin ventas", () => {
  const result = buildSalesTrendData([
    {
      day: "2026-07-01",
      service_slug: "spotify",
      service_name: "Spotify",
      new_sales: 2,
      renewal_sales: 1,
      total_sales: 3,
    },
    {
      day: "2026-07-01",
      service_slug: "netflix",
      service_name: "Netflix",
      new_sales: 0,
      renewal_sales: 0,
      total_sales: 0,
    },
    {
      day: "2026-07-02",
      service_slug: "spotify",
      service_name: "Spotify",
      new_sales: 0,
      renewal_sales: 1,
      total_sales: 1,
    },
  ])

  assert.deepEqual(
    result.services.map(({ slug }) => slug),
    ["spotify"]
  )
  assert.deepEqual(result.points, [
    {
      day: "2026-07-01",
      newSales: 2,
      renewalSales: 1,
      service_0: 3,
    },
    {
      day: "2026-07-02",
      newSales: 0,
      renewalSales: 1,
      service_0: 1,
    },
  ])
})
