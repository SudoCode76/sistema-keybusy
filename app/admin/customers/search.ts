export function matchesCustomerContact(
  customer: {
    phone: string | null
    phone_e164: string | null
    telegram_username: string | null
  },
  query: string
) {
  const value = query.trim().toLowerCase().replace(/^@/, "")
  if (!value) return true

  if (customer.telegram_username?.includes(value)) return true
  if (!/^[+\d\s()-]+$/.test(query.trim())) return false

  const digits = value.replace(/\D/g, "")
  return Boolean(
    digits &&
    (customer.phone_e164 ?? customer.phone ?? "")
      .replace(/\D/g, "")
      .includes(digits)
  )
}
