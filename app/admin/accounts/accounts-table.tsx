"use client"

import { Fragment, useMemo, useState } from "react"
import Link from "next/link"

import {
  InventoryActions,
  parseSecretPayload,
} from "@/app/admin/accounts/inventory-actions"
import { isAccountAvailable } from "@/app/admin/accounts/account-availability"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
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
  renewalOverdue,
} from "@/app/admin/subscriptions/mother-access"
import { CheckIcon, CopyIcon } from "lucide-react"

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
  seat_capacity: number | null
  two_factor_url: string | null
  notes: string | null
  spotifySeatsUsed: number
  services?: Nested<{
    name: string | null
    slug: string | null
    account_model: "private" | "mother"
    products?: Array<{
      slug: string
      purchase_mode: string | null
      is_default: boolean
    }>
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
  account_model: "private" | "mother"
  default_seat_capacity: number | null
  show_in_inventory_tabs?: boolean | null
  products?: Array<{
    slug: string
    purchase_mode: string | null
    is_default: boolean
  }>
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

function CopyCredential({ label, value }: { label: string; value: string | null | undefined }) {
  const [copied, setCopied] = useState(false)

  if (!value) return null
  const text = value

  async function copy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <button
      aria-label={`Copiar ${label}`}
      className="flex max-w-full items-center gap-1 text-left text-xs text-muted-foreground hover:text-foreground"
      onClick={copy}
      title={`Copiar ${label}`}
      type="button"
    >
      <span className="truncate">{label}: {text}</span>
      {copied ? <CheckIcon className="size-3 shrink-0" /> : <CopyIcon className="size-3 shrink-0" />}
    </button>
  )
}

