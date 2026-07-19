"use client"

import { useMemo, useState } from "react"

import { InventoryActions } from "@/app/admin/accounts/inventory-actions"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  CardContent,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDate } from "@/lib/date"
import { money } from "@/lib/money"
import {
  boliviaToday,
  isMotherService,
  renewalOverdue,
} from "@/app/admin/subscriptions/mother-access"

type Nested<T> = T | T[] | null | undefined

type Account = {
  id: string
  service_id: string | null
  provider_id: string | null
  email_address_id: string | null
  label: string | null
  login_email: string | null
  username: string | null
  status: string
  started_at: string | null
  dead_at: string | null
  replacement_account_id: string | null
  base_cost_amount: number | null
  base_cost_currency: string | null
  base_cost_exchange_rate: number | null
  base_cost_usdt: number | null
  base_cost_bob: number | null
  renewal_due_on: string | null
  two_factor_url: string | null
  notes: string | null
  services?: Nested<{ name: string | null; slug: string | null }>
  providers?: Nested<{ name: string | null }>
  email_addresses?: Nested<{
    email: string
    email_password: string | null
    origin: string
    provider_id: string | null
  }>
  spotify_family_plans?: Nested<{
    invite_url: string | null
    address: string | null
    seats_total: number | null
  }>
  account_credentials?: Nested<{ secret_payload: string | null }>
}

type ServiceOption = {
  id: string
  name: string
  slug: string
}

type ProviderOption = {
  id: string
  name: string
  serviceIds: string[]
}

function one<T>(value: Nested<T>) {
  return Array.isArray(value) ? value[0] : value
}

function durationText(startedAt: string | null, deadAt: string | null) {
  if (!startedAt) return "-"

  const end = deadAt ? new Date(deadAt) : new Date()
  const days = Math.max(0, Math.ceil((end.getTime() - new Date(startedAt).getTime()) / 86400000))

  return `${days} dias`
}

function accountLabel(account: Account) {
  return [account.label, account.login_email ?? account.username].filter(Boolean).join(" · ")
}

export function AccountsTable({
  accounts,
  linkedAccountIds,
  services,
  providers,
}: {
  accounts: Account[]
  linkedAccountIds: string[]
  services: ServiceOption[]
  providers: ProviderOption[]
}) {
  const [typeFilter, setTypeFilter] = useState<"mother" | "private" | "all">("mother")
  const [showInactive, setShowInactive] = useState(false)
  const today = boliviaToday()
  const linked = useMemo(() => new Set(linkedAccountIds), [linkedAccountIds])
  const replacementLabels = useMemo(
    () => new Map(accounts.map((account) => [account.id, accountLabel(account)])),
    [accounts]
  )
  const motherSlugs = useMemo(() => new Set(["netflix", "spotify", "chatgpt-shared"]), [])
  const filteredAccounts = accounts
    .filter((account) => showInactive || account.status === "active")
    .filter((account) => {
      const slug = one(account.services)?.slug

      if (typeFilter === "private") return slug === "chatgpt-private"
      if (typeFilter === "all") return true

      return motherSlugs.has(slug ?? "")
    })

  return (
    <CardContent>
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Tabs
          value={typeFilter}
          onValueChange={(value) => setTypeFilter(value as "mother" | "private" | "all")}
        >
          <TabsList>
            <TabsTrigger value="mother">Cuentas madre</TabsTrigger>
            <TabsTrigger value="private">ChatGPT privados</TabsTrigger>
            <TabsTrigger value="all">Todo</TabsTrigger>
          </TabsList>
        </Tabs>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox
            checked={showInactive}
            onCheckedChange={(checked) => setShowInactive(checked === true)}
          />
          Mostrar desactivados
        </label>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ítem comprado</TableHead>
            <TableHead>Plataforma</TableHead>
            <TableHead>Proveedor</TableHead>
            <TableHead>Compra</TableHead>
            <TableHead>Próximo pago</TableHead>
            <TableHead>Duración</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredAccounts.map((account) => {
            const serviceSlug = one(account.services)?.slug
            const isPrivate = serviceSlug === "chatgpt-private"
            const isLinked = linked.has(account.id)
            const isMother = isMotherService(serviceSlug)
            const overdue = renewalOverdue(
              serviceSlug,
              account.renewal_due_on,
              today
            )

            return (
              <TableRow key={account.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span>{account.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {account.login_email ?? account.username}
                    </span>
                  </div>
                </TableCell>
                <TableCell>{one(account.services)?.name}</TableCell>
                <TableCell>{one(account.providers)?.name}</TableCell>
                <TableCell>{money(account.base_cost_usdt, "USDT")} / {money(account.base_cost_bob, "BOB")}</TableCell>
                <TableCell>
                  {isMother ? (
                    <div className="flex flex-col items-start gap-1">
                      <span>{formatDate(account.renewal_due_on)}</span>
                      {!account.renewal_due_on ? (
                        <Badge variant="secondary">Sin fecha</Badge>
                      ) : overdue ? (
                        <Badge variant="destructive">Vencido</Badge>
                      ) : account.renewal_due_on === today ? (
                        <Badge variant="outline">Vence hoy</Badge>
                      ) : null}
                    </div>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>{durationText(account.started_at, account.dead_at)}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <Badge variant="secondary">{account.status}</Badge>
                    {isPrivate && account.status === "active" ? (
                      <Badge variant={isLinked ? "destructive" : "secondary"}>
                        {isLinked ? "En uso" : "Disponible"}
                      </Badge>
                    ) : null}
                    {account.status !== "active" && isLinked ? (
                      <Badge variant="destructive">En uso</Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <InventoryActions
                    account={account}
                    replacementLabel={
                      account.replacement_account_id
                        ? replacementLabels.get(account.replacement_account_id) ?? "Cuenta reemplazada"
                        : null
                    }
                    services={services}
                    providers={providers}
                  />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      {filteredAccounts.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          Sin inventario para este filtro.
        </div>
      ) : null}
    </CardContent>
  )
}
