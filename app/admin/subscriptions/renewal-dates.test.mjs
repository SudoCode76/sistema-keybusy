import assert from "node:assert/strict"
import test from "node:test"

import {
  addRenewalMonths,
  motherRenewalReminderCutoff,
  parseRenewalDate,
} from "./renewal-dates.ts"

test("valida fechas calendario de renovación", () => {
  assert.equal(parseRenewalDate("2026-02-28"), "2026-02-28")
  assert.equal(parseRenewalDate("2024-02-29"), "2024-02-29")
  assert.equal(parseRenewalDate("2026-02-29"), null)
  assert.equal(parseRenewalDate("2026-13-01"), null)
  assert.equal(parseRenewalDate("2026-1-01"), null)
})

test("calcula meses y conserva fechas de fin de mes", () => {
  assert.equal(addRenewalMonths("2026-01-31", 1), "2026-02-28")
  assert.equal(addRenewalMonths("2024-01-31", 1), "2024-02-29")
  assert.equal(addRenewalMonths("2026-08-15", 3), "2026-11-15")
})

test("calcula el límite del aviso de cuentas madre incluyendo cambios de mes y año", () => {
  assert.equal(motherRenewalReminderCutoff("2026-10-21"), "2026-10-23")
  assert.equal(motherRenewalReminderCutoff("2024-02-27"), "2024-02-29")
  assert.equal(motherRenewalReminderCutoff("2026-12-30"), "2027-01-01")
})
