import { Card } from "@/components/ui/card"
import { requireAdmin } from "@/lib/auth"

import { getSubscriptionsPage } from "./data"
import { boliviaToday, renewalOverdue } from "./mother-access"
import { SubscriptionsManager } from "./subscriptions-manager"

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    account?: string
    member?: string
    new?: string
    product?: string
  }>
}) {
  const params = await searchParams
  const { supabase } = await requireAdmin()
  const today = boliviaToday()
  const [
    initialPage,
    { data: products },
    { data: accounts },
    { data: providers },
    { data: countries },
    { data: busySubscriptions },
    { data: spotifyMembers },
  ] = await Promise.all([
    getSubscriptionsPage(supabase),
    supabase
      .from("products")
      .select(
        "id, slug, name, default_duration_months, default_price_amount, default_price_currency, default_exchange_rate, purchase_mode, access_fields, default_purchase_amount, default_purchase_currency, default_purchase_exchange_rate, allow_account_reuse_on_cancel, is_default, services(id, slug, name, account_model, default_seat_capacity)"
      )
      .eq("status", "active")
      .order("name"),
    supabase
      .from("service_accounts")
      .select(
        "id, label, login_email, renewal_due_on, seat_capacity, services(slug, name, account_model), spotify_family_plans(seats_total)"
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
      .eq("status", "active"),
    supabase
      .from("spotify_member_accounts")
      .select("id, service_account_id, source_subscription_id, current_subscription_id, login_email, login_password, email_password, invitation_email, member_name, status, updated_at, source_subscription:subscriptions!spotify_member_accounts_source_subscription_id_fkey(customers(display_name), email_usages(email_address_id, ended_at))")
      .neq("status", "removed")
      .order("updated_at", { ascending: false }),
  ])

  const privateBusyAccountIds = new Set(
    (busySubscriptions ?? [])
      .filter((item) => one(item.products)?.slug !== "chatgpt_codex")
      .map((item) => item.service_account_id)
      .filter(Boolean)
  )
  const codexBusyAccountIds = new Set(
    (busySubscriptions ?? [])
      .filter((item) => one(item.products)?.slug === "chatgpt_codex")
      .map((item) => item.service_account_id)
      .filter(Boolean)
  )
  const accountUsage = new Map<string, { used: number; ownerAssigned: boolean }>()
  for (const subscription of busySubscriptions ?? []) {
    if (!subscription.service_account_id || one(subscription.products)?.slug === "chatgpt_codex") {
      continue
    }

    const current = accountUsage.get(subscription.service_account_id) ?? {
      used: 0,
      ownerAssigned: false,
    }
    if (one(subscription.products)?.slug !== "spotify_family_member") {
      current.used += 1
    }
    current.ownerAssigned ||= subscription.slot_label === "Titular"
    accountUsage.set(subscription.service_account_id, current)
  }

  for (const member of spotifyMembers ?? []) {
    const current = accountUsage.get(member.service_account_id) ?? {
      used: 0,
      ownerAssigned: false,
    }
    current.used += 1
    accountUsage.set(member.service_account_id, current)
  }

  for (const subscription of busySubscriptions ?? []) {
    if (!subscription.service_account_id || one(subscription.products)?.slug !== "spotify_family_member") {
      continue
    }
    if (subscription.slot_label === "Titular") {
      const current = accountUsage.get(subscription.service_account_id) ?? {
        used: 0,
        ownerAssigned: false,
      }
      current.used += 1
      current.ownerAssigned = true
      accountUsage.set(subscription.service_account_id, current)
    }
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
        accountModel: service?.account_model === "mother" ? ("mother" as const) : ("private" as const),
        defaultDurationMonths: product.default_duration_months ?? 1,
        defaultPriceAmount: product.default_price_amount ?? 0,
        defaultPriceCurrency: product.default_price_currency ?? "BOB",
        defaultExchangeRate: product.default_exchange_rate,
        purchaseMode: product.purchase_mode ?? "inventory",
        accessFields: product.access_fields ?? [],
        defaultPurchaseAmount: product.default_purchase_amount ?? 0,
        defaultPurchaseCurrency: product.default_purchase_currency ?? "USDT",
        defaultPurchaseExchangeRate: product.default_purchase_exchange_rate,
        allowAccountReuseOnCancel: product.allow_account_reuse_on_cancel ?? false,
        isDefault: product.is_default,
      }
    }) ?? []

  const accountOptions =
    accounts?.map((account) => {
      const service = one(account.services)
      const usage = accountUsage.get(account.id)
      const email = account.login_email ? ` · ${account.login_email}` : ""
      const overdue = renewalOverdue(
        service?.slug,
        account.renewal_due_on,
        today,
        service?.account_model
      )

      return {
        id: account.id,
        label: `${account.label}${email}`,
        serviceSlug: service?.slug ?? "",
        availableForSale: !privateBusyAccountIds.has(account.id) && !overdue,
        availableForCodex: !codexBusyAccountIds.has(account.id),
        renewalOverdue: overdue,
        seatsTotal: account.seat_capacity ?? null,
        seatsUsed: usage?.used ?? 0,
        ownerAssigned: usage?.ownerAssigned ?? false,
        accountModel: service?.account_model === "mother" ? ("mother" as const) : ("private" as const),
      }
    }) ?? []

  const accountLabels = new Map(
    (accounts ?? []).map((account) => [account.id, account.label ?? "Plan Spotify"])
  )
  const releasedSpotifyAccesses = (spotifyMembers ?? []).flatMap((member) => {
    if (member.status !== "available" || !member.source_subscription_id) return []
    const source = one(member.source_subscription)
    const emailUsage = source?.email_usages?.find((usage) => !usage.ended_at) ?? source?.email_usages?.[0]
    return [{
      memberAccountId: member.id,
      subscriptionId: member.source_subscription_id,
      serviceAccountId: member.service_account_id,
      serviceAccountLabel: accountLabels.get(member.service_account_id) ?? "Plan Spotify",
      customerName: one(source?.customers)?.display_name ?? "Sin nombre",
      loginEmail: member.login_email,
      memberName: member.member_name,
      loginPassword: member.login_password,
      emailPassword: member.email_password,
      invitationEmail: member.invitation_email,
      emailAddressId: emailUsage?.email_address_id ?? null,
      releasedOn: member.updated_at,
    }]
  })

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
  const assignmentAccount = accountOptions.find(
    (account) => account.id === params.account
  )
  const assignmentProduct = productOptions.find(
    (product) => product.slug === params.product
  )
  const assignment =
    params.new === "1" &&
    assignmentAccount &&
    assignmentProduct &&
    assignmentProduct.serviceSlug === assignmentAccount.serviceSlug
      ? {
          accountId: assignmentAccount.id,
          productSlug: assignmentProduct.slug,
          reusableAccessId: releasedSpotifyAccesses.find(
            (access) => access.subscriptionId === params.member && access.serviceAccountId === assignmentAccount.id
          )?.subscriptionId,
        }
      : undefined
  return (
    <Card className="min-w-0">
      <SubscriptionsManager
        accounts={accountOptions}
        assignment={assignment}
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
        releasedSpotifyAccesses={releasedSpotifyAccesses}
      />
    </Card>
  )
}
