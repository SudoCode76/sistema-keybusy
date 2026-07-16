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

import type { AccountOption, ProductOption, ProviderOption } from "./sale-form"

export type SubscriptionRow = {
  id: string
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
  accountLabel: string | null
  slotLabel: string | null
  status: string
  startsOn: string
  endsOn: string
  durationMonths: number
  currentPriceAmount: number
  currentPriceCurrency: "BOB" | "USDT"
  currentExchangeRate: number | null
  hasPurchaseCost: boolean
  notes: string | null
  account: {
    login_email: string | null
    username: string | null
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
}) {
  const [query, setQuery] = useState("")
  const [showCanceled, setShowCanceled] = useState(false)
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState(initialRows)
  const [total, setTotal] = useState(initialTotal)
  const [activeTotal, setActiveTotal] = useState(initialActiveTotal)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const firstLoad = useRef(true)
  const initialVersion = initialRows.map((row) => `${row.id}:${row.status}:${row.endsOn}`).join("|")
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
  }, [initialVersion, page, platform, query, showCanceled])

  return (
    <div className="flex flex-col gap-4">
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
              setPage(1)
            }}
          />
          <FieldLabel htmlFor="show-canceled">Ver dados de baja</FieldLabel>
        </Field>
      </div>
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <Tabs
          value={platform}
          onValueChange={(value) => {
            onPlatformChange(value)
            setPage(1)
          }}
        >
          <TabsList className="max-w-full flex-wrap justify-start">
            <TabsTrigger value="all">Todo</TabsTrigger>
            {platforms.map((item) => (
              <TabsTrigger key={item.slug} value={item.slug}>
                {item.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Badge variant="secondary">Accesos activos: {activeTotal}</Badge>
      </div>
      <Table>
        <TableHeader>
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
        <TableBody>
          {loading
            ? Array.from({ length: 5 }, (_, index) => (
                <TableRow key={index}>
                  {Array.from({ length: 7 }, (_, cell) => (
                    <TableCell key={cell}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            : rows.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{item.customerName}</TableCell>
              <TableCell>{item.productName}</TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center gap-2">
                  <span>{item.accountLabel ?? item.slotLabel ?? "-"}</span>
                  {item.serviceSlug === "spotify" && item.slotLabel ? (
                    <Badge variant="outline">{item.slotLabel}</Badge>
                  ) : null}
                </div>
              </TableCell>
              <TableCell>{formatDate(item.endsOn)}</TableCell>
              <TableCell>
                {money(item.currentPriceAmount * item.durationMonths, item.currentPriceCurrency)}
              </TableCell>
              <TableCell><Badge variant="secondary">{item.status}</Badge></TableCell>
              <TableCell>
                <SubscriptionActions
                  accounts={accounts}
                  products={products}
                  providers={providers}
                  subscription={{
                    id: item.id,
                    customerName: item.customerName,
                    customerPhoneE164: item.customerPhoneE164,
                    customerTelegram: item.customerTelegram,
                    productId: item.productId,
                    serviceSlug: item.serviceSlug,
                    serviceAccountId: item.serviceAccountId,
                    slotLabel: item.slotLabel,
                    startsOn: item.startsOn,
                    durationMonths: item.durationMonths,
                    currentPriceAmount: item.currentPriceAmount,
                    currentPriceCurrency: item.currentPriceCurrency,
                    currentExchangeRate: item.currentExchangeRate,
                    hasPurchaseCost: item.hasPurchaseCost,
                    notes: item.notes,
                    productName: item.productName,
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
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {total} registros · Página {page} de {totalPages}
        </p>
        <div className="flex gap-2">
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
