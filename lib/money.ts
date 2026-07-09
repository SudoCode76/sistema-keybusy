export type Currency = "BOB" | "USDT"

export function toMoneyValues(amount: number, currency: Currency, rate?: number) {
  if (currency === "BOB") {
    return {
      bob: amount,
      usdt: rate ? amount / rate : 0,
    }
  }

  return {
    bob: rate ? amount * rate : 0,
    usdt: amount,
  }
}

export function money(value: number | null | undefined, currency: Currency) {
  return `${Number(value ?? 0).toFixed(2)} ${currency}`
}

export function formNumber(value: FormDataEntryValue | null, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function formText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim()
  return text.length ? text : null
}