export function AccountsTable({
  accountModel,
  accounts,
  activeAccountUses,
  spotifyClients,
  services,
  providers,
  returnPath,
}: {
  accountModel: "mother" | "private"
  accounts: Account[]
  activeAccountUses: Array<{
    serviceAccountId: string | null
    productSlug: string | null
  }>
  spotifyClients: SpotifyClient[]
  services: ServiceOption[]
  providers: ProviderOption[]
  returnPath: "/admin/accounts" | "/admin/personal-accounts"
}) {
  const [platformFilter, setPlatformFilter] = useState("all")
  const [expandedSpotifyAccounts, setExpandedSpotifyAccounts] = useState<string[]>([])
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
  const filteredAccounts = accounts
    .filter((account) => showInactive || account.status === "active")
    .filter((account) => one(account.services)?.account_model === accountModel)
    .filter((account) => !platformFilter || platformFilter === "all" || one(account.services)?.slug === platformFilter)
    .filter((account) => {
      if (!onlyAvailable) return true
      const uses = activeUses.get(account.id) ?? []
      const hasPrivateSale = uses.some((use) => use.productSlug !== "chatgpt_codex")

      if (accountModel === "private") {
        return isAccountAvailable(account.status, hasPrivateSale)
      }

      return account.status === "active" && (account.seat_capacity ?? 0) > uses.length
    })
  const platformStats = services.map((service) => {
    const serviceAccounts = accounts.filter(
      (account) => one(account.services)?.slug === service.slug
    )
    const available = serviceAccounts.filter((account) => {
      const uses = activeUses.get(account.id) ?? []
      const hasPrivateSale = uses.some((use) => use.productSlug !== "chatgpt_codex")
      return accountModel === "private"
        ? isAccountAvailable(account.status, hasPrivateSale)
        : account.status === "active" && (account.seat_capacity ?? 0) > uses.length
    }).length

    return {
      ...service,
      total: serviceAccounts.length,
      active: serviceAccounts.filter((account) => account.status === "active").length,
      available,
    }
  })
  return (
    <CardContent>
      <div className="mb-4 flex flex-col gap-3">
        <Tabs
          className="inventory-tabs-scroll w-full min-w-0 overflow-x-auto"
          value={platformFilter}
          onValueChange={setPlatformFilter}
        >
          <TabsList className="w-max min-w-full justify-start gap-1 px-1 [&_[data-slot=tabs-trigger]]:px-4">
            <TabsTrigger value="all">Todas</TabsTrigger>
            {platformStats
              .filter(
                (platform) =>
                  platform.total > 0 &&
                  platform.show_in_inventory_tabs !== false
              )
              .map((platform) => (
                <TabsTrigger
                  key={platform.slug}
                  value={platform.slug}
                >
                  {platform.name}
                </TabsTrigger>
              ))}
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
            <TableHead>Cuenta</TableHead>
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
            const uses = activeUses.get(account.id) ?? []
            const hasCodexSale = uses.some(
              (use) => use.productSlug === "chatgpt_codex"
            )
            const hasPrivateSale = uses.some(
              (use) => use.productSlug !== "chatgpt_codex"
            )
            const seatsTotal = account.seat_capacity
            const seatsAvailable = seatsTotal === null
              ? null
              : Math.max(0, seatsTotal - account.spotifySeatsUsed)
            const isMother = accountModel === "mother"
            const isAvailable = isMother
              ? account.status === "active" && (seatsAvailable ?? 0) > 0
              : isAccountAvailable(account.status, hasPrivateSale)
            const overdue = renewalOverdue(
              serviceSlug,
              account.renewal_due_on,
              today,
              one(account.services)?.account_model
            )
            const assignmentProduct = one(account.services)?.products?.find(
              (product) => product.is_default && product.slug !== "chatgpt_codex"
            ) ?? one(account.services)?.products?.find(
              (product) => product.slug !== "chatgpt_codex"
            )
            const canAssign = Boolean(
              assignmentProduct &&
              account.status === "active" &&
              !overdue &&
              isAvailable
            )
            const assignmentUnavailableReason = !assignmentProduct
              ? "Esta cuenta no tiene un ítem vendible configurado"
              : overdue
                ? "Primero registra la renovación de la cuenta"
                : isMother && (seatsAvailable ?? 0) === 0
                  ? "La cuenta madre no tiene cupos disponibles"
                  : !isMother && !isAvailable
                      ? "Esta cuenta ya tiene un cliente activo"
                      : "La cuenta no está activa"
            const secrets = parseSecretPayload(one(account.account_credentials)?.secret_payload)
            const platformPassword = secrets.platform_password ?? secrets.password
            const accountMembers = isMother
              ? spotifyClients.filter((client) => client.serviceAccountId === account.id)
              : []

            return (
              <Fragment key={account.id}>
              <TableRow>
                <TableCell>
                  <div className="flex flex-col items-start gap-1">
                    <span>{account.label}</span>
                    <CopyCredential label="Correo" value={account.login_email ?? account.username} />
                    <CopyCredential label="Contraseña" value={platformPassword} />
                    {isMother ? (
                      seatsAvailable === null ? (
                        <Badge variant="outline">Cupos sin configurar</Badge>
                      ) : (
                        <Badge
                          variant={
                            seatsAvailable === 0
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {seatsAvailable} de {seatsTotal} cupos
                          disponibles
                        </Badge>
                      )
                    ) : null}
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
                      <Badge variant="secondary">{isMother ? "Con cupos disponibles" : "Disponible sin cliente"}</Badge>
                    ) : (!isMother && hasPrivateSale) ? (
                      <Badge variant="destructive">En uso</Badge>
                    ) : null}
                    {!isMother && serviceSlug === "chatgpt-private" ? (
                      <Badge variant={hasCodexSale ? "destructive" : "outline"}>
                        {hasCodexSale ? "Codex en uso" : "Codex disponible"}
                      </Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {isMother ? (
                      <Button
                        onClick={() => setExpandedSpotifyAccounts((current) =>
                          current.includes(account.id)
                            ? current.filter((id) => id !== account.id)
                            : [...current, account.id]
                        )}
                        size="sm"
                        variant="outline"
                      >
                        {expandedSpotifyAccounts.includes(account.id) ? "Ocultar miembros" : "Ver miembros"}
                      </Button>
                    ) : null}
                    <InventoryActions
                      account={account}
                      assignmentHref={
                        canAssign && assignmentProduct
                          ? `/admin/subscriptions?new=1&product=${assignmentProduct.slug}&account=${account.id}`
                          : undefined
                      }
                      assignmentLabel={serviceSlug === "spotify" ? "Asignar miembro" : "Asignar cliente"}
                      assignmentUnavailableReason={assignmentUnavailableReason}
                      replacementLabel={
                        account.replacement_account_id
                          ? replacementLabels.get(account.replacement_account_id) ?? "Cuenta reemplazada"
                          : null
                      }
                      returnPath={returnPath}
                      services={services}
                      providers={providers}
                    />
                  </div>
                </TableCell>
              </TableRow>
              {isMother && expandedSpotifyAccounts.includes(account.id)
                ? accountMembers.length
                  ? accountMembers.map((client) => (
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
                  : (
                    <TableRow className="bg-muted/20">
                      <TableCell className="pl-8 text-sm text-muted-foreground" colSpan={8}>
                        Esta cuenta no tiene clientes activos.
                      </TableCell>
                    </TableRow>
                  )
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
