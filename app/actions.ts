"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import {
  checkSaleDuplicates,
  resolveCustomerId,
  type DuplicateCheck,
} from "@/app/admin/subscriptions/duplicate-check"
import { requireAdmin, requireUser } from "@/lib/auth"
import { fetchBinanceAverage } from "@/lib/binance"
import { formNumber, formText, toMoneyValues, type Currency } from "@/lib/money"
import {
  isValidTelegramUsername,
  normalizeTelegramUsername,
} from "@/lib/phone"
import { createClient } from "@/lib/supabase/server"

type AuthState = {
  error?: string
  message?: string
}

type SaleState = {
  conflict?: {
    kind: "active_sale" | "expired_sale" | "private_account"
    productSlug: string
    phone: string
    telegramUsername: string
    countryId: string | null
    loginEmail?: string
    message: string
    check: DuplicateCheck
  }
  error?: string
  message?: string
}

export type EmailState = {
  error?: string
  message?: string
}

export type ProviderState = {
  error?: string
  provider?: {
    id: string
    name: string
    phoneE164: string | null
  }
}

export type PurchaseCostState = {
  error?: string
  message?: string
}

type ServerClient = Awaited<ReturnType<typeof createClient>>

type ManagedEmail = {
  id: string
  email: string
  email_password: string | null
  origin: string
  provider_id: string | null
  status: string
}

function currency(value: FormDataEntryValue | null): Currency {
  return value === "USDT" ? "USDT" : "BOB"
}

function addMonths(date: string, months: number) {
  const next = new Date(`${date}T00:00:00`)
  next.setMonth(next.getMonth() + months)
  return next.toISOString().slice(0, 10)
}

function requireValue(value: FormDataEntryValue | null, name: string) {
  const text = formText(value)
  if (!text) {
    throw new Error(`${name} es obligatorio`)
  }
  return text
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

function optionalId(value: FormDataEntryValue | null) {
  const text = formText(value)
  return text === "none" ? null : text
}

function purchaseMode(value: FormDataEntryValue | null) {
  const text = formText(value)
  return text === "individual" || text === "linked" ? text : "inventory"
}

function accessFields(formData: FormData) {
  const allowed = new Set([
    "login_email",
    "login_password",
    "email_password",
    "profile_label",
    "invitation_email",
    "two_factor_url",
  ])
  return formData
    .getAll("access_fields")
    .map(String)
    .filter((field) => allowed.has(field))
}

async function insertOrThrow<T>(
  query: PromiseLike<{ error: unknown; data: T | null }>
) {
  const { error, data } = await query
  if (error) {
    throw error
  }
  return data as T
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function parseSecretPayload(payload: string | null) {
  const values: Record<string, string> = {}
  for (const line of payload?.split(/\r?\n/) ?? []) {
    const [key, ...parts] = line.split(":")
    const value = parts.join(":").trim()
    if (key?.trim() && value) values[key.trim()] = value
  }
  return values
}

function mergeSecretPayload(
  payload: string | null,
  updates: Record<string, string | null>
) {
  const values = new Map(Object.entries(parseSecretPayload(payload)))
  for (const [key, value] of Object.entries(updates)) {
    if (value) values.set(key, value)
  }
  return [...values].map(([key, value]) => `${key}: ${value}`).join("\n")
}

async function spotifyOwnerCredentials(
  supabase: ServerClient,
  serviceAccountId: string
) {
  const [
    { data: account, error: accountError },
    { data: credential, error: credentialError },
  ] = await Promise.all([
    supabase
      .from("service_accounts")
      .select("login_email")
      .eq("id", serviceAccountId)
      .single(),
    supabase
      .from("account_credentials")
      .select("secret_payload")
      .eq("service_account_id", serviceAccountId)
      .maybeSingle(),
  ])

  if (accountError || !account) {
    throw accountError ?? new Error("Cuenta madre Spotify no encontrada")
  }
  if (credentialError) throw credentialError

  const secrets = parseSecretPayload(credential?.secret_payload ?? null)
  return {
    loginEmail: account.login_email,
    loginPassword: secrets.platform_password ?? secrets.password ?? null,
    emailPassword: secrets.email_password ?? null,
  }
}

async function selectedManagedEmail(
  supabase: ServerClient,
  formData: FormData
): Promise<ManagedEmail | null> {
  if (formText(formData.get("managed_email_mode")) !== "existing") return null

  const id = requireValue(formData.get("email_address_id"), "Correo")
  const { data, error } = await supabase
    .from("email_addresses")
    .select("id, email, email_password, origin, provider_id, status")
    .eq("id", id)
    .eq("origin", "self")
    .eq("status", "active")
    .single()

  if (error || !data) throw error ?? new Error("Correo no encontrado")
  return data
}

async function resolveInventoryEmail(
  supabase: ServerClient,
  formData: FormData
): Promise<ManagedEmail | null> {
  const mode = formText(formData.get("managed_email_mode"))
  if (mode === "existing") {
    const managed = await selectedManagedEmail(supabase, formData)
    const password = formText(formData.get("email_password"))

    if (password && managed) {
      await insertOrThrow(
        supabase
          .from("email_addresses")
          .update({ email_password: password })
          .eq("id", managed.id)
      )
      managed.email_password = password
    }
    return managed
  }

  const email = formText(formData.get("login_email"))
  if (!email) return null

  const origin =
    formText(formData.get("email_origin")) === "provider" ? "provider" : "self"
  const providerId =
    origin === "provider" ? optionalId(formData.get("email_provider_id")) : null
  const result = await supabase
    .from("email_addresses")
    .insert({
      email: email.trim(),
      email_password: formText(formData.get("email_password")),
      origin,
      provider_id: providerId,
    })
    .select("id, email, email_password, origin, provider_id, status")
    .single()

  if (result.error || !result.data) {
    throw new Error(
      result.error?.code === "23505"
        ? "Este correo ya está registrado. Selecciónalo como existente."
        : (result.error?.message ?? "No se pudo guardar el correo")
    )
  }
  return result.data
}

async function syncInventoryEmailUsage(
  supabase: ServerClient,
  {
    serviceAccountId,
    email,
    purpose,
    platformPassword,
  }: {
    serviceAccountId: string
    email: ManagedEmail | null
    purpose: string
    platformPassword: string | null
  }
) {
  const { data: current } = await supabase
    .from("email_usages")
    .select("id, email_address_id, platform_password")
    .eq("service_account_id", serviceAccountId)
    .is("subscription_id", null)
    .is("ended_at", null)
    .maybeSingle()

  if (current && current.email_address_id !== email?.id) {
    await insertOrThrow(
      supabase
        .from("email_usages")
        .update({ ended_at: new Date().toISOString() })
        .eq("id", current.id)
    )
  }

  if (!email) return

  if (current && current.email_address_id === email.id) {
    await insertOrThrow(
      supabase
        .from("email_usages")
        .update({
          purpose,
          platform_password: platformPassword ?? current.platform_password,
        })
        .eq("id", current.id)
    )
    return
  }

  await insertOrThrow(
    supabase.from("email_usages").insert({
      email_address_id: email.id,
      service_account_id: serviceAccountId,
      purpose,
      platform_password: platformPassword,
    })
  )
}

async function syncSubscriptionEmailUsage(
  supabase: ServerClient,
  {
    subscriptionId,
    productId,
    loginEmail,
    platformPassword,
    managedEmail,
  }: {
    subscriptionId: string
    productId: string
    loginEmail: string | null
    platformPassword: string | null
    managedEmail?: ManagedEmail | null
  }
) {
  const [{ data: current }, { data: product }] = await Promise.all([
    supabase
      .from("email_usages")
      .select("id, email_address_id, platform_password")
      .eq("subscription_id", subscriptionId)
      .is("ended_at", null)
      .maybeSingle(),
    supabase.from("products").select("name").eq("id", productId).maybeSingle(),
  ])
  const normalized = loginEmail ? normalizeEmail(loginEmail) : null
  const { data: foundEmail } =
    !managedEmail && normalized
      ? await supabase
          .from("email_addresses")
          .select("id, email_password")
          .eq("email_normalized", normalized)
          .eq("origin", "self")
          .eq("status", "active")
          .maybeSingle()
      : { data: null }
  const email = managedEmail ?? foundEmail

  if (current && current.email_address_id !== email?.id) {
    await insertOrThrow(
      supabase
        .from("email_usages")
        .update({ ended_at: new Date().toISOString() })
        .eq("id", current.id)
    )
  }

  if (!email) return null

  if (current && current.email_address_id === email.id) {
    await insertOrThrow(
      supabase
        .from("email_usages")
        .update({
          purpose: product?.name ?? "Acceso",
          platform_password: platformPassword ?? current.platform_password,
        })
        .eq("id", current.id)
    )
  } else {
    await insertOrThrow(
      supabase.from("email_usages").insert({
        email_address_id: email.id,
        subscription_id: subscriptionId,
        purpose: product?.name ?? "Acceso",
        platform_password: platformPassword,
      })
    )
  }

  return email.email_password
}

export async function authenticate(
  _state: AuthState,
  formData: FormData
): Promise<AuthState> {
  const supabase = await createClient()
  const email = requireValue(formData.get("email"), "Email")
  const password = requireValue(formData.get("password"), "Password")
  const intent = formData.get("intent")
  const fullName = formText(formData.get("full_name"))

  const result =
    intent === "signup"
      ? await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName ?? email } },
        })
      : await supabase.auth.signInWithPassword({ email, password })

  if (result.error) {
    return {
      error:
        result.error.message === "Invalid login credentials"
          ? "No existe una cuenta con esos datos. Usa Crear si es tu primer ingreso."
          : result.error.message,
    }
  }

  if (intent === "signup" && !result.data.session) {
    return {
      message: "Cuenta creada. Revisa tu email para confirmar el acceso.",
    }
  }

  redirect("/admin")
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}

