import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"

export type AppRole = "admin" | "customer"

export async function getCurrentUser() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()

  if (!data?.claims?.sub) {
    return { supabase, user: null, profile: null }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name, phone, status")
    .eq("id", data.claims.sub)
    .maybeSingle()

  return { supabase, user: data.claims, profile }
}

export async function requireUser() {
  const state = await getCurrentUser()

  if (!state.user) {
    redirect("/login")
  }

  return state
}

export async function requireAdmin() {
  const state = await requireUser()

  if (state.profile?.role !== "admin") {
    redirect("/portal")
  }

  return state
}
