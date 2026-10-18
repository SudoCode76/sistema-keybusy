import assert from "node:assert/strict"
import test from "node:test"

import { buildSalesTrendData } from "./sales-trends.ts"

test("acumula el mes por servicio y tipo de venta, omitiendo servicios sin ventas", () => {
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
      day: "2026-07-01",
      service_slug: "canva",
      service_name: "Canva",
      new_sales: "1",
      renewal_sales: null,
      total_sales: "1",
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

  assert.deepEqual(result, {
    services: [
      { slug: "spotify", name: "Spotify", total: 4 },
      { slug: "canva", name: "Canva", total: 1 },
    ],
    newSales: 3,
    renewalSales: 2,
  })
})

test("sin ventas no hay porciones", () => {
  assert.deepEqual(buildSalesTrendData([]), {
    services: [],
    newSales: 0,
    renewalSales: 0,
  })
})