export async function claimFirstAdmin() {
  const { supabase } = await requireUser()
  const { error } = await supabase.rpc("claim_first_admin")

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/admin")
  redirect("/admin")
}

export async function createCustomer(formData: FormData) {
  const { supabase } = await requireAdmin()
  const phone = formText(formData.get("phone"))
  const telegramRaw = formText(formData.get("telegram_username"))
  const telegramUsername = normalizeTelegramUsername(telegramRaw)
  const countryId = phone ? formText(formData.get("country_id")) : null
  let phoneCustomerId: string | null = null
  let telegramCustomerId: string | null = null

  if (!phone && !telegramUsername) {
    throw new Error("Ingresa un teléfono o un usuario de Telegram")
  }
  if (telegramRaw && !isValidTelegramUsername(telegramRaw)) {
    throw new Error(
      "Telegram debe tener entre 5 y 32 letras, números o guion bajo"
    )
  }
  if (phone && !countryId) throw new Error("Pais es obligatorio")

  if (phone && countryId) {
    const { data: phoneE164, error: phoneError } = await supabase.rpc(
      "to_e164",
      {
        country_id: countryId,
        phone,
      }
    )

    if (phoneError) {
      throw phoneError
    }

    if (phoneE164) {
      const { data: existing, error: existingError } = await supabase
        .from("customers")
        .select("id")
        .eq("phone_e164", phoneE164)
        .maybeSingle()

      if (existingError) {
        throw existingError
      }

      phoneCustomerId = existing?.id ?? null
    }
  }

  if (telegramUsername) {
    const { data: existing, error: existingError } = await supabase
      .from("customers")
      .select("id")
      .eq("telegram_username", telegramUsername)
      .maybeSingle()
    if (existingError) throw existingError
    telegramCustomerId = existing?.id ?? null
  }

  const existingId = resolveCustomerId(phoneCustomerId, telegramCustomerId)

  const values = {
    display_name: requireValue(formData.get("display_name"), "Cliente"),
    email: formText(formData.get("email")),
    ...(phone ? { phone, country_id: countryId } : {}),
    ...(telegramUsername ? { telegram_username: telegramUsername } : {}),
    notes: formText(formData.get("notes")),
  }

  await insertOrThrow(
    (existingId
      ? supabase.from("customers").update(values).eq("id", existingId)
      : supabase.from("customers").insert(values)
    )
      .select("id")
      .single()
  )

  revalidatePath("/admin/customers")
  revalidatePath("/admin/subscriptions")
}

async function insertProviderFromForm(
  supabase: ServerClient,
  formData: FormData,
  serviceIds: string[]
) {
  const countryId = requireValue(formData.get("country_id"), "Pais")
  const phone = requireValue(formData.get("phone"), "Telefono")

  if (serviceIds.length === 0) {
    throw new Error("Elige al menos un servicio")
  }

  const { data: country, error: countryError } = await supabase
    .from("countries")
    .select("dial_code")
    .eq("id", countryId)
    .single()

  if (countryError || !country) {
    throw countryError ?? new Error("Pais no encontrado")
  }

  const providerName =
    formText(formData.get("name")) ??
    `+${country.dial_code}${phone.replace(/\D/g, "")}`

  const provider = await insertOrThrow<{ id: string; phone_e164: string | null }>(
    supabase
      .from("providers")
      .insert({
        name: providerName,
        country_id: countryId,
        phone,
        notes: formText(formData.get("notes")),
      })
      .select("id, phone_e164")
      .single()
  )

  await insertOrThrow(
    supabase
      .from("provider_services")
      .insert(
        serviceIds.map((serviceId) => ({
          provider_id: provider.id,
          service_id: serviceId,
        }))
      )
      .select("provider_id")
      .limit(1)
      .single()
  )

  return { id: provider.id, name: providerName, phoneE164: provider.phone_e164 }
}

export async function createProvider(formData: FormData) {
  const { supabase } = await requireAdmin()
  await insertProviderFromForm(
    supabase,
    formData,
    formData.getAll("service_ids").map(String)
  )

  revalidatePath("/admin/providers")
}

export async function createQuickProvider(
  _state: ProviderState,
  formData: FormData
): Promise<ProviderState> {
  const { supabase } = await requireAdmin()

  try {
    const provider = await insertProviderFromForm(supabase, formData, [
      requireValue(formData.get("service_id"), "Plataforma"),
    ])

    revalidatePath("/admin/providers")
    revalidatePath("/admin/subscriptions")
    return { provider }
  } catch (error) {
    return {
      error:
        error && typeof error === "object" && "message" in error
          ? String(error.message)
          : "No se pudo guardar el proveedor",
    }
  }
}

export async function createCountry(formData: FormData) {
  const { supabase } = await requireAdmin()

  await insertOrThrow(
    supabase
      .from("countries")
      .insert({
        iso2: requireValue(formData.get("iso2"), "ISO").toUpperCase(),
        name: requireValue(formData.get("name"), "Pais"),
        dial_code: requireValue(formData.get("dial_code"), "Codigo"),
      })
      .select("id")
      .single()
  )

  revalidatePath("/admin/providers")
  revalidatePath("/admin/subscriptions")
}

export async function createService(formData: FormData) {
  const { supabase } = await requireAdmin()
  const name = requireValue(formData.get("name"), "Servicio")

  await insertOrThrow(
    supabase
      .from("services")
      .insert({
        name,
        slug: formText(formData.get("slug")) ?? slugify(name),
        description: formText(formData.get("description")),
      })
      .select("id")
      .single()
  )

  revalidatePath("/admin/services")
}

export async function createPlatformWithProduct(formData: FormData) {
  const { supabase } = await requireAdmin()
  const platformName = requireValue(formData.get("platform_name"), "Plataforma")
  const productName = requireValue(formData.get("product_name"), "Item")
  const mode =
    formData.get("purchase_mode") === "individual" ? "individual" : "inventory"
  const platformSlug = slugify(
    formText(formData.get("platform_slug")) ?? platformName
  ).replaceAll("_", "-")
  const productSlug = slugify(
    formText(formData.get("product_slug")) ?? productName
  )
  const { error } = await supabase.rpc("create_platform_with_product", {
    p_platform_name: platformName,
    p_platform_slug: platformSlug,
    p_description: formText(formData.get("description")),
    p_product_name: productName,
    p_product_slug: productSlug,
    p_product_type: formText(formData.get("product_type")) ?? "profile",
    p_purchase_mode: mode,
    p_access_fields: accessFields(formData),
    p_duration_months: formNumber(formData.get("default_duration_months"), 1),
    p_sale_amount: formNumber(formData.get("default_price_amount")),
    p_sale_currency: currency(formData.get("default_price_currency")),
    p_sale_exchange_rate:
      formNumber(formData.get("default_exchange_rate")) || null,
    p_purchase_amount: formNumber(formData.get("default_purchase_amount")),
    p_purchase_currency: currency(formData.get("default_purchase_currency")),
    p_purchase_exchange_rate:
      formNumber(formData.get("default_purchase_exchange_rate")) || null,
  })

  if (error) {
    throw new Error(
      error.code === "23505"
        ? "La plataforma o el item ya existe"
        : error.message
    )
  }

  revalidatePath("/admin/services")
  revalidatePath("/admin/subscriptions")
  revalidatePath("/admin/accounts")
  redirect("/admin/services?saved=1")
}

