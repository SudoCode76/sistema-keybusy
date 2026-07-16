export function whatsappUrl(
  phoneE164?: string | null,
  message?: string | null
) {
  const digits = String(phoneE164 ?? "").replace(/\D/g, "")
  if (!digits) return null

  const url = `https://wa.me/${digits}`
  return message ? `${url}?text=${encodeURIComponent(message)}` : url
}
