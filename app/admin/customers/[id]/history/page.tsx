import Link from "next/link"
import { notFound } from "next/navigation"

import {
  AccountHistoryList,
  type AccountHistoryEntry,
} from "@/app/admin/subscriptions/account-history-list"
import { boliviaToday } from "@/app/admin/subscriptions/mother-access"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatDate } from "@/lib/date"
import { requireAdmin } from "@/lib/auth"

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export default async function CustomerAccountHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase } = await requireAdmin()
  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id, display_name, phone, phone_e164, telegram_username")
    .eq("id", id)
    .maybeSingle()
  if (customerError) throw customerError
  if (!customer) notFound()

  const firstSales = await supabase
    .from("subscriptions")
    .select(
      "id, status, service_account_id, starts_on, ends_on, products(name, services(name))"
    )
    .eq("customer_id", id)
    .order("created_at", { ascending: false })
    .range(0, 499)
  if (firstSales.error) throw firstSales.error
  const sales = firstSales.data ?? []
  if (sales.length === 500) {
    for (let from = 500; ; from += 500) {
      const batch = await supabase
        .from("subscriptions")
        .select(
          "id, status, service_account_id, starts_on, ends_on, products(name, services(name))"
        )
        .eq("customer_id", id)
        .order("created_at", { ascending: false })
        .range(from, from + 499)
      if (batch.error) throw batch.error
      sales.push(...(batch.data ?? []))
      if (!batch.data || batch.data.length < 500) break
    }
  }

  const firstHistory = await supabase
    .from("subscription_account_history")
    .select(
      "id, subscription_id, service_account_id, assigned_at, ended_at, is_estimated, blocked_at, block_reason, purchase_cost_bob, purchase_cost_usdt, service_accounts(label, login_email, username), subscriptions!inner(customer_id)"
    )
    .eq("subscriptions.customer_id", id)
    .order("assigned_at")
    .range(0, 499)
  if (firstHistory.error) throw firstHistory.error
  const history = firstHistory.data ?? []
  if (history.length === 500) {
    for (let from = 500; ; from += 500) {
      const batch = await supabase
        .from("subscription_account_history")
        .select(
          "id, subscription_id, service_account_id, assigned_at, ended_at, is_estimated, blocked_at, block_reason, purchase_cost_bob, purchase_cost_usdt, service_accounts(label, login_email, username), subscriptions!inner(customer_id)"
        )
        .eq("subscriptions.customer_id", id)
        .order("assigned_at")
        .range(from, from + 499)
      if (batch.error) throw batch.error
      history.push(...(batch.data ?? []))
      if (!batch.data || batch.data.length < 500) break
    }
  }

  const bySale = new Map<string, AccountHistoryEntry[]>()
  for (const entry of history) {
    const rows = bySale.get(entry.subscription_id) ?? []
    rows.push({ ...entry, service_accounts: one(entry.service_accounts) })
    bySale.set(entry.subscription_id, rows)
  }
  const today = boliviaToday()

  return (
    <div className="grid gap-4">
      <Link
        className="text-sm text-primary hover:underline"
        href="/admin/customers"
      >
        ← Clientes
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Historial de cuentas · {customer.display_name}</CardTitle>
          <CardDescription>
            {[
              customer.phone_e164 ?? customer.phone,
              customer.telegram_username
                ? `@${customer.telegram_username}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          {sales.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Este cliente no tiene ventas registradas.
            </p>
          ) : null}
          {sales.map((sale) => {
            const product = one(sale.products)
            const saleStatus =
              sale.status === "active" && sale.ends_on <= today
                ? "expired"
                : sale.status
            return (
              <section className="rounded-lg border p-4" key={sale.id}>
                <h2 className="font-medium">
                  {one(product?.services ?? null)?.name ?? "Servicio"} ·{" "}
                  {product?.name ?? "Venta"}
                </h2>
                <p className="mb-3 text-sm text-muted-foreground">
                  Venta desde {formatDate(sale.starts_on)} · {saleStatus}
                </p>
                <AccountHistoryList
                  currentAccountId={sale.service_account_id}
                  entries={bySale.get(sale.id) ?? []}
                  saleStatus={saleStatus}
                />
              </section>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
