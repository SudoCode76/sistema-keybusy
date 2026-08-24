import { claimFirstAdmin } from "@/app/actions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { requireUser } from "@/lib/auth"
import { fetchBinanceAverage } from "@/lib/binance"
import { formatDate, formatDateTime } from "@/lib/date"
import { money } from "@/lib/money"

import { DashboardPendingRenewals } from "./dashboard-pending-renewals"
import { SalesTrendCharts } from "./sales-trend-charts"
import { boliviaToday } from "./subscriptions/mother-access"

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value
}

export default async function AdminPage() {
  const { supabase, profile } = await requireUser()

  if (profile?.role !== "admin") {
    return (
      <div className="mx-auto flex min-h-[70svh] max-w-md items-center">
        <Card>
          <CardHeader>
            <CardTitle>Crear primer administrador</CardTitle>
            <CardDescription>
              Esta acción solo funciona mientras no exista otro admin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={claimFirstAdmin}>
              <Button type="submit">Convertirme en admin</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  const today = boliviaToday()
  const rate = fetchBinanceAverage("BUY")
    .then((result) => ({ value: result.average, capturedAt: null }))
    .catch(async () => {
      const { data } = await supabase
        .from("exchange_rate_snapshots")
        .select("average_price, captured_at")
        .eq("trade_type", "BUY")
        .order("captured_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      const value = Number(data?.average_price)

      return Number.isFinite(value) && value > 0
        ? { value, capturedAt: data?.captured_at ?? null }
        : null
    })

  const [
    { data: current },
    { data: renewals },
    { count: customers },
    { data: salesTrends },
    binanceRate,
  ] = await Promise.all([
    supabase.from("admin_dashboard_summary").select("*").maybeSingle(),
    supabase
      .from("subscriptions")
      .select(
        "id, status, slot_label, ends_on, duration_months, current_price_amount, current_price_currency, current_exchange_rate, customers(display_name, phone_e164), products(name, purchase_mode, allow_account_reuse_on_cancel, services(slug)), service_accounts(label, login_email, username, email_addresses(email)), subscription_access_details(login_email), email_usages(email_address_id, ended_at, email_addresses(email))"
      )
      .not("status", "in", "(canceled,inactive)")
      .lte("ends_on", today)
      .order("ends_on", { ascending: true })
      .limit(8),
    supabase.from("customers").select("*", { count: "exact", head: true }),
    supabase
      .from("admin_daily_sales_trends")
      .select("*")
      .order("day", { ascending: true })
      .order("service_name", { ascending: true }),
    rate,
  ])

  const newPayments = Number(current?.collected_new_count ?? 0)
  const renewalPayments = Number(current?.collected_renewal_count ?? 0)
  const adjustmentPayments = Number(current?.collected_adjustment_count ?? 0)
  const pendingRenewals = Number(current?.pending_renewal_count ?? 0)
  const overdueRenewals = Number(current?.overdue_renewal_count ?? 0)
  const upcomingRenewals = Number(current?.upcoming_renewal_count ?? 0)
  const pendingRenewalRows = (renewals ?? []).map((item) => {
    const customer = one(item.customers)
    const product = one(item.products)
    const service = one(product?.services ?? null)
    const account = one(item.service_accounts)
    const detail = one(item.subscription_access_details)
    const activeEmailUsage = (item.email_usages ?? []).find(
      (usage) => usage.ended_at === null
    )
    const managedEmail = one(activeEmailUsage?.email_addresses ?? null)
    const accountInventoryEmail = one(account?.email_addresses ?? null)
    const accountEmail =
      managedEmail?.email ??
      detail?.login_email ??
      account?.login_email ??
      accountInventoryEmail?.email ??
      account?.username ??
      null

    return {
      id: item.id,
      customerName: customer?.display_name ?? "Cliente",
      customerPhoneE164: customer?.phone_e164 ?? null,
      productName: product?.name ?? "Ítem",
      serviceSlug: service?.slug ?? null,
      accountLabel: account?.label ?? item.slot_label ?? null,
      accountEmail,
      purchaseMode: product?.purchase_mode ?? null,
      allowAccountReuseOnCancel: Boolean(product?.allow_account_reuse_on_cancel),
      endsOn: item.ends_on,
      renewalStartOn: item.ends_on < today ? today : item.ends_on,
      durationMonths: Number(item.duration_months ?? 1),
      currentPriceAmount: Number(item.current_price_amount ?? 0),
      currentPriceCurrency: item.current_price_currency === "USDT" ? ("USDT" as const) : ("BOB" as const),
      currentExchangeRate: binanceRate?.value ?? item.current_exchange_rate,
    }
  })

  return (
    <>
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Cobrado neto</CardDescription>
            <CardTitle className="tabular-nums">
              {money(current?.net_collected_bob, "BOB")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
            <p>{money(current?.net_collected_usdt, "USDT")}</p>
            <p>
              Bruto: {money(current?.collected_bob, "BOB")} ·{" "}
              {money(current?.collected_usdt, "USDT")}
            </p>
            <p>
              Gastos: {money(current?.cost_bob, "BOB")} ·{" "}
              {money(current?.cost_usdt, "USDT")}
            </p>
            <p>
              Al {formatDate(current?.as_of)} · Nuevos: {newPayments} ·
              Renovaciones: {renewalPayments}
              {adjustmentPayments ? ` · Ajustes: ${adjustmentPayments}` : ""}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Pendiente</CardDescription>
            <CardTitle className="tabular-nums">
              {money(current?.pending_bob, "BOB")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
            <p>{money(current?.pending_usdt, "USDT")}</p>
            <p>
              {pendingRenewals
                ? `Vencidas: ${overdueRenewals} · Próximas: ${upcomingRenewals}`
                : "Sin renovaciones pendientes este mes"}
            </p>
            {upcomingRenewals ? (
              <p>
                Próximas entre {formatDate(current?.pending_from)} y{" "}
                {formatDate(current?.month_end)}
              </p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Proyectado neto</CardDescription>
            <CardTitle className="tabular-nums">
              {money(current?.net_projected_bob, "BOB")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
            <p>{money(current?.net_projected_usdt, "USDT")}</p>
            <p>Cobrado neto + pendiente del mes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Clientes</CardDescription>
            <CardTitle>{customers ?? 0}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            registrados
          </CardContent>
        </Card>
      </div>

      <p className="text-sm text-muted-foreground">
        {binanceRate
          ? `Binance P2P BUY · 1 USDT = ${binanceRate.value.toFixed(4)} BOB${binanceRate.capturedAt ? ` · Última captura: ${formatDateTime(binanceRate.capturedAt)}` : " · Actual"}`
          : "Cotización Binance P2P no disponible."}
      </p>

      {overdueRenewals ? (
        <Alert>
          <AlertTitle>Renovaciones vencidas sin cobrar</AlertTitle>
          <AlertDescription>
            Renovaciones vencidas: {overdueRenewals} ·{" "}
            {money(current?.overdue_bob, "BOB")} ·{" "}
            {money(current?.overdue_usdt, "USDT")}. Estos montos ya están
            incluidos en Pendiente y Proyectado neto.
          </AlertDescription>
        </Alert>
      ) : null}

      <SalesTrendCharts rows={salesTrends ?? []} />

      <DashboardPendingRenewals rows={pendingRenewalRows} today={today} />
    </>
  )
}