export async function createProduct(formData: FormData) {
  const { supabase } = await requireAdmin()
  const name = requireValue(formData.get("name"), "Producto")

  await insertOrThrow(
    supabase
      .from("products")
      .insert({
        service_id: requireValue(formData.get("service_id"), "Servicio"),
        name,
        slug: formText(formData.get("slug")) ?? slugify(name),
        product_type: formText(formData.get("product_type")) ?? "profile",
        default_duration_months: formNumber(
          formData.get("default_duration_months"),
          1
        ),
        default_price_amount: formNumber(formData.get("default_price_amount")),
        default_price_currency: currency(
          formData.get("default_price_currency")
        ),
        default_exchange_rate:
          formNumber(formData.get("default_exchange_rate")) || null,
        purchase_mode: purchaseMode(formData.get("purchase_mode")),
        access_fields: accessFields(formData),
        default_purchase_amount: formNumber(
          formData.get("default_purchase_amount")
        ),
        default_purchase_currency: currency(
          formData.get("default_purchase_currency")
        ),
        default_purchase_exchange_rate:
          formNumber(formData.get("default_purchase_exchange_rate")) || null,
      })
      .select("id")
      .single()
  )

  revalidatePath("/admin/services")
  revalidatePath("/admin/subscriptions")
  redirect("/admin/services?saved=1")
}

export async function updateProductPrice(formData: FormData) {
  const { supabase } = await requireAdmin()

  await insertOrThrow(
    supabase
      .from("products")
      .update({
        service_id: requireValue(formData.get("service_id"), "Servicio"),
        name: requireValue(formData.get("name"), "Producto"),
        slug:
          formText(formData.get("slug")) ??
          slugify(requireValue(formData.get("name"), "Producto")),
        product_type: formText(formData.get("product_type")) ?? "profile",
        default_duration_months: formNumber(
          formData.get("default_duration_months"),
          1
        ),
        default_price_amount: formNumber(formData.get("default_price_amount")),
        default_price_currency: currency(
          formData.get("default_price_currency")
        ),
        default_exchange_rate:
          formNumber(formData.get("default_exchange_rate")) || null,
        purchase_mode: purchaseMode(formData.get("purchase_mode")),
        access_fields: accessFields(formData),
        default_purchase_amount: formNumber(
          formData.get("default_purchase_amount")
        ),
        default_purchase_currency: currency(
          formData.get("default_purchase_currency")
        ),
        default_purchase_exchange_rate:
          formNumber(formData.get("default_purchase_exchange_rate")) || null,
      })
      .eq("id", requireValue(formData.get("id"), "Producto"))
      .select("id")
      .single()
  )

  revalidatePath("/admin/services")
  revalidatePath("/admin/subscriptions")
  redirect("/admin/services?saved=1")
}

export async function setServiceStatus(formData: FormData) {
  const { supabase } = await requireAdmin()
  const status = formData.get("status") === "inactive" ? "inactive" : "active"
  const id = requireValue(formData.get("id"), "Servicio")

  await insertOrThrow(
    supabase
      .from("services")
      .update({ status })
      .eq("id", id)
      .select("id")
      .single()
  )

  if (status === "inactive") {
    const { error } = await supabase
      .from("products")
      .update({ status })
      .eq("service_id", id)

    if (error) {
      throw error
    }
  }

  revalidatePath("/admin/services")
  revalidatePath("/admin/subscriptions")
}

export async function setProductStatus(formData: FormData) {
  const { supabase } = await requireAdmin()
  const status = formData.get("status") === "inactive" ? "inactive" : "active"

  await insertOrThrow(
    supabase
      .from("products")
      .update({ status })
      .eq("id", requireValue(formData.get("id"), "Producto"))
      .select("id")
      .single()
  )

  revalidatePath("/admin/services")
  revalidatePath("/admin/subscriptions")
}

export async function setDefaultProduct(formData: FormData) {
  const { supabase } = await requireAdmin()
  const { error } = await supabase.rpc("set_default_product", {
    p_product_id: requireValue(formData.get("id"), "Producto"),
  })

  if (error) throw new Error(error.message)

  revalidatePath("/admin/services")
  revalidatePath("/admin/subscriptions")
}

export async function createManagedEmail(
  _state: EmailState,
  formData: FormData
): Promise<EmailState> {
  const { supabase } = await requireAdmin()
  const origin =
    formText(formData.get("origin")) === "provider" ? "provider" : "self"
  const result = await supabase
    .from("email_addresses")
    .insert({
      email: requireValue(formData.get("email"), "Correo").trim(),
      email_password: formText(formData.get("email_password")),
      origin,
      provider_id:
        origin === "provider" ? optionalId(formData.get("provider_id")) : null,
      status: formData.get("status") === "inactive" ? "inactive" : "active",
      notes: formText(formData.get("notes")),
    })
    .select("id")
    .single()

  if (result.error) {
    return {
      error:
        result.error.code === "23505"
          ? "Este correo ya está registrado."
          : result.error.message,
    }
  }

  revalidatePath("/admin/emails")
  revalidatePath("/admin/subscriptions")
  revalidatePath("/admin/accounts")
  return { message: "Correo guardado." }
}

export async function updateManagedEmail(
  _state: EmailState,
  formData: FormData
): Promise<EmailState> {
  const { supabase } = await requireAdmin()
  const id = requireValue(formData.get("id"), "Correo")
  const email = requireValue(formData.get("email"), "Correo").trim()
  const emailPassword = formText(formData.get("email_password"))
  const origin =
    formText(formData.get("origin")) === "provider" ? "provider" : "self"
  const result = await supabase
    .from("email_addresses")
    .update({
      email,
      email_password: emailPassword,
      origin,
      provider_id:
        origin === "provider" ? optionalId(formData.get("provider_id")) : null,
      status: formData.get("status") === "inactive" ? "inactive" : "active",
      notes: formText(formData.get("notes")),
    })
    .eq("id", id)
    .select("id")
    .single()

  if (result.error) {
    return {
      error:
        result.error.code === "23505"
          ? "Este correo ya está registrado."
          : result.error.message,
    }
  }

  const { data: usages } = await supabase
    .from("email_usages")
    .select("service_account_id, subscription_id")
    .eq("email_address_id", id)
    .is("ended_at", null)
  const accountIds = [
    ...new Set(
      (usages ?? []).map((usage) => usage.service_account_id).filter(Boolean)
    ),
  ] as string[]
  const subscriptionIds = [
    ...new Set(
      (usages ?? []).map((usage) => usage.subscription_id).filter(Boolean)
    ),
  ] as string[]

  if (accountIds.length) {
    await insertOrThrow(
      supabase
        .from("service_accounts")
        .update({ login_email: email })
        .in("id", accountIds)
    )
    const { data: credentials } = await supabase
      .from("account_credentials")
      .select("service_account_id, secret_payload")
      .in("service_account_id", accountIds)
    for (const credential of credentials ?? []) {
      await insertOrThrow(
        supabase
          .from("account_credentials")
          .update({
            secret_payload: mergeSecretPayload(credential.secret_payload, {
              email_password: emailPassword,
            }),
          })
          .eq("service_account_id", credential.service_account_id)
      )
    }
  }

  if (subscriptionIds.length) {
    await insertOrThrow(
      supabase
        .from("subscription_access_details")
        .update({ login_email: email, email_password: emailPassword })
        .in("subscription_id", subscriptionIds)
    )
  }

  revalidatePath("/admin/emails")
  revalidatePath("/admin/subscriptions")
  revalidatePath("/admin/accounts")
  return { message: "Correo actualizado." }
}

