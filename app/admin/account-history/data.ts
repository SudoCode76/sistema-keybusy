import type { createClient } from "@/lib/supabase/server"

import {
  filterHistoryRows,
  historyStatusLabel,
  type AccountHistoryFilters,
  type AccountHistoryRow,
} from "./history"

type ServerClient = Awaited<ReturnType<typeof createClient>>

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value
}

function text(value: string | null | undefined) {
  return value?.trim() || null
}

export async function getAccountHistory(
  supabase: ServerClient,
  filters: AccountHistoryFilters,
  page = 1,
  pageSize = 20
) {
  const [{ data: accounts, error: accountsError }, { data: subscriptions, error: subscriptionsError }, { data: members, error: membersError }] =
    await Promise.all([
      supabase
        .from("service_accounts")
        .select("id, label, login_email, username, status, started_at, dead_at, updated_at, services(name, slug)"),
      supabase
        .from("subscriptions")
        .select("id, status, starts_on, ends_on, updated_at, customers(display_name), products(name, slug, services(name, slug)), service_accounts(label, login_email), subscription_access_details(login_email)"),
      supabase
        .from("spotify_member_accounts")
        .select("id, service_account_id, source_subscription_id, current_subscription_id, login_email, member_name, status, removed_at, updated_at, service_accounts(label, login_email), source_subscription:subscriptions!spotify_member_accounts_source_subscription_id_fkey(status, starts_on, ends_on, customers(display_name), products(name, slug, services(name, slug)), service_accounts(id))")
        .in("status", ["removed", "available"])
        .is("current_subscription_id", null)
        .not("source_subscription_id", "is", null),
    ])

  if (accountsError) throw accountsError
  if (subscriptionsError) throw subscriptionsError
  if (membersError) throw membersError

  const rows: AccountHistoryRow[] = []

  for (const account of accounts ?? []) {
    if (account.status === "active") continue
    const service = one(account.services)
    const accountEmail = text(account.login_email) ?? text(account.username)
    rows.push({
      id: `account:${account.id}`,
      eventAt: account.dead_at ?? account.updated_at ?? account.started_at,
      platformSlug: service?.slug ?? null,
      platformName: service?.name ?? "Plataforma",
      recordType: "service_account",
      recordTypeLabel: "Cuenta madre",
      accountLabel: account.label,
      accountEmail,
      customerName: null,
      memberEmail: null,
      startsOn: account.started_at,
      endsOn: account.dead_at,
      status: account.status,
      statusLabel: historyStatusLabel(account.status, "service_account"),
      details: accountEmail,
    })
  }

  for (const subscription of subscriptions ?? []) {
    if (!['canceled', 'inactive'].includes(subscription.status)) continue
    const product = one(subscription.products)
    const service = one(product?.services)
    const account = one(subscription.service_accounts)
    const customer = one(subscription.customers)
    const access = one(subscription.subscription_access_details)
    rows.push({
      id: `subscription:${subscription.id}`,
      eventAt: subscription.updated_at ?? subscription.ends_on,
      platformSlug: service?.slug ?? null,
      platformName: service?.name ?? "Plataforma",
      recordType: "subscription",
      recordTypeLabel: "Acceso / venta",
      accountLabel: account?.label ?? product?.name ?? "Acceso sin cuenta",
      accountEmail: text(account?.login_email),
      customerName: text(customer?.display_name),
      memberEmail: text(access?.login_email),
      startsOn: subscription.starts_on,
      endsOn: subscription.ends_on,
      status: subscription.status,
      statusLabel: historyStatusLabel(subscription.status, "subscription"),
      details: product?.name ?? product?.slug ?? null,
    })
  }

  for (const member of members ?? []) {
    const account = one(member.service_accounts)
    const source = one(member.source_subscription)
    const sourceProduct = one(source?.products)
    const sourceService = one(sourceProduct?.services)
    const sourceCustomer = one(source?.customers)
    const sourceAccountId = one(source?.service_accounts)?.id ?? null
    const moved = Boolean(
      member.current_subscription_id === null &&
        member.source_subscription_id &&
        sourceAccountId &&
        sourceAccountId !== member.service_account_id
    )
    rows.push({
      id: `member:${member.id}`,
      eventAt: member.removed_at ?? member.updated_at,
      platformSlug: "spotify",
      platformName: sourceService?.name ?? "Spotify",
      recordType: "family_member",
      recordTypeLabel: "Miembro familiar",
      accountLabel: account?.label ?? "Plan familiar Spotify",
      accountEmail: text(account?.login_email),
      customerName: text(sourceCustomer?.display_name),
      memberEmail: text(member.login_email),
      startsOn: source?.starts_on ?? null,
      endsOn: source?.ends_on ?? null,
      status: moved ? "moved" : member.status,
      statusLabel: historyStatusLabel(moved ? "moved" : member.status, "family_member"),
      details: member.member_name ?? null,
    })
  }

  const filteredRows = filterHistoryRows(rows, filters).sort((a, b) => {
    const left = a.eventAt ? Date.parse(a.eventAt) : 0
    const right = b.eventAt ? Date.parse(b.eventAt) : 0
    return right - left
  })
  const total = filteredRows.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(Math.max(page, 1), totalPages)
  const start = (safePage - 1) * pageSize

  return {
    rows: filteredRows.slice(start, start + pageSize),
    total,
    page: safePage,
    totalPages,
    platforms: Array.from(
      new Map(
        rows
          .filter((row) => row.platformSlug)
          .map((row) => [row.platformSlug, { slug: row.platformSlug as string, name: row.platformName }])
      ).values()
    ).sort((a, b) => a.name.localeCompare(b.name)),
  }
}
