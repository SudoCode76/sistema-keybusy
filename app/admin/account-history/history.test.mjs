import assert from "node:assert/strict"
import test from "node:test"

import { filterHistoryRows } from "./history.ts"

const rows = [
  {
    id: "account:1",
    eventAt: "2026-08-15T10:00:00Z",
    platformSlug: "netflix",
    platformName: "Netflix",
    recordType: "service_account",
    recordTypeLabel: "Cuenta madre",
    accountLabel: "Netflix Bogotá",
    accountEmail: "netflix@example.com",
    customerName: null,
    memberEmail: null,
    startsOn: null,
    endsOn: null,
    status: "inactive",
    statusLabel: "Archivada",
    details: null,
  },
  {
    id: "member:1",
    eventAt: "2026-08-14T10:00:00Z",
    platformSlug: "spotify",
    platformName: "Spotify",
    recordType: "family_member",
    recordTypeLabel: "Miembro familiar",
    accountLabel: "Spotify2",
    accountEmail: "spotify2@example.com",
    customerName: "Carmelo",
    memberEmail: "carmelo@example.com",
    startsOn: "2026-07-01",
    endsOn: "2026-08-01",
    status: "removed",
    statusLabel: "Eliminado de Spotify",
    details: "Perfil familiar",
  },
]

test("filtra por plataforma y tipo de registro", () => {
  assert.equal(filterHistoryRows(rows, { query: "", platform: "spotify", type: "all", status: "all" }).length, 1)
  assert.equal(filterHistoryRows(rows, { query: "", platform: "all", type: "service_account", status: "all" }).length, 1)
})

test("busca por cliente, cuenta o correo del miembro", () => {
  assert.equal(filterHistoryRows(rows, { query: "carmelo", platform: "all", type: "all", status: "all" }).length, 1)
  assert.equal(filterHistoryRows(rows, { query: "netflix@example.com", platform: "all", type: "all", status: "all" }).length, 1)
  assert.equal(filterHistoryRows(rows, { query: "no existe", platform: "all", type: "all", status: "all" }).length, 0)
})

test("filtra estados históricos sin incluir activos", () => {
  assert.equal(filterHistoryRows(rows, { query: "", platform: "all", type: "all", status: "removed" }).length, 1)
  assert.equal(filterHistoryRows(rows, { query: "", platform: "all", type: "all", status: "inactive" }).length, 1)
})

test("filtra por rango de fecha del evento", () => {
  assert.equal(filterHistoryRows(rows, { query: "", platform: "all", type: "all", status: "all", dateFrom: "2026-08-15", dateTo: "2026-08-15" }).length, 1)
  assert.equal(filterHistoryRows(rows, { query: "", platform: "all", type: "all", status: "all", dateFrom: "2026-08-01", dateTo: "2026-08-10" }).length, 0)
})