export async function createServiceAccount(formData: FormData) {
  const { supabase } = await requireAdmin()
  const amount = formNumber(formData.get("base_cost_amount"))
  const costCurrency = currency(formData.get("base_cost_currency"))
  let rate = formNumber(formData.get("base_cost_exchange_rate"))

  if (amount > 0 && !rate) {
    const result = await fetchBinanceAverage("BUY")
    rate = result.average

    const { error } = await supabase.from("exchange_rate_snapshots").insert({
      trade_type: "BUY",
      rows_requested: 20,
      average_price: result.average,
      raw_ads: result.ads,
    })

    if (error) {
      throw error
    }
  }

  const moneyValues = toMoneyValues(amount, costCurrency, rate || undefined)

  const providerId = optionalId(formData.get("provider_id"))
  const managedEmail = await resolveInventoryEmail(supabase, formData)
  const serviceId = requireValue(formData.get("service_id"), "Servicio")
  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("name, slug")
    .eq("id", serviceId)
    .single()
  if (serviceError || !service) {
    throw serviceError ?? new Error("Servicio no encontrado")
  }
  const accountResult = await supabase
    .from("service_accounts")
    .insert({
      service_id: serviceId,
      provider_id: providerId,
      email_address_id: managedEmail?.id ?? null,
      label: requireValue(formData.get("label"), "Cuenta"),
      login_email: managedEmail?.email ?? formText(formData.get("login_email")),
      base_cost_amount: amount,
      base_cost_currency: costCurrency,
      base_cost_exchange_rate: rate || null,
      base_cost_bob: moneyValues.bob,
      base_cost_usdt: moneyValues.usdt,
      two_factor_url: formText(formData.get("two_factor_url")),
      notes: formText(formData.get("notes")),
    })
    .select("id")
    .single()
  if (accountResult.error || !accountResult.data) {
    throw accountResult.error ?? new Error("No se guardo la cuenta")
  }
  const account = accountResult.data as { id: string }

  if (amount > 0) {
    await insertOrThrow(
      supabase.from("costs").insert({
        service_account_id: account.id,
        provider_id: providerId,
        cost_type: "purchase",
        amount,
        currency: costCurrency,
        exchange_rate: rate || null,
        amount_bob: moneyValues.bob,
        amount_usdt: moneyValues.usdt,
      })
    )
  }

  const platformPassword = formText(formData.get("platform_password"))
  const emailPassword =
    managedEmail?.email_password ?? formText(formData.get("email_password"))
  const legacySecret = formText(formData.get("secret_payload"))
  const secretPayload =
    legacySecret ??
    mergeSecretPayload(null, {
      platform_password: platformPassword,
      email_password: emailPassword,
    })

  if (secretPayload) {
    await insertOrThrow(
      supabase.from("account_credentials").insert({
        service_account_id: account.id,
        secret_payload: secretPayload,
      })
    )
  }

  const inviteUrl = formText(formData.get("invite_url"))
  const address = formText(formData.get("address"))
  if (service.slug === "spotify") {
    await insertOrThrow(
      supabase.from("spotify_family_plans").insert({
        service_account_id: account.id,
        invite_url: inviteUrl,
        address,
        seats_total: formNumber(formData.get("seats_total"), 6),
      })
    )
  }

  if (managedEmail) {
    await syncInventoryEmailUsage(supabase, {
      serviceAccountId: account.id,
      email: managedEmail,
      purpose: service?.name ?? requireValue(formData.get("label"), "Cuenta"),
      platformPassword,
    })
  }

  revalidatePath("/admin/accounts")
  revalidatePath("/admin/emails")
  revalidatePath("/admin/costs")
  revalidatePath("/admin")
  redirect("/admin/accounts?saved=1")
}

export async function updateServiceAccount(formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = requireValue(formData.get("id"), "Inventario")
  const amount = formNumber(formData.get("base_cost_amount"))
  const costCurrency = currency(formData.get("base_cost_currency"))
  let rate = formNumber(formData.get("base_cost_exchange_rate"))

  if (amount > 0 && !rate) {
    const result = await fetchBinanceAverage("BUY")
    rate = result.average

    await insertOrThrow(
      supabase.from("exchange_rate_snapshots").insert({
        trade_type: "BUY",
        rows_requested: 20,
        average_price: result.average,
        raw_ads: result.ads,
      })
    )
  }

  const moneyValues = toMoneyValues(amount, costCurrency, rate || undefined)
  const providerId = optionalId(formData.get("provider_id"))
  const managedEmail = await resolveInventoryEmail(supabase, formData)
  const serviceId = requireValue(formData.get("service_id"), "Servicio")
  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("name, slug")
    .eq("id", serviceId)
    .single()
  if (serviceError || !service) {
    throw serviceError ?? new Error("Servicio no encontrado")
  }

  await insertOrThrow(
    supabase
      .from("service_accounts")
      .update({
        service_id: serviceId,
        provider_id: providerId,
        email_address_id: managedEmail?.id ?? null,
        label: requireValue(formData.get("label"), "Cuenta"),
        login_email:
          managedEmail?.email ?? formText(formData.get("login_email")),
        base_cost_amount: amount,
        base_cost_currency: costCurrency,
        base_cost_exchange_rate: rate || null,
        base_cost_bob: moneyValues.bob,
        base_cost_usdt: moneyValues.usdt,
        two_factor_url: formText(formData.get("two_factor_url")),
        notes: formText(formData.get("notes")),
      })
      .eq("id", id)
      .select("id")
      .single()
  )

  const platformPassword = formText(formData.get("platform_password"))
  const emailPassword =
    managedEmail?.email_password ?? formText(formData.get("email_password"))
  const legacySecret = formText(formData.get("secret_payload"))
  const { data: currentCredential } = await supabase
    .from("account_credentials")
    .select("secret_payload")
    .eq("service_account_id", id)
    .maybeSingle()
  const secretPayload =
    legacySecret ??
    mergeSecretPayload(currentCredential?.secret_payload ?? null, {
      platform_password: platformPassword,
      email_password: emailPassword,
    })

  if (secretPayload) {
    await insertOrThrow(
      supabase
        .from("account_credentials")
        .upsert(
          {
            service_account_id: id,
            secret_payload: secretPayload,
          },
          { onConflict: "service_account_id" }
        )
        .select("id")
        .single()
    )
  }

  const inviteUrl = formText(formData.get("invite_url"))
  const address = formText(formData.get("address"))
  if (service.slug === "spotify") {
    await insertOrThrow(
      supabase
        .from("spotify_family_plans")
        .upsert(
          {
            service_account_id: id,
            invite_url: inviteUrl,
            address,
            seats_total: formNumber(formData.get("seats_total"), 6),
          },
          { onConflict: "service_account_id" }
        )
        .select("id")
        .single()
    )
  }

  await syncInventoryEmailUsage(supabase, {
    serviceAccountId: id,
    email: managedEmail,
    purpose: service?.name ?? requireValue(formData.get("label"), "Cuenta"),
    platformPassword,
  })

  revalidatePath("/admin/accounts")
  revalidatePath("/admin/emails")
  revalidatePath("/admin")
  redirect("/admin/accounts?saved=1")
}

export async function deleteServiceAccount(formData: FormData) {
  const { supabase } = await requireAdmin()

  await insertOrThrow(
    supabase
      .from("service_accounts")
      .update({ status: "inactive" })
      .eq("id", requireValue(formData.get("id"), "Inventario"))
      .select("id")
      .single()
  )

  revalidatePath("/admin/accounts")
  revalidatePath("/admin/subscriptions")
  revalidatePath("/admin/emails")
  revalidatePath("/admin")
  redirect("/admin/accounts?saved=1")
}

export async function markAccountDead(formData: FormData) {
  const { supabase } = await requireAdmin()

  await insertOrThrow(
    supabase
      .from("service_accounts")
      .update({
        status: "dead",
        dead_at: new Date().toISOString(),
        notes: formText(formData.get("notes")),
      })
      .eq("id", requireValue(formData.get("id"), "Cuenta"))
  )

  revalidatePath("/admin/accounts")
  revalidatePath("/admin/emails")
}

