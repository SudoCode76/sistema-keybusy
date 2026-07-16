import type { NextRequest } from "next/server"

import { getCurrentUser } from "@/lib/auth"

import { getEmailsPage } from "../data"

export async function GET(request: NextRequest) {
  const { supabase, user, profile } = await getCurrentUser()

  if (!user) return Response.json({ error: "No autorizado" }, { status: 401 })
  if (profile?.role !== "admin") return Response.json({ error: "Prohibido" }, { status: 403 })

  const params = request.nextUrl.searchParams

  try {
    return Response.json(
      await getEmailsPage(supabase, {
        page: Math.max(1, Number(params.get("page")) || 1),
        query: params.get("q") ?? "",
        filter: params.get("filter") ?? "available",
        options: params.get("options") === "1",
      })
    )
  } catch {
    return Response.json({ error: "No se pudieron cargar los correos" }, { status: 500 })
  }
}
