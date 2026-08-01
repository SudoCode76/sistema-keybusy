"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { SubscriptionActions } from "@/app/admin/subscriptions/subscription-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
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
import { cn } from "@/lib/utils"

import type {
  AccountOption,
  CountryOption,
  ProductOption,
  ProviderOption,
} from "./sale-form"

export type SubscriptionRow = {
  id: string
  customerId: string
  customerCountryId: string
  customerName: string
  customerPhone: string | null
  customerPhoneE164: string | null
  customerPhoneNormalized: string | null
  customerTelegram: string | null
  productId: string
  productName: string
  serviceName: string
  serviceSlug: string
  serviceAccountId: string | null
  motherAccessIssueOn: string | null
  accountLabel: string | null
  slotLabel: string | null
  status: string
  startsOn: string
  endsOn: string
  durationMonths: number
  currentPriceAmount: number
  currentPriceCurrency: "BOB" | "USDT"
  currentExchangeRate: number | null
  renewalMessageSentAt: string | null
  renewalMessageDays: number | null
  hasPurchaseCost: boolean
  accountHistory: Array<{
    service_account_id: string
    assigned_at: string
    ended_at: string | null
    blocked_at: string | null
    block_reason: string | null
    purchase_cost_bob: number
    purchase_cost_usdt: number
    duration_days: number
    service_accounts: { label: string; created_at: string } | null
  }>
  accountCostBob: number
  accountCostUsdt: number
  managedEmailId: string | null
  purchaseCost: {
    providerId: string | null
    amount: number
    currency: "BOB" | "USDT"
  } | null
  notes: string | null
  account: {
    login_email: string | null
    username: string | null
    provider_id: string | null
    email_address_id: string | null
    base_cost_amount: number
    base_cost_currency: "BOB" | "USDT"
    two_factor_url: string | null
    account_credentials?: { secret_payload: string | null } | null
    spotify_family_plans?: { invite_url: string | null; address: string | null } | null
  } | null
  detail: {
    login_email: string | null
    login_password: string | null
    email_password: string | null
    invitation_email: string | null
    profile_label: string | null
    notes: string | null
    visible_to_customer: boolean
    visible_fields: string[]
  } | null
}

const responsiveRowClassName =
  "grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border p-4 xl:table-row xl:rounded-none xl:border-x-0 xl:border-t-0 xl:p-0"
const responsiveCellClassName =
  "min-w-0 whitespace-normal p-0 xl:table-cell xl:p-2"

function MobileLabel({ children }: { children: string }) {
  return (
    <span className="mb-1 block text-xs font-medium text-muted-foreground xl:hidden">
      {children}
    </span>
  )
}