export async function replaceSubscriptionAccount(
  _state: SaleState,
  formData: FormData
): Promise<SaleState> {
  const { supabase } = await requireAdmin()
  const subscriptionId = requireValue(formData.get("subscription_id"), "Venta")
  const oldAccountId = requireValue(
    formData.get("old_account_id"),
    "Cuenta anterior"
  )
  let managedEmail: ManagedEmail | null = null
  try {
    managedEmail = await resolveInventoryEmail(supabase, formData)
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Correo no válido",
    }
  }
  const loginEmail =
    managedEmail?.email ?? requireValue(formData.get("login_email"), "Correo")
  const loginPassword = requireValue(
    formData.get("login_password"),
    "Contrasena"
  )
  const amount = formNumber(formData.get("amount"))
  const costCurrency = currency(formData.get("currency"))
  let rate = formNumber(formData.get("exchange_rate"))

  if (amount > 0 && !rate) {
    const result = await fetchBinanceAverage("BUY")
    rate = result.average

    const { error } = await supabase.from("exchange_rate_snapshots").insert({
      trade_type: "BUY",
      rows_requested: 20,
      average_price: result.average,
      raw_ads: result.ads,
    })

    if (error) {
      return { error: error.message }
    }
  }

  const { data: oldAccount, error: oldAccountError } = await supabase
    .from("service_accounts")
    .select("service_id, provider_id")
    .eq("id", oldAccountId)
    .single()

  if (oldAccountError || !oldAccount) {
    return {
      error: oldAccountError?.message ?? "No se encontro la cuenta anterior",
    }
  }

  const values = toMoneyValues(amount, costCurrency, rate || undefined)
  const providerId =
    optionalId(formData.get("provider_id")) ?? oldAccount.provider_id
  const newAccount = await insertOrThrow<{ id: string }>(
    supabase
      .from("service_accounts")
      .insert({
        service_id: oldAccount.service_id,
        provider_id: providerId,
        email_address_id: managedEmail?.id ?? null,
        label: formText(formData.get("label")) ?? loginEmail,
        login_email: loginEmail,
        base_cost_amount: amount,
        base_cost_currency: costCurrency,
        base_cost_exchange_rate: rate || null,
        base_cost_bob: values.bob,
        base_cost_usdt: values.usdt,
        two_factor_url: formText(formData.get("two_factor_url")),
        notes: formText(formData.get("notes")),
      })
      .select("id")
      .single()
  )

  await insertOrThrow(
    supabase.from("account_credentials").insert({
      service_account_id: newAccount.id,
      secret_payload: [
        `password: ${loginPassword}`,
        managedEmail?.email_password
          ? `email_password: ${managedEmail.email_password}`
          : null,
      ]
        .filter(Boolean)
        .join("\n"),
    })
  )

  if (amount > 0) {
    await insertOrThrow(
      supabase.from("costs").insert({
        service_account_id: newAccount.id,
        provider_id: providerId,
        subscription_id: subscriptionId,
        cost_type: "purchase",
        amount,
        currency: costCurrency,
        exchange_rate: rate || null,
        amount_bob: values.bob,
        amount_usdt: values.usdt,
        notes: formText(formData.get("notes")),
      })
    )
  }

  await insertOrThrow(
    supabase
      .from("service_accounts")
      .update({
        status: "dead",
        dead_at: new Date().toISOString(),
        replacement_account_id: newAccount.id,
      })
      .eq("id", oldAccountId)
  )

  await insertOrThrow(
    supabase
      .from("subscriptions")
      .update({ service_account_id: newAccount.id })
      .eq("id", subscriptionId)
  )

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("product_id")
    .eq("id", subscriptionId)
    .single()
  if (subscription) {
    await syncSubscriptionEmailUsage(supabase, {
      subscriptionId,
      productId: subscription.product_id,
      loginEmail,
      platformPassword: loginPassword,
      managedEmail,
    })
  }

  await insertOrThrow(
    supabase.from("subscription_access_details").upsert(
      {
        subscription_id: subscriptionId,
        login_email: loginEmail,
        login_password: loginPassword,
        email_password: managedEmail?.email_password ?? null,
        notes: formText(formData.get("notes")),
      },
      { onConflict: "subscription_id" }
    )
  )

  revalidatePath("/admin")
  revalidatePath("/admin/accounts")
  revalidatePath("/admin/costs")
  revalidatePath("/admin/subscriptions")
  revalidatePath("/admin/emails")
  revalidatePath("/portal")

  return { message: "Cuenta reemplazada" }
}

