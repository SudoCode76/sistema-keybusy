import assert from "node:assert/strict"
import test from "node:test"

import { accountCostTotals, calendarDaysBetween } from "./chatgpt-account-history.ts"
import { boliviaDate } from "./date.ts"

test("repone la diferencia de fechas y suma cada cuenta completa", () => {
  assert.equal(calendarDaysBetween("2026-07-10", "2026-07-12"), 2)
  assert.deepEqual(accountCostTotals([
    { purchase_cost_bob: 70, purchase_cost_usdt: 10 },
    { purchase_cost_bob: 84, purchase_cost_usdt: 12 },
  ]), { bob: 154, usdt: 22 })
})

test("cuenta dias calendario con la fecha de Bolivia", () => {
  assert.equal(boliviaDate("2026-07-30T03:30:00.000Z"), "2026-07-29")
  assert.equal(calendarDaysBetween(boliviaDate("2026-07-30T03:30:00.000Z"), "2026-07-30"), 1)
})
