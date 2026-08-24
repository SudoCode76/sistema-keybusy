export type AccountHistoryRecordType =
  | "service_account"
  | "subscription"
  | "family_member"

export type AccountHistoryRow = {
  id: string
  eventAt: string | null
  platformSlug: string | null
  platformName: string
  recordType: AccountHistoryRecordType
  recordTypeLabel: string
  accountLabel: string
  accountEmail: string | null
  customerName: string | null
  memberEmail: string | null
  startsOn: string | null
  endsOn: string | null
  status: string
  statusLabel: string
  details: string | null
}

export type AccountHistoryFilters = {
  query: string
  platform: string
  type: string
  status: string
  dateFrom: string
  dateTo: string
}

export function historyStatusLabel(status: string, recordType: AccountHistoryRecordType) {
  if (recordType === "family_member") {
    if (status === "moved") return "Movido a otro plan"
    if (status === "available") return "Liberado de Spotify"
    return "Eliminado de Spotify"
  }
  if (status === "inactive") return "Archivada"
  if (status === "dead") return "Dada de baja"
  if (status === "replaced") return "Reemplazada"
  if (status === "canceled") return "Venta cancelada"
  return "Inactiva"
}

export function filterHistoryRows(
  rows: AccountHistoryRow[],
  filters: AccountHistoryFilters
) {
  const query = filters.query.trim().toLocaleLowerCase()

  return rows.filter((row) => {
    if (filters.platform !== "all" && row.platformSlug !== filters.platform) {
      return false
    }
    if (filters.type !== "all" && row.recordType !== filters.type) {
      return false
    }
    if (filters.status !== "all" && row.status !== filters.status) {
      return false
    }
    if (filters.dateFrom && (!row.eventAt || row.eventAt.slice(0, 10) < filters.dateFrom)) {
      return false
    }
    if (filters.dateTo && (!row.eventAt || row.eventAt.slice(0, 10) > filters.dateTo)) {
      return false
    }
    if (!query) return true

    return [
      row.platformName,
      row.accountLabel,
      row.accountEmail,
      row.customerName,
      row.memberEmail,
      row.details,
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase()
      .includes(query)
  })
}
