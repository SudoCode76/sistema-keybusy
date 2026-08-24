import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDate } from "@/lib/date"
import { requireAdmin } from "@/lib/auth"

import { getAccountHistory } from "./data"
import { HistoryFilters } from "./history-filters"
import type { AccountHistoryFilters, AccountHistoryRow } from "./history"

function queryValue(value: string | undefined) {
  return value?.trim() ?? ""
}

function RecordTypeBadge({ row }: { row: AccountHistoryRow }) {
  return <Badge variant="outline">{row.recordTypeLabel}</Badge>
}

function StatusBadge({ row }: { row: AccountHistoryRow }) {
  return (
    <Badge variant={row.status === "removed" || row.status === "dead" ? "destructive" : "secondary"}>
      {row.statusLabel}
    </Badge>
  )
}

function HistoryRow({ row }: { row: AccountHistoryRow }) {
  return (
    <tr className="border-b last:border-0">
      <td className="p-3 align-top text-sm">{formatDate(row.eventAt)}</td>
      <td className="p-3 align-top">
        <div className="font-medium">{row.platformName}</div>
        <div className="text-xs text-muted-foreground">
          {row.recordType === "family_member" ? "Plan familiar" : "Cuenta"}: {row.accountLabel}
        </div>
        {row.accountEmail ? <div className="break-all text-xs text-muted-foreground">Correo madre: {row.accountEmail}</div> : null}
      </td>
      <td className="p-3 align-top"><RecordTypeBadge row={row} /></td>
      <td className="p-3 align-top">
        <div className="font-medium">{row.customerName ?? "Sin cliente"}</div>
        {row.memberEmail ? <div className="break-all text-xs text-muted-foreground">{row.memberEmail}</div> : null}
        {row.details ? <div className="text-xs text-muted-foreground">{row.details}</div> : null}
      </td>
      <td className="p-3 align-top text-sm">
        <div>{formatDate(row.startsOn)} — {formatDate(row.endsOn)}</div>
      </td>
      <td className="p-3 align-top"><StatusBadge row={row} /></td>
      <td className="p-3 align-top text-right">
        <Link className="text-sm font-medium text-primary hover:underline" href={`/admin/account-history/${row.recordType}/${row.id.split(":")[1]}`}>
          Ver detalle
        </Link>
      </td>
    </tr>
  )
}

export default async function AccountHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string
    q?: string
    platform?: string
    type?: string
    status?: string
    from?: string
    to?: string
  }>
}) {
  const { supabase } = await requireAdmin()
  const params = await searchParams
  const filters: AccountHistoryFilters = {
    query: queryValue(params.q),
    platform: queryValue(params.platform) || "all",
    type: queryValue(params.type) || "all",
    status: queryValue(params.status) || "all",
    dateFrom: queryValue(params.from),
    dateTo: queryValue(params.to),
  }
  const page = Number.parseInt(params.page ?? "1", 10)
  const history = await getAccountHistory(
    supabase,
    filters,
    Number.isFinite(page) ? page : 1
  )

  function pageHref(nextPage: number) {
    const query = new URLSearchParams()
    if (filters.query) query.set("q", filters.query)
    if (filters.platform !== "all") query.set("platform", filters.platform)
    if (filters.type !== "all") query.set("type", filters.type)
    if (filters.status !== "all") query.set("status", filters.status)
    if (filters.dateFrom) query.set("from", filters.dateFrom)
    if (filters.dateTo) query.set("to", filters.dateTo)
    query.set("page", String(nextPage))
    return `/admin/account-history?${query.toString()}`
  }

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Historial de cuentas</CardTitle>
        <CardDescription>
          Consulta cuentas archivadas, accesos cancelados y miembros eliminados sin mezclarlos con el inventario activo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <HistoryFilters
          initialQuery={filters.query}
          platforms={history.platforms}
        />

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>{history.total} registros históricos</span>
          <span>Página {history.page} de {history.totalPages}</span>
        </div>

        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[70rem] text-left">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="p-3">Fecha</th>
                <th className="p-3">Plataforma / plan familiar</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Cliente / acceso</th>
                <th className="p-3">Periodo</th>
                <th className="p-3">Estado</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {history.rows.length ? history.rows.map((row) => <HistoryRow key={row.id} row={row} />) : (
                <tr><td className="p-8 text-center text-sm text-muted-foreground" colSpan={7}>No hay registros con estos filtros.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end gap-2">
          {history.page > 1 ? <Link className="rounded-md border px-3 py-2 text-sm hover:bg-muted" href={pageHref(history.page - 1)}>Anterior</Link> : null}
          {history.page < history.totalPages ? <Link className="rounded-md border px-3 py-2 text-sm hover:bg-muted" href={pageHref(history.page + 1)}>Siguiente</Link> : null}
        </div>
      </CardContent>
    </Card>
  )
}
