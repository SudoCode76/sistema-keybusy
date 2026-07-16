import type { createClient } from "@/lib/supabase/server"

type ServerClient = Awaited<ReturnType<typeof createClient>>

export type ExistingAccess = {
  id: string
  serviceId: string
  serviceName: string
  productSlug: string
  productName: string
  startsOn: string
  endsOn: string
  status: "active" | "expired"
}

export type ExistingPrivateAccount = {
  id: string
  label: string
  loginEmail: string
  serviceName: string
  status: string
  available: boolean
  sale: {
    id: string
    customerName: string
    customerPhone: string | null
    productName: string
    startsOn: string
    endsOn: string
    status: "active" | "expired"
  } | null
}

export type DuplicateCheck = {
  target: {
    serviceId: string
    serviceName: string
    productName: string
    purchaseMode: string
  }
  customer: {
    id: string
    name: string
    phone: string | null
    telegramUsername: string | null
    contact: string
    accesses: ExistingAccess[]
  } | null
  matchingSales: ExistingAccess[]
  privateAccount: ExistingPrivateAccount | null
}

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value
}

export function accessStatus(
  endsOn: string,
  today = new Date().toISOString().slice(0, 10)
): "active" | "expired" {
  return endsOn < today ? "expired" : "active"
}

export function matchingServiceSales(
  accesses: ExistingAccess[],
  serviceId: string
) {
  return accesses.filter((access) => access.serviceId === serviceId)
}

export function resolveCustomerId(
  phoneCustomerId: string | null,
  telegramCustomerId: string | null
) {
  if (
    phoneCustomerId &&
    telegramCustomerId &&
    phoneCustomerId !== telegramCustomerId
  ) {
    throw new Error(
      "El teléfono y Telegram pertenecen a clientes diferentes"
    )
  }

  return phoneCustomerId ?? telegramCustomerId
}

async function findCustomer(
  supabase: ServerClient,
  countryId: string | null,
  phone: string,
  telegramUsername?: string | null
): Promise<DuplicateCheck["customer"]> {
  const telegram = String(telegramUsername ?? "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
  const phoneLookup =
    countryId && phone.trim()
      ? supabase.rpc("to_e164", { country_id: countryId, phone })
      : Promise.resolve({ data: null, error: null })
  const [{ data: phoneE164, error: phoneError }, telegramResult] =
    await Promise.all([
      phoneLookup,
      telegram
        ? supabase
            .from("customers")
            .select("id")
            .eq("telegram_username", telegram)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ])
  if (phoneError) throw phoneError
  if (telegramResult.error) throw telegramResult.error

  const phoneResult = phoneE164
    ? await supabase
        .from("customers")
        .select("id")
        .eq("phone_e164", phoneE164)
        .maybeSingle()
    : { data: null, error: null }
  if (phoneResult.error) throw phoneResult.error

  const customerId = resolveCustomerId(
    phoneResult.data?.id ?? null,
    telegramResult.data?.id ?? null
  )
  if (!customerId) return null

  const { data: customerRow, error: customerError } = await supabase
    .from("customers")
    .select("id, display_name, phone, phone_e164, telegram_username")
    .eq("id", customerId)
    .single()
  if (customerError) throw customerError

  const { data: subscriptions, error: subscriptionsError } = await supabase
    .from("subscriptions")
    .select(
      "id, starts_on, ends_on, products(service_id, slug, name, services(name))"
    )
    .eq("customer_id", customerRow.id)
    .not("status", "in", "(canceled,inactive)")
    .order("ends_on", { ascending: false })
  if (subscriptionsError) throw subscriptionsError

  return {
    id: customerRow.id,
    name: customerRow.display_name,
    phone: customerRow.phone_e164 ?? customerRow.phone ?? null,
    telegramUsername: customerRow.telegram_username,
    contact:
      customerRow.phone_e164 ??
      customerRow.phone ??
      `@${customerRow.telegram_username}`,
    accesses: (subscriptions ?? []).map((subscription) => {
      const product = one(subscription.products)
      const service = one(product?.services ?? null)

      return {
        id: subscription.id,
        serviceId: product?.service_id ?? "",
        serviceName: service?.name ?? "Servicio",
        productSlug: product?.slug ?? "",
        productName: product?.name ?? "Ítem",
        startsOn: subscription.starts_on,
        endsOn: subscription.ends_on,
        status: accessStatus(subscription.ends_on),
      }
    }),
  }
}

async function findPrivateAccount(
  supabase: ServerClient,
  {
    serviceId,
    serviceName,
    purchaseMode,
    loginEmail,
  }: {
    serviceId: string
    serviceName: string
    purchaseMode: string
    loginEmail?: string | null
  }
): Promise<ExistingPrivateAccount | null> {
  const normalizedEmail = loginEmail?.trim().toLowerCase()
  if (purchaseMode !== "individual" || !normalizedEmail) return null

  const { data: accounts, error: accountError } = await supabase
    .from("service_accounts")
    .select("id, label, login_email, status")
    .eq("service_id", serviceId)
    .not("login_email", "is", null)
  if (accountError) throw accountError

  const account = accounts?.find(
    (item) => item.login_email?.trim().toLowerCase() === normalizedEmail
  )
  if (!account) return null

  const { data: usedSale, error: usedSaleError } = await supabase
    .from("subscriptions")
    .select(
      "id, starts_on, ends_on, customers(display_name, phone, phone_e164), products(name)"
    )
    .eq("service_account_id", account.id)
    .not("status", "in", "(canceled,inactive)")
    .order("ends_on", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (usedSaleError) throw usedSaleError

  const customer = one(usedSale?.customers ?? null)
  const product = one(usedSale?.products ?? null)

  return {
    id: account.id,
    label: account.label,
    loginEmail: account.login_email ?? normalizedEmail,
    serviceName,
    status: account.status,
    available: account.status === "active" && !usedSale,
    sale: usedSale
      ? {
          id: usedSale.id,
          customerName: customer?.display_name ?? "Cliente",
          customerPhone: customer?.phone_e164 ?? customer?.phone ?? null,
          productName: product?.name ?? "Ítem",
          startsOn: usedSale.starts_on,
          endsOn: usedSale.ends_on,
          status: accessStatus(usedSale.ends_on),
        }
      : null,
  }
}

export async function checkSaleDuplicates(
  supabase: ServerClient,
  {
    countryId,
    phone,
    telegramUsername,
    productSlug,
    loginEmail,
  }: {
    countryId: string | null
    phone: string
    telegramUsername?: string | null
    productSlug: string
    loginEmail?: string | null
  }
): Promise<DuplicateCheck> {
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("service_id, name, purchase_mode, services(name)")
    .eq("slug", productSlug)
    .eq("status", "active")
    .single()
  if (productError || !product) {
    throw productError ?? new Error("Ítem vendible inválido")
  }

  const service = one(product.services)
  const target = {
    serviceId: product.service_id,
    serviceName: service?.name ?? product.name,
    productName: product.name,
    purchaseMode: product.purchase_mode,
  }
  const [customer, privateAccount] = await Promise.all([
    findCustomer(supabase, countryId, phone, telegramUsername),
    findPrivateAccount(supabase, { ...target, loginEmail }),
  ])

  return {
    target,
    customer,
    matchingSales: matchingServiceSales(
      customer?.accesses ?? [],
      target.serviceId
    ),
    privateAccount,
  }
}
