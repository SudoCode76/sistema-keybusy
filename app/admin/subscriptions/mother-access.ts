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

export function renewalStartDate(endsOn: string, today = boliviaToday()) {
  return endsOn < today ? today : endsOn
}

export function isMotherService(
  _serviceSlug: string | null | undefined,
  accountModel?: string | null
) {
  return accountModel === "mother"
}

export function renewalOverdue(
  _serviceSlug: string | null | undefined,
  renewalDueOn: string | null | undefined,
  today = boliviaToday(),
  accountModel?: string | null
) {
  return isMotherService(_serviceSlug, accountModel) && Boolean(renewalDueOn && renewalDueOn <= today)
}

export function motherAccessIssueOn({
  accessIssueOn,
  accessRestoredOn,
  createdAt,
  endsOn,
  renewalDueOn,
  serviceSlug,
  accountModel,
  status,
  today = boliviaToday(),
}: {
  accessIssueOn: string | null
  accessRestoredOn: string | null
  createdAt: string
  endsOn: string
  renewalDueOn: string | null
  serviceSlug: string
  accountModel?: string | null
  status: string
  today?: string
}) {
  if (
    !isMotherService(serviceSlug, accountModel) ||
    ["canceled", "inactive"].includes(status) ||
    endsOn <= today
  ) {
    return null
  }

  const overdueOn = renewalOverdue(serviceSlug, renewalDueOn, today, accountModel)
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
