import assert from "node:assert/strict"
import test from "node:test"

import {
  motherAccessIssueOn,
  nextRenewalSuggestion,
  renewalOverdue,
} from "./mother-access.ts"

const activeSale = {
  accessIssueOn: null,
  accessRestoredOn: null,
  createdAt: "2026-06-01T12:00:00Z",
  endsOn: "2026-08-31",
  renewalDueOn: "2026-07-15",
  serviceSlug: "spotify",
  status: "active",
  today: "2026-07-18",
}

test("calcula y resuelve incidencias de cuentas madre", () => {
  assert.equal(renewalOverdue("spotify", "2026-07-18", "2026-07-18"), false)
  assert.equal(renewalOverdue("netflix", "2026-07-17", "2026-07-18"), true)
  assert.equal(motherAccessIssueOn(activeSale), "2026-07-15")
  assert.equal(
    motherAccessIssueOn({ ...activeSale, accessRestoredOn: "2026-07-18" }),
    null
  )
  assert.equal(
    motherAccessIssueOn({ ...activeSale, createdAt: "2026-07-16T12:00:00Z" }),
    null
  )
  assert.equal(
    motherAccessIssueOn({ ...activeSale, status: "canceled" }),
    null
  )
  assert.equal(nextRenewalSuggestion("2026-01-31", "2026-01-10"), "2026-02-28")
  assert.equal(nextRenewalSuggestion("2026-07-15", "2026-07-18"), "2026-08-18")
})
