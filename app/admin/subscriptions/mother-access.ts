const motherServices = new Set(["spotify", "netflix"])

export function boliviaToday(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/La_Paz",
    year: "numeric",
  }).formatToParts(value)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? ""

  return `${part("year")}-${part("month")}-${part("day")}`
}

export function isMotherService(serviceSlug: string | null | undefined) {
  return motherServices.has(serviceSlug ?? "")
}

export function renewalOverdue(
  serviceSlug: string | null | undefined,
  renewalDueOn: string | null | undefined,
  today = boliviaToday()
) {
  return isMotherService(serviceSlug) && Boolean(renewalDueOn && renewalDueOn <= today)
}

export function motherAccessIssueOn({
  accessIssueOn,
  accessRestoredOn,
  createdAt,
  endsOn,
  renewalDueOn,
  serviceSlug,
  status,
  today = boliviaToday(),
}: {
  accessIssueOn: string | null
  accessRestoredOn: string | null
  createdAt: string
  endsOn: string
  renewalDueOn: string | null
  serviceSlug: string
  status: string
  today?: string
}) {
  if (
    !isMotherService(serviceSlug) ||
    ["canceled", "inactive"].includes(status) ||
    endsOn <= today
  ) {
    return null
  }

  const overdueOn = renewalOverdue(serviceSlug, renewalDueOn, today)
    ? renewalDueOn
    : null
  const issueOn =
    accessIssueOn && overdueOn
      ? accessIssueOn > overdueOn
        ? accessIssueOn
        : overdueOn
      : (accessIssueOn ?? overdueOn)

  if (
    !issueOn ||
    createdAt.slice(0, 10) > issueOn ||
    (accessRestoredOn && accessRestoredOn >= issueOn)
  ) {
    return null
  }

  return issueOn
}

export function nextRenewalSuggestion(
  renewalDueOn: string | null | undefined,
  today = boliviaToday()
) {
  const base = renewalDueOn && renewalDueOn >= today ? renewalDueOn : today
  const [year, month, day] = base.split("-").map(Number)
  const next = new Date(Date.UTC(year, month, 1))
  const lastDay = new Date(
    Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)
  ).getUTCDate()
  next.setUTCDate(Math.min(day, lastDay))

  return next.toISOString().slice(0, 10)
}