export async function createSale(
  _state: SaleState,
  formData: FormData
): Promise<SaleState> {
  const { supabase } = await requireAdmin()
  const startsOn =
    formText(formData.get("starts_on")) ?? new Date().toISOString().slice(0, 10)
  const priceAmount = formText(formData.get("current_price_amount"))
  const productSlug = requireValue(formData.get("product_slug"), "Servicio")
  const existingAccountId = optionalId(formData.get("service_account_id"))
  const phone = formText(formData.get("phone")) ?? ""
  const telegramRaw = formText(formData.get("telegram_username"))
  const telegramUsername = normalizeTelegramUsername(telegramRaw)
  const countryId = phone
    ? requireValue(formData.get("country_id"), "Pais")
    : null
  if (!phone && !telegramUsername) {
    return { error: "Ingresa un teléfono o un usuario de Telegram" }
  }
  if (telegramRaw && !isValidTelegramUsername(telegramRaw)) {
    return {
      error: "Telegram debe tener entre 5 y 32 letras, números o guion bajo",
    }
  }
  let managedEmail: ManagedEmail | null = null
  try {
    managedEmail = await selectedManagedEmail(supabase, formData)
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Correo no válido",
    }
  }
  let loginEmail = managedEmail?.email ?? formText(formData.get("login_email"))
  const invitationEmail = formText(formData.get("invitation_email"))
  const accountEmail = loginEmail ?? invitationEmail
  let loginPassword = formText(formData.get("login_password"))
  let emailPassword =
    managedEmail?.email_password ?? formText(formData.get("email_password"))
  const requestedProfileLabel = formText(formData.get("profile_label"))
  const managedEmailMode = formText(formData.get("managed_email_mode"))
  let saleAccountId = existingAccountId
  let linkedAccountCredentials: {
    emailPassword: string | null
    loginEmail: string | null
    loginPassword: string | null
  } | null = null
  let individualCost: {
    serviceAccountId: string
    providerId: string | null
    amount: number
    currency: Currency
    exchangeRate: number | null
    amountBob: number
    amountUsdt: number
    notes: string | null
  } | null = null

  const { data: product, error: productError } = await supabase
    .from("products")
    .select(
      "name, service_id, purchase_mode, default_purchase_amount, default_purchase_currency, default_purchase_exchange_rate"
    )
    .eq("slug", productSlug)
    .single()

  if (productError || !product) {
    return { error: productError?.message ?? "Item vendible invalido" }
  }

  const profileLabel =
    productSlug === "spotify_family_member"
      ? requestedProfileLabel === "Titular"
        ? "Titular"
        : "Miembro familiar"
      : requestedProfileLabel

  if (productSlug === "spotify_family_member" && !saleAccountId) {
    return { error: "Spotify requiere un plan familiar enlazado" }
  }

  let duplicateCheck
  try {
    duplicateCheck = await checkSaleDuplicates(supabase, {
      countryId,
      phone,
      telegramUsername,
      productSlug,
      loginEmail: existingAccountId ? null : accountEmail,
    })
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "No se pudo comprobar si el registro está duplicado",
    }
  }
  const conflictContext = {
    productSlug,
    phone: phone.trim(),
    telegramUsername,
    countryId,
    loginEmail: accountEmail?.trim().toLowerCase(),
  }

  const privateAccountState = (check: DuplicateCheck): SaleState => {
    const account = check.privateAccount
    if (!account) {
      return {
        error: `El correo ${accountEmail ?? "indicado"} ya está registrado en ${check.target.serviceName}.`,
      }
    }

    return {
      conflict: {
        ...conflictContext,
        check,
        kind: "private_account",
        message: account.available
          ? `El correo ${account.loginEmail} ya está registrado en ${account.serviceName} y la cuenta ${account.label} está disponible para reutilizar.`
          : account.sale
            ? `El correo ${account.loginEmail} ya está registrado en ${account.serviceName} con ${account.sale.customerName}${account.sale.customerPhone ? ` (${account.sale.customerPhone})` : ""}.`
            : `El correo ${account.loginEmail} ya está registrado en ${account.serviceName} y la cuenta tiene estado ${account.status}.`,
      },
    }
  }

  if (duplicateCheck.privateAccount && !existingAccountId) {
    return privateAccountState(duplicateCheck)
  }

  const activeDuplicate = duplicateCheck.matchingSales.find(
    (sale) => sale.status === "active"
  )
  if (activeDuplicate && formData.get("confirm_duplicate") !== "1") {
    return {
      conflict: {
        ...conflictContext,
        check: duplicateCheck,
        kind: "active_sale",
        message: `El contacto ${duplicateCheck.customer?.contact ?? (phone || `@${telegramUsername}`)} ya tiene ${duplicateCheck.target.serviceName}.`,
      },
    }
  }

  const expiredDuplicate = duplicateCheck.matchingSales.find(
    (sale) => sale.status === "expired"
  )
  if (!activeDuplicate && expiredDuplicate) {
    return {
      conflict: {
        ...conflictContext,
        check: duplicateCheck,
        kind: "expired_sale",
        message: `El contacto ${duplicateCheck.customer?.contact ?? (phone || `@${telegramUsername}`)} ya tiene ${duplicateCheck.target.serviceName} vencido. Renueva el acceso existente.`,
      },
    }
  }

  if (product.purchase_mode === "linked" && !saleAccountId) {
    return { error: "Este ítem requiere una cuenta enlazada" }
  }

  if (
    saleAccountId &&
    ["inventory", "individual", "linked"].includes(product.purchase_mode)
  ) {
    const [
      { data: account, error: accountError },
      { data: credential, error: credentialError },
    ] = await Promise.all([
      supabase
        .from("service_accounts")
        .select("id, service_id, status, login_email")
        .eq("id", saleAccountId)
        .single(),
      supabase
        .from("account_credentials")
        .select("secret_payload")
        .eq("service_account_id", saleAccountId)
        .maybeSingle(),
    ])

    if (accountError || !account) {
      return { error: accountError?.message ?? "Cuenta no encontrada" }
    }
    if (credentialError) {
      return { error: credentialError.message }
    }

    if (
      account.status !== "active" ||
      account.service_id !== product.service_id
    ) {
      return { error: "La cuenta elegida no esta disponible para este item" }
    }

    const secrets = parseSecretPayload(credential?.secret_payload ?? null)
    linkedAccountCredentials = {
      emailPassword: secrets.email_password ?? null,
      loginEmail: account.login_email,
      loginPassword: secrets.platform_password ?? secrets.password ?? null,
    }

    if (product.purchase_mode === "individual") {
      const { data: usedSales, error: usedSalesError } = await supabase
        .from("subscriptions")
        .select("id, status")
        .eq("service_account_id", saleAccountId)

      if (usedSalesError) {
        return { error: usedSalesError.message }
      }

      if (
        (usedSales ?? []).some(
          (sale) => !["canceled", "inactive"].includes(sale.status)
        )
      ) {
        return { error: "Esta cuenta ya esta enlazada a una venta activa" }
      }
    }
  }

  if (
    productSlug === "spotify_family_member" &&
    profileLabel === "Titular" &&
    saleAccountId
  ) {
    try {
      const credentials = await spotifyOwnerCredentials(supabase, saleAccountId)
      loginEmail = credentials.loginEmail
      loginPassword = credentials.loginPassword
      emailPassword = credentials.emailPassword
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron copiar las credenciales de la cuenta madre",
      }
    }
  }

  if (productSlug !== "spotify_family_member") {
    emailPassword ??= linkedAccountCredentials?.emailPassword ?? null
    loginEmail ??= linkedAccountCredentials?.loginEmail ?? null
    loginPassword ??= linkedAccountCredentials?.loginPassword ?? null
  }

  let automaticExchangeRate: number
  try {
    const result = await fetchBinanceAverage("BUY")
    automaticExchangeRate = result.average

    const { error: snapshotError } = await supabase
      .from("exchange_rate_snapshots")
      .insert({
        trade_type: "BUY",
        rows_requested: 20,
        average_price: result.average,
        raw_ads: result.ads,
      })

    if (snapshotError) {
      return { error: snapshotError.message }
    }
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "No se pudo obtener el tipo de cambio",
    }
  }

  if (!saleAccountId && product.purchase_mode === "individual") {
    const purchaseAmountText = formText(formData.get("purchase_amount"))
    const purchaseAmount =
      purchaseAmountText === null
        ? Number(product.default_purchase_amount ?? 0)
        : formNumber(purchaseAmountText)
    const purchaseCurrency = formText(formData.get("purchase_currency"))
      ? currency(formData.get("purchase_currency"))
      : currency(product.default_purchase_currency)
    const purchaseRate = automaticExchangeRate

    const purchaseValues = toMoneyValues(
      purchaseAmount,
      purchaseCurrency,
      purchaseRate || undefined
    )

    const providerId = optionalId(formData.get("provider_id"))
    const accountResult = await supabase
      .from("service_accounts")
      .insert({
        service_id: product.service_id,
        provider_id: providerId,
        label:
          formText(formData.get("account_label")) ??
          accountEmail ??
          `${product.name} ${phone || `@${telegramUsername}`}`.trim(),
        login_email: accountEmail,
        base_cost_amount: purchaseAmount,
        base_cost_currency: purchaseCurrency,
        base_cost_exchange_rate: purchaseRate || null,
        base_cost_bob: purchaseValues.bob,
        base_cost_usdt: purchaseValues.usdt,
        two_factor_url: formText(formData.get("two_factor_url")),
        notes: formText(formData.get("notes")),
      })
      .select("id")
      .single()

    if (accountResult.error || !accountResult.data) {
      if (accountResult.error?.code === "23505" && accountEmail) {
        try {
          const latestCheck = await checkSaleDuplicates(supabase, {
            countryId,
            phone,
            telegramUsername,
            productSlug,
            loginEmail: accountEmail,
          })
          if (latestCheck.privateAccount) {
            return privateAccountState(latestCheck)
          }
        } catch {
          // Preserve the database error fallback below.
        }
      }

      return {
        error:
          accountResult.error?.code === "23505"
            ? `El correo ${accountEmail ?? "indicado"} ya está registrado en ${duplicateCheck.target.serviceName}.`
            : (accountResult.error?.message ?? "No se guardo el inventario"),
      }
    }

    saleAccountId = accountResult.data.id

    const accountSecret = [
      loginPassword ? `password: ${loginPassword}` : null,
      emailPassword ? `email_password: ${emailPassword}` : null,
    ]
      .filter(Boolean)
      .join("\n")
    if (accountSecret) {
      await insertOrThrow(
        supabase.from("account_credentials").insert({
          service_account_id: saleAccountId,
          secret_payload: accountSecret,
        })
      )
    }

    if (purchaseAmount > 0) {
      individualCost = {
        serviceAccountId: accountResult.data.id,
        providerId,
        amount: purchaseAmount,
        currency: purchaseCurrency,
        exchangeRate: purchaseRate || null,
        amountBob: purchaseValues.bob,
        amountUsdt: purchaseValues.usdt,
        notes: null,
      }
    }
  }

  const visibleFields = [
    loginEmail ? "login_email" : null,
    loginPassword ? "login_password" : null,
    emailPassword ? "email_password" : null,
    invitationEmail ? "invitation_email" : null,
    profileLabel ? "profile_label" : null,
  ].filter((field): field is string => field !== null)

  const { data: subscriptionId, error } = await supabase.rpc(
    "create_sale_with_email",
    {
      p_phone: phone,
      p_telegram_username: telegramUsername,
      p_country_id: countryId,
      p_product_slug: productSlug,
      p_service_account_id: saleAccountId,
      p_provider_id: optionalId(formData.get("provider_id")),
      p_login_email: loginEmail,
      p_login_password: loginPassword,
      p_email_password: emailPassword,
      p_invitation_email: formText(formData.get("invitation_email")),
      p_profile_label: profileLabel,
      p_customer_name: formText(formData.get("customer_name")),
      p_account_label: formText(formData.get("account_label")),
      p_starts_on: startsOn,
      p_duration_months: formNumber(formData.get("duration_months"), 1),
      p_price_amount: priceAmount ? formNumber(priceAmount) : null,
      p_price_currency: currency(formData.get("current_price_currency")),
      p_exchange_rate: automaticExchangeRate,
      p_paid_now: true,
      p_visible_to_customer: true,
      p_visible_fields: visibleFields,
      p_notes: null,
      p_manage_email: Boolean(loginEmail && managedEmailMode),
      p_email_address_id: managedEmail?.id ?? null,
      p_email_origin: formText(formData.get("email_origin")) ?? "self",
      p_email_provider_id: optionalId(formData.get("email_provider_id")),
    }
  )

  if (error) {
    return { error: error.message }
  }

  if (individualCost) {
    await insertOrThrow(
      supabase.from("costs").insert({
        service_account_id: individualCost.serviceAccountId,
        provider_id: individualCost.providerId,
        subscription_id: subscriptionId,
        cost_type: "purchase",
        amount: individualCost.amount,
        currency: individualCost.currency,
        exchange_rate: individualCost.exchangeRate,
        amount_bob: individualCost.amountBob,
        amount_usdt: individualCost.amountUsdt,
        notes: individualCost.notes,
      })
    )
  }

  revalidatePath("/admin")
  revalidatePath("/admin/subscriptions")
  revalidatePath("/admin/accounts")
  revalidatePath("/admin/emails")
  revalidatePath("/admin/costs")
  revalidatePath("/portal")

  return { message: "Venta guardada correctamente." }
}

