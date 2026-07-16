import type { createClient } from "@/lib/supabase/server"

import type { SubscriptionRow } from "./subscriptions-table"

type ServerClient = Awaited<ReturnType<typeof createClient>>

export const SUBSCRIPTIONS_PAGE_SIZE = 20

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value
}

export async function getSubscriptionsPage(
  supabase: ServerClient,
  {
    page = 1,
    query = "",
    platform = "all",
    showCanceled = false,
  }: {
    page?: number
    query?: string
    platform?: string
    showCanceled?: boolean
  } = {}
) {
  const today = new Date().toISOString().slice(0, 10)
  let productIds: string[] | null = null
  let subscriptionQuery = supabase
    .from("subscriptions")
    .select("id, product_id, service_account_id, slot_label, status, starts_on, ends_on, duration_months, current_price_amount, current_price_currency, current_exchange_rate, notes, customers(id, country_id, display_name, phone, phone_e164, phone_normalized, telegram_username), products(id, slug, name, services(slug, name)), service_accounts(label, login_email, username, provider_id, email_address_id, base_cost_amount, base_cost_currency, two_factor_url, spotify_family_plans(invite_url, address)), subscription_access_details(login_email, login_password, email_password, invitation_email, profile_label, notes, visible_to_customer, visible_fields)", { count: "exact" })

  subscriptionQuery = showCanceled
    ? subscriptionQuery.in("status", ["canceled", "inactive"])
    : subscriptionQuery.not("status", "in", "(canceled,inactive)")

  if (platform !== "all") {
    const { data: service } = await supabase
      .from("services")
      .select("id")
      .eq("slug", platform)
      .maybeSingle()
    const { data: platformProducts } = service
      ? await supabase.from("products").select("id").eq("service_id", service.id)
      : { data: [] }
    productIds = (platformProducts ?? []).map((product) => product.id)

    if (productIds.length === 0) {
      return { rows: [] as SubscriptionRow[], total: 0, activeTotal: 0 }
    }
    subscriptionQuery = subscriptionQuery.in("product_id", productIds)
  }

  let activeCountQuery = supabase
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .not("status", "in", "(canceled,inactive)")
    .gte("ends_on", today)
  if (productIds) activeCountQuery = activeCountQuery.in("product_id", productIds)
  const activeTotalPromise = activeCountQuery.then(({ count, error }) => {
    if (error) throw error
    return count ?? 0
  })

  const search = query.replace(/[(),%]/g, "").trim()
  if (search) {
    const pattern = `%${search}%`
    const telegramPattern = `%${search.replace(/^@/, "").toLowerCase()}%`
    const phoneSearch = /^\+?[\d\s-]+$/.test(search)
      ? search.replace(/\D/g, "")
      : ""
    const customerFilters = [
      `phone.ilike.${pattern}`,
      `phone_e164.ilike.${pattern}`,
      `phone_normalized.ilike.${pattern}`,
      `telegram_username.ilike.${telegramPattern}`,
    ]
    if (phoneSearch) {
      const phonePattern = `%${phoneSearch}%`
      customerFilters.push(
        `phone_e164.ilike.${phonePattern}`,
        `phone_normalized.ilike.${phonePattern}`
      )
    }
    const [{ data: customers }, { data: accounts }, { data: details }] = await Promise.all([
      supabase
        .from("customers")
        .select("id")
        .or(customerFilters.join(",")),
      supabase
        .from("service_accounts")
        .select("id")
        .or(`login_email.ilike.${pattern},username.ilike.${pattern}`),
      supabase
        .from("subscription_access_details")
        .select("subscription_id")
        .or(`login_email.ilike.${pattern},invitation_email.ilike.${pattern}`),
    ])
    const filters = [
      customers?.length ? `customer_id.in.(${customers.map((item) => item.id).join(",")})` : null,
      accounts?.length ? `service_account_id.in.(${accounts.map((item) => item.id).join(",")})` : null,
      details?.length ? `id.in.(${details.map((item) => item.subscription_id).join(",")})` : null,
    ].filter(Boolean)

    if (filters.length === 0) {
      return {
        rows: [] as SubscriptionRow[],
        total: 0,
        activeTotal: await activeTotalPromise,
      }
    }
    subscriptionQuery = subscriptionQuery.or(filters.join(","))
  }

  const from = (Math.max(1, page) - 1) * SUBSCRIPTIONS_PAGE_SIZE
  const [{ data: subscriptions, count, error }, activeTotal] = await Promise.all([
    subscriptionQuery
      .order("ends_on")
      .range(from, from + SUBSCRIPTIONS_PAGE_SIZE - 1),
    activeTotalPromise,
  ])

  if (error) throw error

  const accountIds = [
    ...new Set((subscriptions ?? []).map((item) => item.service_account_id).filter(Boolean)),
  ] as string[]
  const subscriptionIds = (subscriptions ?? []).map((item) => item.id)
  const [
    { data: credentials },
    { data: purchaseCosts },
    { data: emailUsages },
  ] = await Promise.all([
    accountIds.length
      ? supabase
          .from("account_credentials")
          .select("service_account_id, secret_payload")
          .in("service_account_id", accountIds)
      : Promise.resolve({ data: [] }),
    subscriptionIds.length
      ? supabase
          .from("costs")
          .select("subscription_id, provider_id, amount, currency")
          .eq("cost_type", "purchase")
          .in("subscription_id", subscriptionIds)
      : Promise.resolve({ data: [] }),
    subscriptionIds.length
      ? supabase
          .from("email_usages")
          .select("subscription_id, email_address_id")
          .in("subscription_id", subscriptionIds)
          .is("ended_at", null)
      : Promise.resolve({ data: [] }),
  ])
  const credentialsByAccountId = new Map(
    (credentials ?? []).map((item) => [item.service_account_id, item])
  )
  const purchaseCostsBySubscription = new Map(
    (purchaseCosts ?? []).map((cost) => [cost.subscription_id, cost])
  )
  const managedEmailBySubscription = new Map(
    (emailUsages ?? []).map((usage) => [
      usage.subscription_id,
      usage.email_address_id,
    ])
  )
  const rows: SubscriptionRow[] = (subscriptions ?? []).map((subscription) => {
    const customer = one(subscription.customers)
    const product = one(subscription.products)
    const service = one(product?.services ?? null)
    const account = one(subscription.service_accounts)
    const detail = one(subscription.subscription_access_details)
    const purchaseCost = purchaseCostsBySubscription.get(subscription.id)

    return {
      id: subscription.id,
      customerId: customer?.id ?? "",
      customerCountryId: customer?.country_id ?? "",
      customerName: customer?.display_name ?? "Cliente",
      customerPhone: customer?.phone ?? null,
      customerPhoneE164: customer?.phone_e164 ?? null,
      customerPhoneNormalized: customer?.phone_normalized ?? null,
      customerTelegram: customer?.telegram_username ?? null,
      productId: subscription.product_id,
      productName: product?.name ?? "Item",
      serviceName: service?.name ?? "Servicio",
      serviceSlug: service?.slug ?? "",
      serviceAccountId: subscription.service_account_id,
      accountLabel: account?.label ?? null,
      account: account
        ? {
            login_email: account.login_email,
            username: account.username,
            provider_id: account.provider_id,
            email_address_id: account.email_address_id,
            base_cost_amount: account.base_cost_amount,
            base_cost_currency: account.base_cost_currency,
            two_factor_url: account.two_factor_url,
            account_credentials:
              credentialsByAccountId.get(subscription.service_account_id ?? "") ?? null,
            spotify_family_plans: one(account.spotify_family_plans),
          }
        : null,
      slotLabel: subscription.slot_label,
      status:
        ["canceled", "inactive"].includes(subscription.status)
          ? subscription.status
          : subscription.ends_on < today
            ? "expired"
            : "active",
      startsOn: subscription.starts_on,
      endsOn: subscription.ends_on,
      durationMonths: subscription.duration_months,
      currentPriceAmount: subscription.current_price_amount,
      currentPriceCurrency: subscription.current_price_currency ?? "BOB",
      currentExchangeRate: subscription.current_exchange_rate,
      hasPurchaseCost: Boolean(purchaseCost),
      purchaseCost: purchaseCost
        ? {
            providerId: purchaseCost.provider_id,
            amount: purchaseCost.amount,
            currency: purchaseCost.currency,
          }
        : null,
      managedEmailId:
        managedEmailBySubscription.get(subscription.id) ??
        account?.email_address_id ??
        null,
      notes: subscription.notes,
      detail: detail ?? null,
    }
  })

  return { rows, total: count ?? 0, activeTotal }
}
