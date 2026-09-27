"use client"

import { Fragment, useCallback, useMemo, useState, useSyncExternalStore } from "react"
import { AnimatePresence, MotionConfig, motion } from "motion/react"
import { cn } from "@/lib/utils"
import {
  InventoryActions,
  parseSecretPayload,
} from "@/app/admin/accounts/inventory-actions"
import { SpotifyMemberActions } from "@/app/admin/accounts/spotify-member-actions"
import { CancelSaleAction } from "@/app/admin/accounts/cancel-sale-action"
import { CopyAccountDataItem } from "@/app/admin/accounts/copy-account-data-item"
import { isAccountAvailable } from "@/app/admin/accounts/account-availability"
import {
  accountMatchesSearch,
  accountRecordMatchesSearch,
  childMatchesSearch,
  getSearchMatchSegments,
} from "@/app/admin/accounts/accounts-search"
import {
  ACCOUNT_COLUMN_OPTIONS,
  DEFAULT_ACCOUNT_COLUMNS,
  getAccountColumnsServerSnapshot,
  getAccountColumnsSnapshot,
  parseAccountColumns,
  setAccountColumns,
  subscribeAccountColumns,
  type AccountColumnId,
} from "@/app/admin/accounts/account-column-preferences"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDate } from "@/lib/date"
import { money } from "@/lib/money"
import {
  boliviaToday,
  renewalOverdue,
} from "@/app/admin/subscriptions/mother-access"
import { CheckIcon, CopyIcon, MoreHorizontalIcon, Settings2Icon } from "lucide-react"

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
  accountCustomerPhone?: string | null
  services?: Nested<{
    name: string | null
    slug: string | null
    delivery_name?: string | null
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

export type SpotifyFamilyPlanOption = {
  id: string
  label: string | null
  loginEmail: string | null
  seatsTotal: number
  seatsUsed: number
  renewalDueOn: string | null
  isOverdue: boolean
}

type ServiceOption = {
  id: string
  name: string
  slug: string
  delivery_name?: string | null
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
  sourceSubscriptionId: string | null
  currentSubscriptionId: string | null
  serviceAccountId: string
  serviceAccountLabel: string
  customerName: string
  contact: string | null
  loginEmail: string | null
  loginPassword: string | null
  emailPassword: string | null
  memberName: string | null
  profileLabel: string | null
  searchText: string
  purchaseMode: string | null
  allowAccountReuseOnCancel: boolean
  startsOn: string | null
  endsOn: string | null
  durationMonths: number | null
  status: string
  hasActiveSale: boolean
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

function HighlightMatch({
  text,
  query,
  className,
}: {
  text: string | null | undefined
  query: string | null | undefined
  className?: string
}) {
  if (!text) return null
  if (!query?.trim()) return <>{text}</>

  const segments = getSearchMatchSegments(text, query)
  const hasMatch = segments.some((segment) => segment.highlight)
  if (!hasMatch) return <>{text}</>

  return (
    <span className={className}>
      {segments.map((segment, index) =>
        segment.highlight ? (
          <mark
            className="rounded-xs bg-amber-200/90 px-0.5 font-bold text-amber-950 dark:bg-amber-400/30 dark:text-amber-100"
            key={index}
          >
            {segment.text}
          </mark>
        ) : (
          <Fragment key={index}>{segment.text}</Fragment>
        )
      )}
    </span>
  )
}

function CopyCredential({
  label,
  value,
  query,
}: {
  label: string
  value: string | null | undefined
  query?: string
}) {
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
      <span className="truncate">
        {label}: <HighlightMatch query={query} text={text} />
      </span>
      {copied ? <CheckIcon className="size-3 shrink-0" /> : <CopyIcon className="size-3 shrink-0" />}
    </button>
  )
}

const responsiveAccountRowClassName =
  "grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border p-4 xl:table-row xl:rounded-none xl:border-x-0 xl:border-t-0 xl:p-0"
const responsiveAccountCellClassName =
  "min-w-0 whitespace-normal p-0 xl:table-cell xl:p-2"
const responsiveMemberRowClassName =
  "grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-lg border border-primary/20 bg-muted/30 p-3 xl:table-row xl:rounded-none xl:border-0 xl:bg-muted/20 xl:p-0"

function AccountMobileLabel({ children }: { children: string }) {
  return (
    <span className="mb-1 block text-xs font-medium text-muted-foreground xl:hidden">
      {children}
    </span>
  )
}

export function AccountsTable({
  accountModel,
  accounts,
  activeAccountUses,
  accountMembers,
  spotifyClients,
  spotifyConversionClients,
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
  accountMembers: SpotifyClient[]
  spotifyClients: SpotifyClient[]
  spotifyConversionClients: SpotifyClient[]
  services: ServiceOption[]
  providers: ProviderOption[]
  returnPath: "/admin/accounts" | "/admin/personal-accounts"
}) {
  const [platformFilter, setPlatformFilter] = useState("all")
  const [query, setQuery] = useState("")
  const [expandedSpotifyAccounts, setExpandedSpotifyAccounts] = useState<string[]>([])
  const [showInactive, setShowInactive] = useState(false)
  const [onlyAvailable, setOnlyAvailable] = useState(false)
  const subscribeColumns = useCallback(
    (listener: () => void) => subscribeAccountColumns(accountModel, listener),
    [accountModel]
  )
  const getColumnsSnapshot = useCallback(
    () => getAccountColumnsSnapshot(accountModel),
    [accountModel]
  )
  const columnsSnapshot = useSyncExternalStore(
    subscribeColumns,
    getColumnsSnapshot,
    getAccountColumnsServerSnapshot
  )
  const visibleColumns = useMemo(
    () => new Set<AccountColumnId>(parseAccountColumns(columnsSnapshot)),
    [columnsSnapshot]
  )
  const visibleColumnCount = visibleColumns.size
  const toggleColumn = (column: AccountColumnId, checked: boolean) => {
    const nextColumns = checked
      ? [...visibleColumns, column]
      : [...visibleColumns].filter((visibleColumn) => visibleColumn !== column)
    setAccountColumns(accountModel, nextColumns)
  }
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
  const searchChildrenByAccount = useMemo(() => {
    const children = new Map<string, SpotifyClient[]>()
    for (const child of [...accountMembers, ...spotifyClients]) {
      const current = children.get(child.serviceAccountId) ?? []
      current.push(child)
      children.set(child.serviceAccountId, current)
    }
    return children
  }, [accountMembers, spotifyClients])
  const matchingAccountIds = useMemo(
    () => new Set(
      accounts
        .filter((account) =>
          accountMatchesSearch(
            account,
            searchChildrenByAccount.get(account.id) ?? [],
            query
          )
        )
        .map((account) => account.id)
    ),
    [accounts, query, searchChildrenByAccount]
  )
  const filteredAccounts = accounts
    .filter((account) => showInactive || account.status === "active")
    .filter((account) => one(account.services)?.account_model === accountModel)
    .filter((account) => !platformFilter || platformFilter === "all" || one(account.services)?.slug === platformFilter)
    .filter((account) => matchingAccountIds.has(account.id))
    .filter((account) => {
      if (!onlyAvailable) return true
      const uses = activeUses.get(account.id) ?? []
      const hasPrivateSale = uses.some((use) => use.productSlug !== "chatgpt_codex")

      if (accountModel === "private") {
        return isAccountAvailable(account.status, hasPrivateSale)
      }

      return account.status === "active" && (account.seat_capacity ?? 0) > account.spotifySeatsUsed
    })
  const spotifyFamilyPlans = useMemo<SpotifyFamilyPlanOption[]>(
    () => accounts
      .filter(
        (account) =>
          one(account.services)?.slug === "spotify" &&
          account.status === "active" &&
          one(account.spotify_family_plans)
      )
      .map((account) => {
        const plan = one(account.spotify_family_plans)
        const seatsTotal = plan?.seats_total ?? account.seat_capacity ?? 0
        return {
          id: account.id,
          label: account.label,
          loginEmail: account.login_email,
          seatsTotal,
          seatsUsed: account.spotifySeatsUsed,
          renewalDueOn: account.renewal_due_on,
          isOverdue: renewalOverdue(
            "spotify",
            account.renewal_due_on,
            today,
            "mother"
          ),
        }
      }),
    [accounts, today]
  )
  const platformStats = services.map((service) => {
    const serviceAccounts = accounts.filter(
      (account) => one(account.services)?.slug === service.slug
    )
    const available = serviceAccounts.filter((account) => {
      const uses = activeUses.get(account.id) ?? []
      const hasPrivateSale = uses.some((use) => use.productSlug !== "chatgpt_codex")
      return accountModel === "private"
        ? isAccountAvailable(account.status, hasPrivateSale)
        : account.status === "active" && (account.seat_capacity ?? 0) > account.spotifySeatsUsed
    }).length

    return {
      ...service,
      total: serviceAccounts.length,
      active: serviceAccounts.filter((account) => account.status === "active").length,
      available,
    }
  })
  return (
    <MotionConfig reducedMotion="user">
    <CardContent>
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            aria-label="Buscar cuenta, correo, número o cliente"
            className="w-full md:max-w-xl"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar cuenta, correo, número o cliente..."
            value={query}
          />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button size="sm" type="button" variant="outline" />}
            >
              <Settings2Icon data-icon="inline-start" />
              Columnas
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Columnas visibles</DropdownMenuLabel>
                {ACCOUNT_COLUMN_OPTIONS.map((column) => (
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns.has(column.id)}
                    disabled={!column.hideable}
                    key={column.id}
                    onCheckedChange={(checked) =>
                      toggleColumn(column.id, checked === true)
                    }
                  >
                    {column.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setAccountColumns(accountModel, DEFAULT_ACCOUNT_COLUMNS)}
              >
                Restablecer columnas
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
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
      <Table className="block w-full xl:table xl:min-w-[65rem]">
        <TableHeader className="hidden xl:table-header-group">
          <TableRow>
            {visibleColumns.has("account") ? <TableHead>Cuenta</TableHead> : null}
            {visibleColumns.has("platform") ? <TableHead>Plataforma</TableHead> : null}
            {visibleColumns.has("provider") ? <TableHead>Proveedor</TableHead> : null}
            {visibleColumns.has("purchase") ? <TableHead>Compra</TableHead> : null}
            {visibleColumns.has("renewal") ? <TableHead>Próximo pago</TableHead> : null}
            {visibleColumns.has("duration") ? <TableHead>Duración</TableHead> : null}
            {visibleColumns.has("status") ? <TableHead>Estado</TableHead> : null}
            {visibleColumns.has("actions") ? <TableHead className="text-right">Acciones</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody className="flex flex-col gap-4 xl:table-row-group xl:gap-0">
          {filteredAccounts.map((account, accountIndex) => {
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
            const membersForAccount = isMother
                ? (serviceSlug === "spotify" ? spotifyClients : accountMembers).filter(
                  (client) =>
                    client.serviceAccountId === account.id &&
                    (serviceSlug !== "spotify" || client.status !== "removed")
                )
              : []
            const hasActiveSearch = Boolean(query.trim())
            const accountSelfMatches = hasActiveSearch && accountRecordMatchesSearch(account, query)
            const matchingMemberCount = hasActiveSearch
              ? membersForAccount.filter((client) => childMatchesSearch(client, query)).length
              : 0
            const isSearchExpanded = hasActiveSearch && matchingAccountIds.has(account.id)
            const isExpanded = expandedSpotifyAccounts.includes(account.id) || isSearchExpanded

            return (
              <Fragment key={account.id}>
              <motion.tr
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  responsiveAccountRowClassName,
                  accountSelfMatches &&
                    "border-primary/50 bg-primary/5 ring-1 ring-primary/30 xl:bg-primary/5 dark:bg-primary/10 dark:xl:bg-primary/10"
                )}
                initial={{ opacity: 0, y: 6 }}
                transition={{ delay: Math.min(accountIndex * 0.025, 0.18), duration: 0.22 }}
              >
                {visibleColumns.has("account") ? (
                  <TableCell className={cn("col-span-2", responsiveAccountCellClassName)}>
                    <div className="flex flex-col items-start gap-1">
                      <div className="flex w-full flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-base xl:text-sm">
                            <HighlightMatch query={query} text={account.label} />
                          </span>
                          {accountSelfMatches ? (
                            <Badge className="h-4.5 px-1.5 py-0 text-[10px] font-semibold" variant="default">
                              Coincidencia
                            </Badge>
                          ) : null}
                        </div>
                        {isMother ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {matchingMemberCount > 0 ? (
                              <Badge className="border-primary/40 text-primary font-medium text-xs" variant="outline">
                                {matchingMemberCount} {matchingMemberCount === 1 ? "coincidencia" : "coincidencias"}
                              </Badge>
                            ) : null}
                            {seatsAvailable === null ? (
                              <Badge variant="outline">Cupos sin configurar</Badge>
                            ) : (
                              <Badge
                                variant={
                                  seatsAvailable === 0
                                    ? "destructive"
                                    : "secondary"
                                }
                              >
                                {seatsAvailable} de {seatsTotal} cupos disponibles
                              </Badge>
                            )}
                          </div>
                        ) : null}
                      </div>
                      <CopyCredential label="Correo" query={query} value={account.login_email ?? account.username} />
                      <CopyCredential label="Contraseña" value={platformPassword} />
                      {account.accountCustomerPhone ? (
                        <div className="mt-0.5 flex items-center gap-1 text-xs">
                          <CopyCredential label="Cliente" query={query} value={account.accountCustomerPhone} />
                        </div>
                      ) : (
                        <span className="mt-0.5 text-[11px] text-muted-foreground italic">
                          Sin cliente asignado
                        </span>
                      )}
                    </div>
                  </TableCell>
                ) : null}
                {visibleColumns.has("platform") ? (
                  <TableCell className={responsiveAccountCellClassName}>
                    <AccountMobileLabel>Plataforma</AccountMobileLabel>
                    <span>{one(account.services)?.name ?? "-"}</span>
                  </TableCell>
                ) : null}
                {visibleColumns.has("provider") ? (
                  <TableCell className={responsiveAccountCellClassName}>
                    <AccountMobileLabel>Proveedor</AccountMobileLabel>
                    <span>{one(account.providers)?.name ?? "-"}</span>
                  </TableCell>
                ) : null}
                {visibleColumns.has("purchase") ? (
                  <TableCell className={responsiveAccountCellClassName}>
                    <AccountMobileLabel>Compra</AccountMobileLabel>
                    <span>{money(account.base_cost_usdt, "USDT")} / {money(account.base_cost_bob, "BOB")}</span>
                  </TableCell>
                ) : null}
                {visibleColumns.has("renewal") ? (
                  <TableCell className={responsiveAccountCellClassName}>
                    <AccountMobileLabel>Próximo pago</AccountMobileLabel>
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
                ) : null}
                {visibleColumns.has("duration") ? (
                  <TableCell className={responsiveAccountCellClassName}>
                    <AccountMobileLabel>Duración</AccountMobileLabel>
                    <span>{durationText(account.started_at, account.dead_at)}</span>
                  </TableCell>
                ) : null}
                {visibleColumns.has("status") ? (
                  <TableCell className={responsiveAccountCellClassName}>
                    <AccountMobileLabel>Estado</AccountMobileLabel>
                    <div className="flex flex-wrap items-center gap-1">
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
                ) : null}
                {visibleColumns.has("actions") ? (
                  <TableCell className={cn("col-span-2 border-t pt-2 xl:border-t-0 xl:pt-2", responsiveAccountCellClassName, "xl:text-right")}>
                    <div className="flex flex-wrap items-center justify-between gap-2 xl:justify-end">
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
                          {isExpanded ? "Ocultar miembros" : `Ver miembros (${membersForAccount.length})`}
                        </Button>
                      ) : <div />}
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
                        spotifyConversionClients={spotifyConversionClients.filter(
                          (client) => client.serviceAccountId === account.id
                        )}
                        spotifyFamilyPlans={spotifyFamilyPlans}
                      />
                    </div>
                  </TableCell>
                ) : null}
              </motion.tr>
              <AnimatePresence initial={false}>
              {isMother && isExpanded
                ? membersForAccount.length
                  ? membersForAccount.map((client, memberIndex) => {
                      const clientMatches = hasActiveSearch && childMatchesSearch(client, query)
                      const isDimmed = hasActiveSearch && !clientMatches

                      return (
                        <motion.tr
                          animate={{ opacity: isDimmed ? 0.45 : 1, y: 0 }}
                          className={cn(
                            responsiveMemberRowClassName,
                            "xl:border-b last:xl:border-0 transition-opacity",
                            clientMatches
                              ? "border-primary/70 bg-primary/10 ring-1 ring-primary/40 xl:bg-primary/10 dark:xl:bg-primary/15"
                              : isDimmed
                                ? "opacity-45 hover:opacity-100"
                                : ""
                          )}
                          exit={{ opacity: 0, y: -4 }}
                          initial={{ opacity: 0, y: -4 }}
                          key={client.id}
                          transition={{ delay: memberIndex * 0.025, duration: 0.18 }}
                          whileHover={isDimmed ? { opacity: 1 } : undefined}
                        >
                          {visibleColumns.has("account") ? (
                            <TableCell className={cn("col-span-2", responsiveAccountCellClassName)}>
                              <div
                                className={cn(
                                  "pl-3 transition-colors",
                                  clientMatches
                                    ? "border-l-4 border-primary"
                                    : "border-l-2 border-primary/50"
                                )}
                              >
                                <div className="flex flex-wrap items-center gap-1.5 font-semibold text-foreground">
                                  <span className="font-mono text-sm text-primary font-bold">
                                    <HighlightMatch query={query} text={client.customerName || client.contact} />
                                  </span>
                                  {client.memberName ? (
                                    <span className="text-xs font-normal text-muted-foreground">
                                      (<HighlightMatch query={query} text={client.memberName} />)
                                    </span>
                                  ) : null}
                                  {clientMatches ? (
                                    <Badge className="h-4.5 px-1.5 py-0 text-[10px] font-semibold" variant="default">
                                      Coincidencia
                                    </Badge>
                                  ) : null}
                                </div>
                                {client.contact && client.contact !== client.customerName ? (
                                  <div className="break-all text-xs text-muted-foreground">
                                    <HighlightMatch query={query} text={client.contact} />
                                  </div>
                                ) : null}
                              </div>
                            </TableCell>
                          ) : null}
                        {visibleColumns.has("platform") ? (
                          <TableCell className={responsiveAccountCellClassName}>
                            <AccountMobileLabel>Plataforma</AccountMobileLabel>
                            <span>Cliente Spotify</span>
                          </TableCell>
                        ) : null}
                        {visibleColumns.has("provider") ? (
                          <TableCell className={responsiveAccountCellClassName}>
                            <AccountMobileLabel>Plan familiar</AccountMobileLabel>
                            <span>{client.serviceAccountLabel}</span>
                          </TableCell>
                        ) : null}
                        {visibleColumns.has("purchase") ? (
                          <TableCell className={responsiveAccountCellClassName}>
                            <AccountMobileLabel>Compra</AccountMobileLabel>
                            <span>-</span>
                          </TableCell>
                        ) : null}
                        {visibleColumns.has("renewal") ? (
                          <TableCell className={responsiveAccountCellClassName}>
                            <AccountMobileLabel>Vence</AccountMobileLabel>
                            <span>{client.endsOn ? formatDate(client.endsOn) : "-"}</span>
                          </TableCell>
                        ) : null}
                        {visibleColumns.has("duration") ? (
                          <TableCell className={responsiveAccountCellClassName}>
                            <AccountMobileLabel>Duración</AccountMobileLabel>
                            <span>
                              {client.durationMonths ? `${client.durationMonths} ${client.durationMonths === 1 ? "mes" : "meses"}` : "-"}
                            </span>
                          </TableCell>
                        ) : null}
                        {visibleColumns.has("status") ? (
                          <TableCell className={responsiveAccountCellClassName}>
                            <AccountMobileLabel>Estado</AccountMobileLabel>
                            <div className="flex flex-wrap gap-1">
                              <Badge variant={client.status === "removed" ? "destructive" : client.status === "available" ? "outline" : "secondary"}>
                                {client.status === "removed"
                                  ? "Eliminado de Spotify"
                                  : client.status === "available"
                                    ? "Disponible para reasignar"
                                    : "Asignado a cliente"}
                              </Badge>
                              <Badge variant="outline">
                                {client.profileLabel ?? "Miembro familiar"}
                              </Badge>
                            </div>
                          </TableCell>
                        ) : null}
                        {visibleColumns.has("actions") ? (
                          <TableCell className={cn("col-span-2 border-t pt-2 xl:border-t-0 xl:pt-2", responsiveAccountCellClassName, "xl:text-right")}>
                            <div className="flex justify-end">
                              {serviceSlug === "spotify" ? (
                                <SpotifyMemberActions
                                  accountId={account.id}
                                  currentPlanEmail={account.login_email}
                                  platformName={one(account.services)?.delivery_name ?? one(account.services)?.name ?? "Servicio"}
                                  member={client}
                                  providers={providers}
                                  targetPlans={spotifyFamilyPlans}
                                />
                              ) : (
                                <>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger render={<Button size="sm" variant="outline" />}>
                                      <MoreHorizontalIcon data-icon="inline-start" />
                                      Opciones
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <CopyAccountDataItem
                                        cutoffDate={client.endsOn}
                                        email={client.loginEmail ?? client.contact}
                                        password={client.loginPassword}
                                        platform={one(account.services)?.delivery_name ?? one(account.services)?.name ?? "Servicio"}
                                      />
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                  {client.currentSubscriptionId ? (
                                    <CancelSaleAction
                                      accountIsMother
                                      allowAccountReuseOnCancel={client.allowAccountReuseOnCancel}
                                      saleLabel={client.customerName}
                                      subscriptionId={client.currentSubscriptionId}
                                    />
                                  ) : null}
                                </>
                              )}
                            </div>
                          </TableCell>
                        ) : null}
                        </motion.tr>
                      )
                    })
                  : (
                    <motion.tr
                      animate={{ opacity: 1 }}
                      className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground xl:table-row xl:rounded-none xl:border-0 xl:bg-muted/20"
                      exit={{ opacity: 0 }}
                      initial={{ opacity: 0 }}
                    >
                      <TableCell className="text-center xl:text-left xl:pl-8" colSpan={visibleColumnCount}>
                        Esta cuenta no tiene miembros registrados.
                      </TableCell>
                    </motion.tr>
                  )
                : null}
              </AnimatePresence>
              </Fragment>
            )
          })}
        </TableBody>
      </Table>
      {filteredAccounts.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          {query.trim()
            ? `No se encontraron cuentas para “${query.trim()}”.`
            : "Sin inventario para este filtro."}
        </div>
      ) : null}
    </CardContent>
    </MotionConfig>
  )
}
