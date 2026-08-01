"use client"

import { Fragment, useMemo, useState } from "react"
import Link from "next/link"

import { InventoryActions } from "@/app/admin/accounts/inventory-actions"
import { isAccountAvailable } from "@/app/admin/accounts/account-availability"
import {
  isCodexAvailable,
  isMotherAccount,
} from "@/app/admin/accounts/account-availability"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
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
import { spotifySeatsAvailable } from "@/app/admin/subscriptions/spotify-seats"

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
  spotifySeatsUsed: number
  services?: Nested<{
    name: string | null
    slug: string | null
    products?: Array<{ purchase_mode: string | null }>
  }>
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
  show_in_inventory_tabs?: boolean | null
  products?: Array<{ purchase_mode: string | null }>
}

type ProviderOption = {
  id: string
  name: string
  serviceIds: string[]
}

type SpotifyClient = {
  id: string
  serviceAccountId: string
  serviceAccountLabel: string
  customerName: string
  contact: string | null
  profileLabel: string | null
  startsOn: string
  endsOn: string
  durationMonths: number
  status: string
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
  activeAccountUses,
  spotifyClients,
  services,
  providers,
}: {
  accounts: Account[]
  activeAccountUses: Array<{
    serviceAccountId: string | null
    productSlug: string | null
  }>
  spotifyClients: SpotifyClient[]
  services: ServiceOption[]
  providers: ProviderOption[]
}) {
  const [typeFilter, setTypeFilter] = useState<"mother" | "private" | "codex" | "all">("mother")
  const [platformFilter, setPlatformFilter] = useState("all")
  const [showInactive, setShowInactive] = useState(false)
  const [onlyAvailable, setOnlyAvailable] = useState(false)
  const today = boliviaToday()
  const activeUses = useMemo(
    () => new Map(
      accounts.map((account) => [
        account.id,
        activeAccountUses.filter((use) => use.serviceAccountId === account.id),
      ])
    ),
    [accounts, activeAccountUses]
  )
  const replacementLabels = useMemo(
    () => new Map(accounts.map((account) => [account.id, accountLabel(account)])),
    [accounts]
  )
  const motherSlugs = useMemo(() => new Set(["netflix", "spotify", "chatgpt-shared"]), [])
  const filteredAccounts = accounts
    .filter((account) => showInactive || account.status === "active")
    .filter((account) => {
      const service = one(account.services)
      const purchaseModes = service?.products?.map((product) => product.purchase_mode) ?? []
      const accountIsMother = isMotherAccount(
        purchaseModes,
        motherSlugs.has(service?.slug ?? "")
      )

      if (typeFilter === "codex") return service?.slug === "chatgpt-private"
      if (typeFilter === "private") return !accountIsMother
      if (typeFilter === "all") return true

      return accountIsMother
    })
    .filter((account) => !platformFilter || platformFilter === "all" || one(account.services)?.slug === platformFilter)
    .filter((account) => {
      if (!onlyAvailable) return true
      const uses = activeUses.get(account.id) ?? []
      const hasCodexSale = uses.some((use) => use.productSlug === "chatgpt_codex")
      const hasPrivateSale = uses.some((use) => use.productSlug !== "chatgpt_codex")

      if (typeFilter === "codex") {
        return isCodexAvailable(account.status, hasCodexSale)
      }

      if (one(account.services)?.slug === "chatgpt-private") {
        return isAccountAvailable(account.status, hasPrivateSale)
      }

      return isAccountAvailable(account.status, uses.length > 0)
    })
  const platformStats = services.map((service) => {
    const serviceAccounts = accounts.filter(
      (account) => one(account.services)?.slug === service.slug
    )
    const available = serviceAccounts.filter((account) => {
      const uses = activeUses.get(account.id) ?? []
      const hasPrivateSale = uses.some((use) => use.productSlug !== "chatgpt_codex")
      return one(account.services)?.slug === "chatgpt-private"
        ? isAccountAvailable(account.status, hasPrivateSale)
        : isAccountAvailable(account.status, uses.length > 0)
    }).length

    return {
      ...service,
      total: serviceAccounts.length,
      active: serviceAccounts.filter((account) => account.status === "active").length,
      available,
    }
  })
  const selectPlatform = (next: string) => {
    setPlatformFilter(next)
    if (next === "all") return

    const selectedPlatform = services.find((service) => service.slug === next)
    const selectedIsMother = isMotherAccount(
      selectedPlatform?.products?.map((product) => product.purchase_mode) ?? [],
      motherSlugs.has(next)
    )
    setTypeFilter(selectedIsMother ? "mother" : "private")
  }
  const selectedTab = platformFilter === "all"
    ? typeFilter
    : `platform:${platformFilter}`

  return (
    <CardContent>
      <div className="mb-4 flex flex-col gap-3">
        <Tabs
          className="inventory-tabs-scroll w-full min-w-0 overflow-x-auto"
          value={selectedTab}
          onValueChange={(value) => {
            if (value.startsWith("platform:")) {
              selectPlatform(value.slice("platform:".length))
              return
            }

            const next = value as "mother" | "private" | "codex" | "all"
            setTypeFilter(next)
            setPlatformFilter("all")
          }}
        >
          <TabsList className="w-max min-w-full justify-start gap-1 px-1 [&_[data-slot=tabs-trigger]]:px-4">
            <TabsTrigger value="mother">Cuentas madre</TabsTrigger>
            {platformStats
              .filter(
                (platform) =>
                  platform.total > 0 &&
                  platform.show_in_inventory_tabs !== false
              )
              .map((platform) => (
                <TabsTrigger
                  key={platform.slug}
                  value={`platform:${platform.slug}`}
                >
                  {platform.name}
                </TabsTrigger>
              ))}
            <TabsTrigger value="codex">Codex</TabsTrigger>
            <TabsTrigger value="all">Todo</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <label className="flex items-center gap-2">
            <Checkbox
              checked={onlyAvailable}
              onCheckedChange={(checked) => setOnlyAvailable(checked === true)}
            />
            Solo disponibles sin cliente
          </label>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={showInactive}
              onCheckedChange={(checked) => setShowInactive(checked === true)}
            />
            Mostrar desactivados
          </label>
        </div>
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
            const codexView = typeFilter === "codex"
            const uses = activeUses.get(account.id) ?? []
            const hasCodexSale = uses.some(
              (use) => use.productSlug === "chatgpt_codex"
            )
            const hasPrivateSale = uses.some(
              (use) => use.productSlug !== "chatgpt_codex"
            )
            const spotifySeatsTotal = one(
              account.spotify_family_plans
            )?.seats_total ?? null
            const spotifyAvailable = spotifySeatsAvailable(
              spotifySeatsTotal,
              account.spotifySeatsUsed
            )
            const isLinked = codexView
              ? hasCodexSale
              : serviceSlug === "chatgpt-private"
                ? hasPrivateSale
                : uses.length > 0
            const isAvailable = codexView
              ? isCodexAvailable(account.status, hasCodexSale)
              : isAccountAvailable(account.status, isLinked)
            const isMother = isMotherService(serviceSlug)
            const overdue = renewalOverdue(
              serviceSlug,
              account.renewal_due_on,
              today
            )

            return (
              <Fragment key={account.id}>
              <TableRow>
                <TableCell>
                  <div className="flex flex-col items-start gap-1">
                    <span>{codexView ? `Codex · ${account.label}` : account.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {account.login_email ?? account.username}
                    </span>
                    {!codexView && serviceSlug === "spotify" ? (
                      spotifyAvailable === null ? (
                        <Badge variant="outline">Cupos sin configurar</Badge>
                      ) : (
                        <Badge
                          variant={
                            spotifyAvailable === 0
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {spotifyAvailable} de {spotifySeatsTotal} cupos
                          disponibles
                        </Badge>
                      )
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>{codexView ? "Codex" : one(account.services)?.name}</TableCell>
                <TableCell>{one(account.providers)?.name}</TableCell>
                <TableCell>{money(account.base_cost_usdt, "USDT")} / {money(account.base_cost_bob, "BOB")}</TableCell>
                <TableCell>
                  {isMother ? (
                    <div className="flex flex-col items-start gap-1">
                      <span>{formatDate(account.renewal_due_on)}</span>
                      {!account.renewal_due_on ? (
                        <Badge variant="secondary">Sin fecha</Badge>
                      ) : account.renewal_due_on === today ? (
                        <Badge variant="destructive">Renovar hoy</Badge>
                      ) : overdue ? (
                        <Badge variant="destructive">Vencido</Badge>
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
                    {isAvailable ? (
                      <Badge variant="secondary">
                        {codexView ? "Codex disponible" : "Disponible sin cliente"}
                      </Badge>
                    ) : isLinked ? (
                      <Badge variant="destructive">
                        {codexView ? "Codex en uso" : "En uso"}
                      </Badge>
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
              {platformFilter === "spotify"
                ? spotifyClients
                    .filter((client) => client.serviceAccountId === account.id)
                    .map((client) => (
                      <TableRow className="bg-muted/20" key={client.id}>
                        <TableCell>
                          <div className="border-l-2 border-primary/30 pl-4">
                            <div>{client.customerName}</div>
                            <div className="text-xs text-muted-foreground">
                              {client.contact}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>Cliente Spotify</TableCell>
                        <TableCell>{client.serviceAccountLabel}</TableCell>
                        <TableCell>-</TableCell>
                        <TableCell>{formatDate(client.endsOn)}</TableCell>
                        <TableCell>
                          {client.durationMonths} {client.durationMonths === 1 ? "mes" : "meses"}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant="secondary">{client.status}</Badge>
                            <Badge variant="outline">
                              {client.profileLabel ?? "Cliente"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Link
                            className={buttonVariants({ size: "sm", variant: "outline" })}
                            href="/admin/subscriptions"
                          >
                            Ver acceso
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))
                : null}
              </Fragment>
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
