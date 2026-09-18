import type { createClient } from "@/lib/supabase/server"

type ServerClient = Awaited<ReturnType<typeof createClient>>

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null)
}

function text(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export type PlatformUsageDetail = {
  id: string
  platformName: string
  platformSlug: string | null
  platformPassword: string | null
  status: "active" | "inactive"
  statusLabel: string
  startedAt: string | null
  endedAt: string | null
  customerName: string | null
  purpose: string
  notes: string | null
}

export type FamilyPlanHistoryItem = {
  id: string
  platformName: string
  planLabel: string
  memberName: string | null
  loginEmail: string
  loginPassword: string | null
  emailPassword: string | null
  status: "active" | "removed" | "available" | "moved"
  statusLabel: string
  joinedAt: string | null
  removedAt: string | null
  customerName: string | null
  isEligibleForNewPlan?: boolean
  eligibleAfterDate?: string | null
}

export type EmailHistoryEntry = {
  id: string
  email: string
  emailPassword: string | null
  origin: "self" | "provider"
  providerName: string | null
  status: "active" | "inactive"
  notes: string | null
  hasInactivePlatforms: boolean
  hasActivePlatforms: boolean
  platforms: PlatformUsageDetail[]
  familyPlans: FamilyPlanHistoryItem[]
  lastEndedAt: string | null
}

export async function getEmailHistoryData(
  supabase: ServerClient
): Promise<EmailHistoryEntry[]> {
  const [
    { data: emails, error: emailsError },
    { data: usages, error: usagesError },
    { data: spotifyMembers, error: membersError },
    { data: serviceAccounts, error: accountsError },
  ] = await Promise.all([
    supabase
      .from("email_addresses")
      .select("id, email, email_password, origin, provider_id, status, notes, providers(name)")
      .order("email"),
    supabase
      .from("email_usages")
      .select(
        "id, email_address_id, purpose, platform_password, started_at, ended_at, notes, service_account_id, subscription_id, service_accounts(id, label, status, services(name, slug)), subscriptions(id, status, starts_on, ends_on, customers(display_name), products(name, slug, services(name, slug)))"
      )
      .order("started_at", { ascending: false }),
    supabase
      .from("spotify_member_accounts")
      .select(
        "id, service_account_id, source_subscription_id, current_subscription_id, login_email, login_password, email_password, member_name, status, created_at, removed_at, updated_at, service_accounts(id, label, services(name, slug)), source_subscription:subscriptions!spotify_member_accounts_source_subscription_id_fkey(id, status, starts_on, ends_on, customers(display_name)), current_subscription:subscriptions!spotify_member_accounts_current_subscription_id_fkey(id, status, starts_on, ends_on, customers(display_name))"
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("service_accounts")
      .select("id, email_address_id, label, login_email, username, status, started_at, dead_at, services(name, slug), account_credentials(secret_payload)")
      .order("created_at", { ascending: false }),
  ])

  if (emailsError) throw emailsError
  if (usagesError) throw usagesError
  if (membersError) throw membersError
  if (accountsError) throw accountsError

  // Index usages by email_address_id
  const usagesByEmailId = new Map<string, typeof usages>()
  for (const usage of usages ?? []) {
    const list = usagesByEmailId.get(usage.email_address_id) ?? []
    list.push(usage)
    usagesByEmailId.set(usage.email_address_id, list)
  }

  // Index spotify members by lowercase trimmed email
  const spotifyMembersByEmail = new Map<string, typeof spotifyMembers>()
  for (const member of spotifyMembers ?? []) {
    const emailKey = member.login_email?.trim().toLowerCase()
    if (!emailKey) continue
    const list = spotifyMembersByEmail.get(emailKey) ?? []
    list.push(member)
    spotifyMembersByEmail.set(emailKey, list)
  }

  // Index service_accounts by email_address_id or email string
  const serviceAccountsByEmailKey = new Map<string, typeof serviceAccounts>()
  for (const acc of serviceAccounts ?? []) {
    const keys: string[] = []
    if (acc.email_address_id) keys.push(acc.email_address_id)
    if (acc.login_email) keys.push(acc.login_email.trim().toLowerCase())
    for (const key of keys) {
      const list = serviceAccountsByEmailKey.get(key) ?? []
      list.push(acc)
      serviceAccountsByEmailKey.set(key, list)
    }
  }

  const entries: EmailHistoryEntry[] = []

  for (const emailItem of emails ?? []) {
    const emailNorm = emailItem.email.trim().toLowerCase()
    const emailUsages = usagesByEmailId.get(emailItem.id) ?? []
    const emailSpotifyMembers = spotifyMembersByEmail.get(emailNorm) ?? []
    const provider = one(emailItem.providers)

    const platformDetails: PlatformUsageDetail[] = []
    const familyPlanHistory: FamilyPlanHistoryItem[] = []
    let hasInactivePlatforms = false
    let hasActivePlatforms = false
    let lastEndedAt: string | null = null

    // 1. Process explicit email usages
    for (const u of emailUsages) {
      const sa = one(u.service_accounts)
      const sub = one(u.subscriptions)
      const subProd = one(sub?.products)
      const saService = one(sa?.services)
      const subService = one(subProd?.services)
      const customer = one(sub?.customers)

      const platformName =
        subService?.name ?? saService?.name ?? u.purpose
      const platformSlug = subService?.slug ?? saService?.slug ?? null

      const isUsageInactive =
        u.ended_at !== null ||
        (sub ? ["canceled", "inactive", "expired"].includes(sub.status) : false) ||
        (sa ? ["inactive", "dead", "replaced"].includes(sa.status) : false)

      const status: "active" | "inactive" = isUsageInactive ? "inactive" : "active"
      if (status === "inactive") {
        hasInactivePlatforms = true
        if (u.ended_at && (!lastEndedAt || u.ended_at > lastEndedAt)) {
          lastEndedAt = u.ended_at
        }
      } else {
        hasActivePlatforms = true
      }

      platformDetails.push({
        id: `usage:${u.id}`,
        platformName,
        platformSlug,
        platformPassword: text(u.platform_password),
        status,
        statusLabel: isUsageInactive ? "Inactivo" : "Activo",
        startedAt: u.started_at,
        endedAt: u.ended_at,
        customerName: text(customer?.display_name),
        purpose: u.purpose,
        notes: text(u.notes),
      })
    }

    // 2. Process Spotify Family Members history
    for (const mem of emailSpotifyMembers) {
      const sa = one(mem.service_accounts)
      const currentSub = one(mem.current_subscription)
      const sourceSub = one(mem.source_subscription)
      const currentCustomer = one(currentSub?.customers)
      const sourceCustomer = one(sourceSub?.customers)

      const isMemberInactive =
        mem.status === "removed" ||
        mem.status === "available" ||
        mem.removed_at !== null ||
        (sourceSub && ["canceled", "inactive"].includes(sourceSub.status) && !mem.current_subscription_id)

      let status: "active" | "removed" | "available" | "moved" = "active"
      let statusLabel = "Activo en plan"

      if (mem.status === "removed") {
        status = "removed"
        statusLabel = "Removido del plan"
      } else if (mem.status === "available") {
        status = "available"
        statusLabel = "Liberado / Cupo disponible"
      } else if (
        mem.current_subscription_id === null &&
        mem.source_subscription_id &&
        isMemberInactive
      ) {
        status = "moved"
        statusLabel = "Movido / Expirado"
      }

      if (isMemberInactive) {
        hasInactivePlatforms = true
        if (mem.removed_at && (!lastEndedAt || mem.removed_at > lastEndedAt)) {
          lastEndedAt = mem.removed_at
        }
      } else {
        hasActivePlatforms = true
      }

      // Calculate Spotify 12-month rule (365 days after removedAt)
      let isEligibleForNewPlan = true
      let eligibleAfterDate: string | null = null
      if (mem.removed_at) {
        const removedDate = new Date(mem.removed_at)
        const eligibleDate = new Date(removedDate)
        eligibleDate.setDate(eligibleDate.getDate() + 365)
        eligibleAfterDate = eligibleDate.toISOString().slice(0, 10)
        isEligibleForNewPlan = Date.now() >= eligibleDate.getTime()
      }

      familyPlanHistory.push({
        id: `member:${mem.id}`,
        platformName: "Spotify",
        planLabel: sa?.label ?? "Plan Spotify",
        memberName: text(mem.member_name),
        loginEmail: mem.login_email,
        loginPassword: text(mem.login_password),
        emailPassword: text(mem.email_password),
        status,
        statusLabel,
        joinedAt: mem.created_at,
        removedAt: mem.removed_at,
        customerName: text(currentCustomer?.display_name ?? sourceCustomer?.display_name),
        isEligibleForNewPlan,
        eligibleAfterDate,
      })

      // Also ensure it's represented as a platform detail if not already duplicate
      const alreadyInDetails = platformDetails.some(
        (p) =>
          p.platformSlug === "spotify" &&
          (p.platformPassword === mem.login_password || p.startedAt === mem.created_at)
      )
      if (!alreadyInDetails) {
        platformDetails.push({
          id: `spotify-member:${mem.id}`,
          platformName: "Spotify",
          platformSlug: "spotify",
          platformPassword: text(mem.login_password),
          status: isMemberInactive ? "inactive" : "active",
          statusLabel: isMemberInactive ? "Inactivo (Spotify)" : "Activo (Spotify)",
          startedAt: mem.created_at,
          endedAt: mem.removed_at,
          customerName: text(currentCustomer?.display_name ?? sourceCustomer?.display_name),
          purpose: `Miembro plan ${sa?.label ?? "Spotify"}`,
          notes: mem.member_name ? `Perfil: ${mem.member_name}` : null,
        })
      }
    }

    // 3. Process direct Service Accounts linked to this email (if not present in usages)
    const directAccounts = [
      ...(serviceAccountsByEmailKey.get(emailItem.id) ?? []),
      ...(serviceAccountsByEmailKey.get(emailNorm) ?? []),
    ]
    const seenSaIds = new Set<string>()
    for (const sa of directAccounts) {
      if (seenSaIds.has(sa.id)) continue
      seenSaIds.add(sa.id)

      const s = one(sa.services)
      const cred = one(sa.account_credentials)
      const isSaInactive = ["inactive", "dead", "replaced"].includes(sa.status)
      if (isSaInactive) {
        hasInactivePlatforms = true
        if (sa.dead_at && (!lastEndedAt || sa.dead_at > lastEndedAt)) {
          lastEndedAt = sa.dead_at
        }
      } else {
        hasActivePlatforms = true
      }

      const alreadyTracked = platformDetails.some(
        (p) => p.platformSlug === s?.slug && p.customerName === null
      )
      if (!alreadyTracked) {
        platformDetails.push({
          id: `sa:${sa.id}`,
          platformName: s?.name ?? sa.label,
          platformSlug: s?.slug ?? null,
          platformPassword: text(cred?.secret_payload),
          status: isSaInactive ? "inactive" : "active",
          statusLabel: isSaInactive ? "Inactivo (Cuenta)" : "Activo (Cuenta)",
          startedAt: sa.started_at,
          endedAt: sa.dead_at,
          customerName: null,
          purpose: `Cuenta madre: ${sa.label}`,
          notes: null,
        })
      }
    }

    // Only include in this view if it has AT LEAST ONE INACTIVE PLATFORM!
    if (hasInactivePlatforms) {
      entries.push({
        id: emailItem.id,
        email: emailItem.email,
        emailPassword: text(emailItem.email_password),
        origin: emailItem.origin === "provider" ? "provider" : "self",
        providerName: provider?.name ?? null,
        status: emailItem.status === "inactive" ? "inactive" : "active",
        notes: text(emailItem.notes),
        hasInactivePlatforms,
        hasActivePlatforms,
        platforms: platformDetails,
        familyPlans: familyPlanHistory,
        lastEndedAt,
      })
    }
  }

  // Order by most recently ended or created
  return entries.sort((a, b) => {
    const left = a.lastEndedAt ? Date.parse(a.lastEndedAt) : 0
    const right = b.lastEndedAt ? Date.parse(b.lastEndedAt) : 0
    return right - left
  })
}
