import assert from "node:assert/strict"
import test from "node:test"

import { accessStatus, matchingServiceSales } from "./duplicate-check.ts"

const accesses = [
  {
    id: "sale-1",
    serviceId: "chatgpt",
    serviceName: "ChatGPT Plus",
    productSlug: "chatgpt_private",
    productName: "ChatGPT privado",
    startsOn: "2026-07-01",
    endsOn: "2026-08-01",
    status: "active",
  },
  {
    id: "sale-2",
    serviceId: "chatgpt",
    serviceName: "ChatGPT Plus",
    productSlug: "chatgpt_business",
    productName: "ChatGPT Business",
    startsOn: "2026-06-01",
    endsOn: "2026-07-01",
    status: "expired",
  },
  {
    id: "sale-3",
    serviceId: "grok",
    serviceName: "Grok",
    productSlug: "grok_private",
    productName: "Grok privado",
    startsOn: "2026-07-01",
    endsOn: "2026-08-01",
    status: "active",
  },
]

test("detecta ventas por servicio y clasifica vigencia", () => {
  assert.deepEqual(
    matchingServiceSales(accesses, "chatgpt").map((sale) => sale.id),
    ["sale-1", "sale-2"]
  )
  assert.equal(accessStatus("2026-07-14", "2026-07-15"), "expired")
  assert.equal(accessStatus("2026-07-15", "2026-07-15"), "active")
})