export function SubscriptionsTable({
  initialRows,
  initialTotal,
  initialActiveTotal,
  platform,
  platforms,
  onPlatformChange,
  accounts,
  products,
  providers,
  countries,
  defaultCountryId,
}: {
  initialRows: SubscriptionRow[]
  initialTotal: number
  initialActiveTotal: number
  platform: string
  platforms: { slug: string; name: string }[]
  onPlatformChange: (platform: string) => void
  accounts: AccountOption[]
  products: ProductOption[]
  providers: ProviderOption[]
  countries: CountryOption[]
  defaultCountryId?: string
}) {
  const [query, setQuery] = useState("")
  const [showCanceled, setShowCanceled] = useState(false)
  const [onlyReminded, setOnlyReminded] = useState(false)
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState(initialRows)
  const [total, setTotal] = useState(initialTotal)
  const [activeTotal, setActiveTotal] = useState(initialActiveTotal)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const firstLoad = useRef(true)
  const initialVersion = initialRows.map((row) => `${row.id}:${row.status}:${row.endsOn}:${row.renewalMessageSentAt ?? ""}`).join("|")
  const totalPages = Math.max(1, Math.ceil(total / 20))

  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false
      return
    }

    const controller = new AbortController()
    const timeout = setTimeout(async () => {
      setLoading(true)
      setError("")

      try {
        const params = new URLSearchParams({ page: String(page), platform })
        if (query.trim()) params.set("q", query.trim())
        if (showCanceled) params.set("canceled", "1")
        if (onlyReminded) params.set("reminded", "1")

        const response = await fetch(`/admin/subscriptions/data?${params}`, {
          signal: controller.signal,
        })
        if (!response.ok) throw new Error()

        const result = (await response.json()) as {
          rows: SubscriptionRow[]
          total: number
          activeTotal: number
        }
        setRows(result.rows)
        setTotal(result.total)
        setActiveTotal(result.activeTotal)
      } catch {
        if (!controller.signal.aborted) setError("No se pudieron cargar los accesos.")
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, query ? 250 : 0)

    return () => {
      clearTimeout(timeout)
      controller.abort()
    }
  }, [initialVersion, onlyReminded, page, platform, query, showCanceled])

  return (
    <div className="min-w-0 flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <Input
          aria-label="Buscar por teléfono, Telegram o correo"
          className="md:max-w-sm"
          onChange={(event) => {
            setQuery(event.target.value)
            setPage(1)
          }}
          placeholder="Buscar por teléfono, Telegram o correo"
          value={query}
        />
        <Field orientation="horizontal">
          <Checkbox
            checked={showCanceled}
            id="show-canceled"
            onCheckedChange={(checked) => {
              setShowCanceled(checked === true)
              if (checked) setOnlyReminded(false)
              setPage(1)
            }}
          />
          <FieldLabel htmlFor="show-canceled">Ver dados de baja</FieldLabel>
        </Field>
        <Field orientation="horizontal">
          <Checkbox
            checked={onlyReminded}
            id="only-reminded"
            onCheckedChange={(checked) => {
              setOnlyReminded(checked === true)
              if (checked) setShowCanceled(false)
              setPage(1)
            }}
          />
          <FieldLabel htmlFor="only-reminded">Solo avisados sin renovar</FieldLabel>
        </Field>
      </div>
      <div className="flex min-w-0 flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
        <Tabs
          className="w-full min-w-0 overflow-x-auto xl:flex-1"
          value={platform}
          onValueChange={(value) => {
            onPlatformChange(value)
            setPage(1)
          }}
        >
          <TabsList className="w-max min-w-full justify-start">
            <TabsTrigger value="all">Todo</TabsTrigger>
            {platforms.map((item) => (
              <TabsTrigger key={item.slug} value={item.slug}>
                {item.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Badge className="self-start xl:self-auto" variant="secondary">
          Accesos activos: {activeTotal}
        </Badge>
      </div>
      <Table className="block w-full xl:table xl:min-w-[60rem]">
        <TableHeader className="hidden xl:table-header-group">
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>Ítem vendido</TableHead>
            <TableHead>Inventario</TableHead>
            <TableHead>Renueva</TableHead>
            <TableHead>Venta total</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="grid gap-3 [&_tr:last-child]:border xl:table-row-group xl:[&_tr:last-child]:border-0">
          {loading
            ? Array.from({ length: 5 }, (_, index) => (
                <TableRow className={responsiveRowClassName} key={index}>
                  {Array.from({ length: 7 }, (_, cell) => (
                    <TableCell
                      className={responsiveCellClassName}
                      key={cell}
                    >
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : rows.map((item) => (
                <TableRow
                  className={responsiveRowClassName}
                  key={item.id}
                >
                  <TableCell
                    className={cn("col-span-2", responsiveCellClassName)}
                  >
                    <div className="flex min-w-0 flex-col">
                      <MobileLabel>Cliente</MobileLabel>
                      <span className="font-medium xl:font-normal">
                        {item.customerName}
                      </span>
                      {item.serviceSlug === "spotify" &&
                      item.detail?.login_email ? (
                        <span className="break-all text-xs text-muted-foreground">
                          {item.detail.login_email}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className={responsiveCellClassName}>
                    <MobileLabel>Ítem vendido</MobileLabel>
                    {item.productName}
                  </TableCell>
                  <TableCell className={responsiveCellClassName}>
                    <MobileLabel>Inventario</MobileLabel>
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{item.accountLabel ?? item.slotLabel ?? "-"}</span>
                      {item.serviceSlug === "spotify" && item.slotLabel ? (
                        <Badge variant="outline">{item.slotLabel}</Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className={responsiveCellClassName}>
                    <MobileLabel>Renueva</MobileLabel>
                    {formatDate(item.endsOn)}
                  </TableCell>
                  <TableCell className={responsiveCellClassName}>
                    <MobileLabel>Venta total</MobileLabel>
                    {money(
                      item.currentPriceAmount * item.durationMonths,
                      item.currentPriceCurrency
                    )}
                  </TableCell>
                  <TableCell className={responsiveCellClassName}>
                    <MobileLabel>Estado</MobileLabel>
                    <div className="flex flex-col items-start gap-1">
                      <Badge variant="secondary">{item.status}</Badge>
                      {item.renewalMessageDays !== null ? (
                        <Badge variant="outline">
                          {item.renewalMessageDays === 0
                            ? "Avisado hoy"
                            : item.renewalMessageDays === 1
                              ? "Avisado hace 1 día"
                              : `Avisado hace ${item.renewalMessageDays} días`}
                        </Badge>
                      ) : null}
                      {item.motherAccessIssueOn ? (
                        <Badge
                          className="max-w-full whitespace-normal"
                          variant="destructive"
                        >
                          Acceso afectado · {formatDate(item.motherAccessIssueOn)}
                        </Badge>
                      ) : null}
                      {item.accountHistory.find((history) => !history.ended_at)?.blocked_at ? (
                        <Badge className="max-w-full whitespace-normal" variant="destructive">
                          Cuenta bloqueada · {formatDate(item.accountHistory.find((history) => !history.ended_at)!.blocked_at!)}
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell
                    className={cn(
                      "col-span-2 flex flex-col items-end justify-end",
                      responsiveCellClassName
                    )}
                  >
                    <MobileLabel>Acciones</MobileLabel>
                    <SubscriptionActions
                      accounts={accounts}
                      countries={countries}
                      defaultCountryId={defaultCountryId}
                      products={products}
                      providers={providers}
                      subscription={{
                        id: item.id,
                        customerId: item.customerId,
                        customerCountryId: item.customerCountryId,
                        customerName: item.customerName,
                        customerPhone: item.customerPhone,
                        customerPhoneE164: item.customerPhoneE164,
                        customerTelegram: item.customerTelegram,
                        productId: item.productId,
                        serviceSlug: item.serviceSlug,
                        serviceAccountId: item.serviceAccountId,
                        motherAccessIssueOn: item.motherAccessIssueOn,
                        slotLabel: item.slotLabel,
                        startsOn: item.startsOn,
                        durationMonths: item.durationMonths,
                        currentPriceAmount: item.currentPriceAmount,
                        currentPriceCurrency: item.currentPriceCurrency,
                        currentExchangeRate: item.currentExchangeRate,
                        renewalMessageSentAt: item.renewalMessageSentAt,
                        renewalMessageDays: item.renewalMessageDays,
                        hasPurchaseCost: item.hasPurchaseCost,
                        accountHistory: item.accountHistory,
                        accountCostBob: item.accountCostBob,
                        accountCostUsdt: item.accountCostUsdt,
                        managedEmailId: item.managedEmailId,
                        purchaseCost: item.purchaseCost,
                        accountLabel: item.accountLabel,
                        notes: item.notes,
                        productName: item.productName,
                        serviceName: item.serviceName,
                        status: item.status,
                        detail: item.detail,
                        account: item.account,
                        endsOn: item.endsOn,
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
        </TableBody>
      </Table>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {!loading && rows.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          Sin accesos para este filtro.
        </div>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {total} registros · Página {page} de {totalPages}
        </p>
        <div className="flex self-end gap-2 sm:self-auto">
          <Button
            aria-label="Página anterior"
            disabled={loading || page === 1}
            onClick={() => setPage((current) => current - 1)}
            size="icon"
            title="Página anterior"
            variant="outline"
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            aria-label="Página siguiente"
            disabled={loading || page === totalPages}
            onClick={() => setPage((current) => current + 1)}
            size="icon"
            title="Página siguiente"
            variant="outline"
          >
            <ChevronRightIcon />
          </Button>
        </div>
      </div>
    </div>
  )
}
