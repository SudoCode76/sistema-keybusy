"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { requireAdmin, requireUser } from "@/lib/auth"
import { fetchBinanceAverage } from "@/lib/binance"
import { formNumber, formText, toMoneyValues, type Currency } from "@/lib/money"
import { createClient } from "@/lib/supabase/server"

type AuthState = {
  error?: string
  message?: string
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

async function insertOrThrow<T>(
  query: PromiseLike<{ error: unknown; data: T | null }>
) {
  const { error, data } = await query
  if (error) {
    throw error
  }
  if (data === null) {
    throw new Error("No se recibio el registro guardado")
  }
  return data
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
    return { message: "Cuenta creada. Revisa tu email para confirmar el acceso." }
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

  await insertOrThrow(
    supabase.from("customers").insert({
      display_name: requireValue(formData.get("display_name"), "Cliente"),
      email: formText(formData.get("email")),
      phone: formText(formData.get("phone")),
      notes: formText(formData.get("notes")),
    })
  )

  revalidatePath("/admin/customers")
}

export async function createProvider(formData: FormData) {
  const { supabase } = await requireAdmin()

  await insertOrThrow(
    supabase.from("providers").insert({
      name: requireValue(formData.get("name"), "Proveedor"),
      contact: formText(formData.get("contact")),
      notes: formText(formData.get("notes")),
    })
  )

  revalidatePath("/admin/providers")
}

export async function createServiceAccount(formData: FormData) {
  const { supabase } = await requireAdmin()
  const amount = formNumber(formData.get("base_cost_amount"))
  const costCurrency = currency(formData.get("base_cost_currency"))
  const rate = formNumber(formData.get("base_cost_exchange_rate"))
  const moneyValues = toMoneyValues(amount, costCurrency, rate || undefined)

  const accountResult = await supabase
    .from("service_accounts")
    .insert({
      service_id: requireValue(formData.get("service_id"), "Servicio"),
      provider_id: formText(formData.get("provider_id")),
      label: requireValue(formData.get("label"), "Cuenta"),
      login_email: formText(formData.get("login_email")),
      username: formText(formData.get("username")),
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

  const secretPayload = formText(formData.get("secret_payload"))
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
  if (inviteUrl || address) {
    await insertOrThrow(
      supabase.from("spotify_family_plans").insert({
        service_account_id: account.id,
        invite_url: inviteUrl,
        address,
        seats_total: formNumber(formData.get("seats_total"), 6),
      })
    )
  }

  revalidatePath("/admin/accounts")
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
      payment_type:
        formData.get("payment_type") === "new" ? "new" : "renewal",
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
  const rate = formNumber(formData.get("exchange_rate"))
  const values = toMoneyValues(amount, costCurrency, rate || undefined)

  await insertOrThrow(
    supabase.from("costs").insert({
      service_account_id: formText(formData.get("service_account_id")),
      provider_id: formText(formData.get("provider_id")),
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
  revalidatePath("/admin")
}

export async function captureBinanceRate() {
  const { supabase } = await requireAdmin()
  const result = await fetchBinanceAverage("BUY")

  await insertOrThrow(
    supabase.from("exchange_rate_snapshots").insert({
      trade_type: "BUY",
      rows_requested: 20,
      average_price: result.average,
      raw_ads: result.ads,
    })
  )

  revalidatePath("/admin/exchange-rates")
}
