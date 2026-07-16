export function whatsappUrl(
  phoneE164?: string | null,
  message?: string | null
) {
  const digits = String(phoneE164 ?? "").replace(/\D/g, "")
  if (!digits) return null

  const url = `https://wa.me/${digits}`
  return message ? `${url}?text=${encodeURIComponent(message)}` : url
}

export function normalizeTelegramUsername(value?: string | null) {
  return String(value ?? "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
}

export function isValidTelegramUsername(value?: string | null) {
  return /^[a-z0-9_]{5,32}$/.test(normalizeTelegramUsername(value))
}

export function telegramUrl(
  username?: string | null,
  message?: string | null
) {
  const normalized = normalizeTelegramUsername(username)
  if (!isValidTelegramUsername(normalized)) return null

  const url = `https://t.me/${normalized}`
  return message ? `${url}?text=${encodeURIComponent(message)}` : url
}
