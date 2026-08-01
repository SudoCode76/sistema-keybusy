import type { NextRequest } from "next/server"

import { getCurrentUser } from "@/lib/auth"

import { getSubscriptionsPage } from "../data"

export async function GET(request: NextRequest) {
  const { supabase, user, profile } = await getCurrentUser()

  if (!user) return Response.json({ error: "No autorizado" }, { status: 401 })
  if (profile?.role !== "admin") return Response.json({ error: "Prohibido" }, { status: 403 })

  const params = request.nextUrl.searchParams

  try {
    return Response.json(
      await getSubscriptionsPage(supabase, {
        page: Math.max(1, Number(params.get("page")) || 1),
        query: params.get("q") ?? "",
        platform: params.get("platform") ?? "all",
        showCanceled: params.get("canceled") === "1",
        onlyReminded: params.get("reminded") === "1",
      })
    )
  } catch {
    return Response.json({ error: "No se pudieron cargar los accesos" }, { status: 500 })
  }
}
