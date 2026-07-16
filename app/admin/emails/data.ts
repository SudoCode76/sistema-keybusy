import type { createClient } from "@/lib/supabase/server"

type ServerClient = Awaited<ReturnType<typeof createClient>>

export const EMAILS_PAGE_SIZE = 20

export type EmailUsageRow = {
  id: string
  purpose: string
  platformPassword: string | null
  startedAt: string
  endedAt: string | null
  notes: string | null
}

export type EmailRow = {
  id: string
  email: string
  emailPassword: string | null
  origin: "self" | "provider"
  providerId: string | null
  providerName: string | null
  status: "active" | "inactive"
  notes: string | null
  activeUsageCount: number
  lastUsedAt: string | null
  usages: EmailUsageRow[]
}

export async function getEmailsPage(
  supabase: ServerClient,
  {
    page = 1,
    query = "",
    filter = "available",
    options = false,
  }: {
    page?: number
    query?: string
    filter?: string
    options?: boolean
  } = {}
) {
  let emailQuery = supabase
    .from("email_inventory_view")
    .select("id, email, email_password, origin, provider_id, provider_name, status, notes, active_usage_count, last_used_at", { count: "exact" })

  const search = query.replace(/[(),%]/g, "").trim()
  if (search) emailQuery = emailQuery.ilike("email", `%${search}%`)

  if (options) {
    emailQuery = emailQuery.eq("origin", "self").eq("status", "active")
  } else if (filter === "available") {
    emailQuery = emailQuery
      .eq("origin", "self")
      .eq("status", "active")
      .eq("active_usage_count", 0)
  } else if (filter === "used") {
    emailQuery = emailQuery
      .eq("origin", "self")
      .eq("status", "active")
      .gt("active_usage_count", 0)
  }

  const from = (Math.max(1, page) - 1) * EMAILS_PAGE_SIZE
  const { data, count, error } = options
    ? await emailQuery.order("email").limit(10)
    : await emailQuery.order("email").range(from, from + EMAILS_PAGE_SIZE - 1)

  if (error) throw error

  const ids = (data ?? []).map((item) => item.id)
  const { data: usages, error: usagesError } = ids.length
    ? await supabase
        .from("email_usages")
        .select("id, email_address_id, purpose, platform_password, started_at, ended_at, notes")
        .in("email_address_id", ids)
        .order("started_at", { ascending: false })
    : { data: [], error: null }

  if (usagesError) throw usagesError

  const usagesByEmail = new Map<string, EmailUsageRow[]>()
  for (const usage of usages ?? []) {
    const rows = usagesByEmail.get(usage.email_address_id) ?? []
    rows.push({
      id: usage.id,
      purpose: usage.purpose,
      platformPassword: usage.platform_password,
      startedAt: usage.started_at,
      endedAt: usage.ended_at,
      notes: usage.notes,
    })
    usagesByEmail.set(usage.email_address_id, rows)
  }

  const rows: EmailRow[] = (data ?? []).map((item) => ({
    id: item.id,
    email: item.email,
    emailPassword: item.email_password,
    origin: item.origin === "provider" ? "provider" : "self",
    providerId: item.provider_id,
    providerName: item.provider_name,
    status: item.status === "inactive" ? "inactive" : "active",
    notes: item.notes,
    activeUsageCount: item.active_usage_count ?? 0,
    lastUsedAt: item.last_used_at,
    usages: usagesByEmail.get(item.id) ?? [],
  }))

  return { rows, total: count ?? 0 }
}
