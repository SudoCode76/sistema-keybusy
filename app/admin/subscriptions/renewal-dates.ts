export function addRenewalMonths(date: string, months: number) {
  const [year, month, day] = date.split("-").map(Number)
  const targetMonth = month - 1 + months
  const targetYear = year + Math.floor(targetMonth / 12)
  const normalizedMonth = ((targetMonth % 12) + 12) % 12
  const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate()
  const normalizedDay = Math.min(day, lastDay)

  return [targetYear, normalizedMonth + 1, normalizedDay]
    .map((part) => String(part).padStart(2, "0"))
    .join("-")
}

export function parseRenewalDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return month >= 1 && month <= 12 && day >= 1 && day <= lastDay ? value : null
}
