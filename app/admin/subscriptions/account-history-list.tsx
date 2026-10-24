import { calendarDaysBetween } from "@/lib/chatgpt-account-history"
import { boliviaDate, formatDate } from "@/lib/date"

export type AccountHistoryEntry = {
  id: string
  service_account_id: string
  assigned_at: string
  ended_at: string | null
  is_estimated: boolean
  blocked_at: string | null
  block_reason: string | null
  purchase_cost_bob: number
  purchase_cost_usdt: number
  service_accounts: {
    label: string
    login_email: string | null
    username: string | null
  } | null
}

export function AccountHistoryList({
  entries,
  currentAccountId,
  saleStatus,
}: {
  entries: AccountHistoryEntry[]
  currentAccountId: string | null
  saleStatus: string
}) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Sin cuentas registradas.</p>
    )
  }

  return (
    <div className="grid gap-3">
      {[...entries]
        .sort(
          (left, right) =>
            Number(right.ended_at === null) - Number(left.ended_at === null) ||
            Date.parse(right.assigned_at) - Date.parse(left.assigned_at)
        )
        .map((entry) => {
          const assignedOn = boliviaDate(entry.assigned_at)
          const endedOn = entry.ended_at ? boliviaDate(entry.ended_at) : null
          const isCurrent =
            !entry.ended_at && entry.service_account_id === currentAccountId
          const identifier =
            entry.service_accounts?.login_email ??
            entry.service_accounts?.username

          return (
            <div
              className="border-b pb-3 text-sm last:border-0 last:pb-0"
              key={entry.id}
            >
              <div className="font-medium">
                {entry.service_accounts?.label ?? entry.service_account_id}
                {isCurrent
                  ? ` · ${["canceled", "inactive", "expired"].includes(saleStatus) ? "última asignación" : "actual"}`
                  : ""}
              </div>
              {identifier ? (
                <div className="break-all text-muted-foreground">
                  {identifier}
                </div>
              ) : null}
              <div className="text-muted-foreground">
                {entry.is_estimated
                  ? `Fecha inicial no disponible${endedOn ? ` · salida aproximada ${formatDate(endedOn)}` : ""}`
                  : `Desde ${formatDate(assignedOn)}${endedOn ? ` hasta ${formatDate(endedOn)}` : ""} · ${calendarDaysBetween(assignedOn, endedOn ?? boliviaDate(new Date().toISOString()))} días`}
              </div>
              {entry.blocked_at ? (
                <div className="text-destructive">
                  Bloqueada {formatDate(boliviaDate(entry.blocked_at))}
                  {entry.block_reason ? ` · ${entry.block_reason}` : ""}
                </div>
              ) : null}
            </div>
          )
        })}
    </div>
  )
}