export async function deleteSubscription(formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = requireValue(formData.get("id"), "Venta")

  await insertOrThrow(supabase.from("costs").delete().eq("subscription_id", id))
  await insertOrThrow(
    supabase.from("payments").delete().eq("subscription_id", id)
  )
  await insertOrThrow(
    supabase
      .from("email_usages")
      .update({ ended_at: new Date().toISOString() })
      .eq("subscription_id", id)
      .is("ended_at", null)
  )
  await insertOrThrow(supabase.from("subscriptions").delete().eq("id", id))

  revalidatePath("/admin")
  revalidatePath("/admin/subscriptions")
  revalidatePath("/admin/payments")
  revalidatePath("/admin/costs")
  revalidatePath("/admin/emails")
  revalidatePath("/portal")
}

export async function updateSubscription(
  _state: SaleState,
  formData: FormData
): Promise<SaleState> {
  const { supabase } = await requireAdmin()
  const id = requireValue(formData.get("id"), "Venta")
  const startsOn = requireValue(formData.get("starts_on"), "Inicio")
  const duration = formNumber(formData.get("duration_months"), 1)
  const price = formNumber(formData.get("current_price_amount"))
  const priceCurrency = currency(formData.get("current_price_currency"))
  const rate = formNumber(formData.get("current_exchange_rate"))
  const values = toMoneyValues(price, priceCurrency, rate || undefined)
  const endsOn = addMonths(startsOn, duration)
  let profileLabel = formText(formData.get("profile_label"))
  const productId = requireValue(formData.get("product_id"), "Item")
  const accountId = optionalId(formData.get("service_account_id"))
  let loginEmail = formText(formData.get("login_email"))
  let loginPassword = formText(formData.get("login_password"))
  let emailPassword = formText(formData.get("email_password"))
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("slug")
    .eq("id", productId)
    .single()

  if (productError || !product) {
    return { error: productError?.message ?? "Item vendible invalido" }
  }

  if (product.slug === "spotify_family_member") {
    profileLabel = profileLabel === "Titular" ? "Titular" : "Miembro familiar"
    if (!accountId)
      return { error: "Spotify requiere un plan familiar enlazado" }

    if (profileLabel === "Titular") {
      try {
        const credentials = await spotifyOwnerCredentials(supabase, accountId)
        loginEmail = credentials.loginEmail
        loginPassword = credentials.loginPassword
        emailPassword = credentials.emailPassword
      } catch (error) {
        return {
          error:
            error instanceof Error
              ? error.message
              : "No se pudieron copiar las credenciales de la cuenta madre",
        }
      }
    }
  }

  const { error: subscriptionError } = await supabase
    .from("subscriptions")
    .update({
      product_id: productId,
      service_account_id: accountId,
      slot_label: profileLabel,
      starts_on: startsOn,
      ends_on: endsOn,
      duration_months: duration,
      current_price_amount: price,
      current_price_currency: priceCurrency,
      current_exchange_rate: rate || null,
      notes: formText(formData.get("notes")),
    })
    .eq("id", id)

  if (subscriptionError) return { error: subscriptionError.message }

  await insertOrThrow(
    supabase
      .from("billing_cycles")
      .update({
        period_start: startsOn,
        period_end: endsOn,
        due_on: startsOn,
        status: "paid",
        expected_amount: price,
        expected_currency: priceCurrency,
        exchange_rate: rate || null,
        expected_bob: values.bob,
        expected_usdt: values.usdt,
      })
      .eq("subscription_id", id)
  )

  const managedEmailPassword = await syncSubscriptionEmailUsage(supabase, {
    subscriptionId: id,
    productId,
    loginEmail,
    platformPassword: loginPassword,
  })

  await insertOrThrow(
    supabase
      .from("payments")
      .update({
        amount: price,
        currency: priceCurrency,
        exchange_rate: rate || null,
        amount_bob: values.bob,
        amount_usdt: values.usdt,
      })
      .eq("subscription_id", id)
  )

  await insertOrThrow(
    supabase.from("subscription_access_details").upsert(
      {
        subscription_id: id,
        login_email: loginEmail,
        login_password: loginPassword,
        email_password: managedEmailPassword ?? emailPassword,
        invitation_email: formText(formData.get("invitation_email")),
        profile_label: profileLabel,
        notes: formText(formData.get("access_notes")),
        visible_to_customer: formData.get("visible_to_customer") === "on",
        visible_fields: formData.getAll("visible_fields").map(String),
      },
      { onConflict: "subscription_id" }
    )
  )

  revalidatePath("/admin")
  revalidatePath("/admin/subscriptions")
  revalidatePath("/admin/payments")
  revalidatePath("/admin/emails")
  revalidatePath("/portal")

  return { message: "Venta actualizada." }
}

export async function renewSubscription(formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = requireValue(formData.get("id"), "Venta")
  const months = formNumber(formData.get("duration_months"), 1)
  const amount = formNumber(formData.get("amount"))
  const paymentCurrency = currency(formData.get("currency"))
  const rate = formNumber(formData.get("exchange_rate"))
  const values = toMoneyValues(amount, paymentCurrency, rate || undefined)
  const today = new Date().toISOString().slice(0, 10)

  const { data: subscription, error } = await supabase
    .from("subscriptions")
    .select("customer_id, ends_on")
    .eq("id", id)
    .single()

  if (error || !subscription) {
    throw error ?? new Error("No se encontro la venta")
  }

  const periodStart =
    subscription.ends_on < today ? today : subscription.ends_on
  const periodEnd = addMonths(periodStart, months)

  await insertOrThrow(
    supabase
      .from("subscriptions")
      .update({
        status: "active",
        ends_on: periodEnd,
        duration_months: months,
        current_price_amount: amount,
        current_price_currency: paymentCurrency,
        current_exchange_rate: rate || null,
      })
      .eq("id", id)
  )

  const cycle = await insertOrThrow<{ id: string }>(
    supabase
      .from("billing_cycles")
      .insert({
        subscription_id: id,
        period_start: periodStart,
        period_end: periodEnd,
        due_on: today,
        status: "paid",
        expected_amount: amount,
        expected_currency: paymentCurrency,
        exchange_rate: rate || null,
        expected_bob: values.bob,
        expected_usdt: values.usdt,
      })
      .select("id")
      .single()
  )
  if (!cycle) {
    throw new Error("No se guardo el ciclo")
  }

  await insertOrThrow(
    supabase.from("payments").insert({
      customer_id: subscription.customer_id,
      subscription_id: id,
      billing_cycle_id: cycle.id,
      payment_type: "renewal",
      amount,
      currency: paymentCurrency,
      exchange_rate: rate || null,
      amount_bob: values.bob,
      amount_usdt: values.usdt,
      notes: formText(formData.get("notes")),
    })
  )

  revalidatePath("/admin")
  revalidatePath("/admin/subscriptions")
  revalidatePath("/admin/emails")
  revalidatePath("/admin/payments")
  revalidatePath("/portal")
}

