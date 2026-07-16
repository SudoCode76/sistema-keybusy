import { Card } from "@/components/ui/card"
import { requireAdmin } from "@/lib/auth"

import { getSubscriptionsPage } from "./data"
import { SubscriptionsManager } from "./subscriptions-manager"

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export default async function SubscriptionsPage() {
  const { supabase } = await requireAdmin()
  const [
    initialPage,
    { data: products },
    { data: accounts },
    { data: providers },
    { data: countries },
    { data: busySubscriptions },
  ] = await Promise.all([
    getSubscriptionsPage(supabase),
    supabase
      .from("products")
      .select(
        "id, slug, name, default_duration_months, default_price_amount, default_price_currency, default_exchange_rate, purchase_mode, access_fields, default_purchase_amount, default_purchase_currency, default_purchase_exchange_rate, is_default, services(id, slug, name)"
      )
      .eq("status", "active")
      .order("name"),
    supabase
      .from("service_accounts")
      .select(
        "id, label, login_email, services(slug, name), spotify_family_plans(seats_total)"
      )
      .eq("status", "active")
      .order("label"),
    supabase
      .from("providers")
      .select("id, name, phone_e164, provider_services(service_id, services(name))")
      .eq("status", "active")
      .order("name"),
    supabase
      .from("countries")
      .select("id, iso2, name, dial_code")
      .eq("status", "active")
      .order("name"),
    supabase
      .from("subscriptions")
      .select("service_account_id, slot_label, products(slug)")
      .not("service_account_id", "is", null)
      .not("status", "in", "(canceled,inactive)"),
  ])

  const busyAccountIds = new Set(
    (busySubscriptions ?? [])
      .map((item) => item.service_account_id)
      .filter(Boolean)
  )
  const spotifyUsage = new Map<string, { used: number; ownerAssigned: boolean }>()
  for (const subscription of busySubscriptions ?? []) {
    if (!subscription.service_account_id || one(subscription.products)?.slug !== "spotify_family_member") {
      continue
    }

    const current = spotifyUsage.get(subscription.service_account_id) ?? {
      used: 0,
      ownerAssigned: false,
    }
    current.used += 1
    current.ownerAssigned ||= subscription.slot_label === "Titular"
    spotifyUsage.set(subscription.service_account_id, current)
  }

  const productOptions =
    products?.map((product) => {
      const service = one(product.services)

      return {
        id: product.id,
        serviceId: service?.id ?? "",
        slug: product.slug,
        name: product.name,
        serviceName: service?.name ?? "Servicio",
        serviceSlug: service?.slug ?? "",
        defaultDurationMonths: product.default_duration_months ?? 1,
        defaultPriceAmount: product.default_price_amount ?? 0,
        defaultPriceCurrency: product.default_price_currency ?? "BOB",
        defaultExchangeRate: product.default_exchange_rate,
        purchaseMode: product.purchase_mode ?? "inventory",
        accessFields: product.access_fields ?? [],
        defaultPurchaseAmount: product.default_purchase_amount ?? 0,
        defaultPurchaseCurrency: product.default_purchase_currency ?? "USDT",
        defaultPurchaseExchangeRate: product.default_purchase_exchange_rate,
        isDefault: product.is_default,
      }
    }) ?? []

  const accountOptions =
    accounts?.map((account) => {
      const service = one(account.services)
      const spotifyPlan = one(account.spotify_family_plans)
      const usage = spotifyUsage.get(account.id)
      const email = account.login_email ? ` · ${account.login_email}` : ""

      return {
        id: account.id,
        label: `${account.label}${email}`,
        serviceSlug: service?.slug ?? "",
        availableForSale: !busyAccountIds.has(account.id),
        seatsTotal: spotifyPlan?.seats_total ?? null,
        seatsUsed: usage?.used ?? 0,
        ownerAssigned: usage?.ownerAssigned ?? false,
      }
    }) ?? []

  const providerOptions =
    providers?.map((provider) => ({
      id: provider.id,
      name: provider.name,
      phoneE164: provider.phone_e164,
      serviceIds: provider.provider_services.map((item) => item.service_id),
      serviceNames: provider.provider_services
        .map((item) => one(item.services)?.name)
        .filter((name): name is string => Boolean(name)),
    })) ?? []

  const platforms = Array.from(
    new Map(
      productOptions
        .filter((product) => product.serviceSlug)
        .map((product) => [
          product.serviceSlug,
          { slug: product.serviceSlug, name: product.serviceName },
        ])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name))
  return (
    <Card>
      <SubscriptionsManager
        accounts={accountOptions}
        countries={countries ?? []}
        defaultCountryId={
          countries?.find((country) => country.iso2 === "BO")?.id
        }
        initialActiveTotal={initialPage.activeTotal}
        initialRows={initialPage.rows}
        initialTotal={initialPage.total}
        platforms={platforms}
        products={productOptions}
        providers={providerOptions}
      />
    </Card>
  )
}
