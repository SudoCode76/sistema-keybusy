import type { NextRequest } from "next/server"

import { getCurrentUser } from "@/lib/auth"

import { checkSaleDuplicates } from "../duplicate-check"

export async function GET(request: NextRequest) {
  const { supabase, user, profile } = await getCurrentUser()

  if (!user) return Response.json({ error: "No autorizado" }, { status: 401 })
  if (profile?.role !== "admin") return Response.json({ error: "Prohibido" }, { status: 403 })

  const params = request.nextUrl.searchParams

  try {
    return Response.json(
      await checkSaleDuplicates(supabase, {
        countryId: params.get("countryId"),
        phone: params.get("phone") ?? "",
        telegramUsername: params.get("telegramUsername"),
        excludeSubscriptionId: params.get("excludeSubscriptionId"),
        excludeServiceAccountId: params.get("excludeServiceAccountId"),
        productSlug: params.get("productSlug") ?? "",
        loginEmail: params.get("loginEmail"),
      })
    )
  } catch {
    return Response.json({ error: "No se pudo comprobar el registro" }, { status: 500 })
  }
}