export async function cancelSubscription(formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = requireValue(formData.get("id"), "Venta")

  await insertOrThrow(
    supabase.from("subscriptions").update({ status: "canceled" }).eq("id", id)
  )
  await insertOrThrow(
    supabase
      .from("billing_cycles")
      .update({ status: "canceled" })
      .eq("subscription_id", id)
      .eq("status", "pending")
  )

  revalidatePath("/admin")
  revalidatePath("/admin/subscriptions")
  revalidatePath("/admin/emails")
  revalidatePath("/portal")
}

export async function reactivateSubscription(formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = requireValue(formData.get("id"), "Venta")

  await insertOrThrow(
    supabase.from("subscriptions").update({ status: "active" }).eq("id", id)
  )

  revalidatePath("/admin")
  revalidatePath("/admin/subscriptions")
  revalidatePath("/admin/emails")
  revalidatePath("/portal")
}

export async function createSubscription(formData: FormData) {
  const { supabase } = await requireAdmin()
  const startsOn =
    formText(formData.get("starts_on")) ?? new Date().toISOString().slice(0, 10)
  const duration = formNumber(formData.get("duration_months"), 1)
  const price = formNumber(formData.get("current_price_amount"))
  const priceCurrency = currency(formData.get("current_price_currency"))
  const rate = formNumber(formData.get("current_exchange_rate"))
  const values = toMoneyValues(price, priceCurrency, rate || undefined)

  const subscriptionResult = await supabase
    .from("subscriptions")
    .insert({
      customer_id: requireValue(formData.get("customer_id"), "Cliente"),
      product_id: requireValue(formData.get("product_id"), "Producto"),
      service_account_id: formText(formData.get("service_account_id")),
      slot_label: formText(formData.get("slot_label")),
      starts_on: startsOn,
      ends_on: addMonths(startsOn, duration),
      duration_months: duration,
      current_price_amount: price,
      current_price_currency: priceCurrency,
      current_exchange_rate: rate || null,
      notes: formText(formData.get("notes")),
    })
    .select("id, customer_id")
    .single()
  if (subscriptionResult.error || !subscriptionResult.data) {
    throw subscriptionResult.error ?? new Error("No se guardo el acceso")
  }
  const subscription = subscriptionResult.data as {
    id: string
    customer_id: string
  }

  const cycleResult = await supabase
    .from("billing_cycles")
    .insert({
      subscription_id: subscription.id,
      period_start: startsOn,
      period_end: addMonths(startsOn, duration),
      due_on: startsOn,
      status: formData.get("paid_now") ? "paid" : "pending",
      expected_amount: price,
      expected_currency: priceCurrency,
      exchange_rate: rate || null,
      expected_bob: values.bob,
      expected_usdt: values.usdt,
    })
    .select("id")
    .single()
  if (cycleResult.error || !cycleResult.data) {
    throw cycleResult.error ?? new Error("No se guardo el ciclo")
  }
  const cycle = cycleResult.data as { id: string }

  if (formData.get("paid_now")) {
    await insertOrThrow(
      supabase.from("payments").insert({
        customer_id: subscription.customer_id,
        subscription_id: subscription.id,
        billing_cycle_id: cycle.id,
        payment_type: "new",
        amount: price,
        currency: priceCurrency,
        exchange_rate: rate || null,
        amount_bob: values.bob,
        amount_usdt: values.usdt,
      })
    )
  }

  revalidatePath("/admin/subscriptions")
  revalidatePath("/admin")
}

export async function createPayment(formData: FormData) {
  const { supabase } = await requireAdmin()
  const amount = formNumber(formData.get("amount"))
  const paymentCurrency = currency(formData.get("currency"))
  const rate = formNumber(formData.get("exchange_rate"))
  const values = toMoneyValues(amount, paymentCurrency, rate || undefined)
  const billingCycleId = formText(formData.get("billing_cycle_id"))

  await insertOrThrow(
    supabase.from("payments").insert({
      customer_id: requireValue(formData.get("customer_id"), "Cliente"),
      subscription_id: formText(formData.get("subscription_id")),
      billing_cycle_id: billingCycleId,
      payment_type: formData.get("payment_type") === "new" ? "new" : "renewal",
      amount,
      currency: paymentCurrency,
      exchange_rate: rate || null,
      amount_bob: values.bob,
      amount_usdt: values.usdt,
      notes: formText(formData.get("notes")),
    })
  )

  if (billingCycleId) {
    await supabase
      .from("billing_cycles")
      .update({ status: "paid" })
      .eq("id", billingCycleId)
  }

  revalidatePath("/admin/payments")
  revalidatePath("/admin")
}

export async function createCost(formData: FormData) {
  const { supabase } = await requireAdmin()
  const amount = formNumber(formData.get("amount"))
  const costCurrency = currency(formData.get("currency"))
  let rate = formNumber(formData.get("exchange_rate"))

  if (amount > 0 && !rate) {
    const result = await fetchBinanceAverage("BUY")
    rate = result.average

    const { error } = await supabase.from("exchange_rate_snapshots").insert({
      trade_type: "BUY",
      rows_requested: 20,
      average_price: result.average,
      raw_ads: result.ads,
    })

    if (error) {
      throw error
    }
  }

  const values = toMoneyValues(amount, costCurrency, rate || undefined)

  await insertOrThrow(
    supabase.from("costs").insert({
      service_account_id: optionalId(formData.get("service_account_id")),
      provider_id: optionalId(formData.get("provider_id")),
      cost_type:
        formData.get("cost_type") === "purchase" ? "purchase" : "renewal",
      amount,
      currency: costCurrency,
      exchange_rate: rate || null,
      amount_bob: values.bob,
      amount_usdt: values.usdt,
      notes: formText(formData.get("notes")),
    })
  )

  revalidatePath("/admin/costs")
  revalidatePath("/admin/accounts")
  revalidatePath("/admin")
}

export async function registerMissingPurchaseCost(
  _state: PurchaseCostState,
  formData: FormData
): Promise<PurchaseCostState> {
  const { supabase } = await requireAdmin()
  const subscriptionId = requireValue(formData.get("subscription_id"), "Venta")

  let result
  try {
    result = await fetchBinanceAverage("BUY")
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "No se pudo consultar el tipo de cambio",
    }
  }

  const { error: snapshotError } = await supabase
    .from("exchange_rate_snapshots")
    .insert({
      trade_type: "BUY",
      rows_requested: 20,
      average_price: result.average,
      raw_ads: result.ads,
    })

  if (snapshotError) return { error: snapshotError.message }

  const { data: created, error } = await supabase.rpc(
    "register_missing_purchase_cost",
    {
      p_subscription_id: subscriptionId,
      p_exchange_rate: result.average,
    }
  )

  if (error) return { error: error.message }

  revalidatePath("/admin")
  revalidatePath("/admin/accounts")
  revalidatePath("/admin/costs")
  revalidatePath("/admin/subscriptions")

  return {
    message: created
      ? "Costo de compra registrado."
      : "La venta ya tenía un costo de compra.",
  }
}

export async function captureBinanceRate() {
  const { supabase } = await requireAdmin()
  const result = await fetchBinanceAverage("BUY")

  const { error } = await supabase.from("exchange_rate_snapshots").insert({
    trade_type: "BUY",
    rows_requested: 20,
    average_price: result.average,
    raw_ads: result.ads,
  })

  if (error) {
    throw error
  }

  revalidatePath("/admin/exchange-rates")
}

export async function getBinancePurchaseRate() {
  const { supabase } = await requireAdmin()
  const result = await fetchBinanceAverage("BUY")

  const { error } = await supabase.from("exchange_rate_snapshots").insert({
    trade_type: "BUY",
    rows_requested: 20,
    average_price: result.average,
    raw_ads: result.ads,
  })

  if (error) {
    throw error
  }

  revalidatePath("/admin/exchange-rates")

  return Number(result.average.toFixed(6))
}
