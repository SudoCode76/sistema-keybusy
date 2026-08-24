"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Input } from "@/components/ui/input"

const typeOptions = [
  ["all", "Todos los registros"],
  ["service_account", "Cuentas madre"],
  ["subscription", "Accesos y ventas"],
  ["family_member", "Miembros familiares"],
] as const

const statusOptions = [
  ["all", "Todos los estados"],
  ["inactive", "Archivada"],
  ["dead", "Dada de baja"],
  ["replaced", "Reemplazada"],
  ["canceled", "Venta cancelada"],
  ["moved", "Movido a otro plan"],
  ["removed", "Eliminado de Spotify"],
  ["available", "Liberado de Spotify"],
] as const

function selectClassName() {
  return "h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
}

export function HistoryFilters({
  platforms,
  initialQuery,
}: {
  platforms: { slug: string; name: string }[]
  initialQuery: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(initialQuery)
  const queryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const platform = searchParams.get("platform") ?? "all"
  const type = searchParams.get("type") ?? "all"
  const status = searchParams.get("status") ?? "all"
  const dateFrom = searchParams.get("from") ?? ""
  const dateTo = searchParams.get("to") ?? ""

  useEffect(() => {
    return () => {
      if (queryTimer.current) clearTimeout(queryTimer.current)
    }
  }, [])

  function replaceFilters(next: Partial<Record<string, string>>) {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("page")
    for (const [key, value] of Object.entries(next)) {
      if (value && value !== "all") params.set(key, value)
      else params.delete(key)
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  function handleQueryChange(value: string) {
    setQuery(value)
    if (queryTimer.current) clearTimeout(queryTimer.current)
    queryTimer.current = setTimeout(() => {
      replaceFilters({ q: value.trim() })
    }, 250)
  }

  return (
    <div className="grid gap-3 rounded-xl border bg-muted/20 p-3 md:grid-cols-[minmax(16rem,1fr)_auto_auto_auto_auto_auto]">
      <Input
        aria-label="Buscar correo, cliente, cuenta o plataforma"
        onChange={(event) => handleQueryChange(event.target.value)}
        placeholder="Buscar correo, cliente, cuenta o plataforma"
        value={query}
      />
      <select
        aria-label="Filtrar por plataforma"
        className={selectClassName()}
        onChange={(event) => {
          replaceFilters({ platform: event.target.value })
        }}
        value={platform}
      >
        <option value="all">Todas las plataformas</option>
        {platforms.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
      </select>
      <select
        aria-label="Filtrar por tipo"
        className={selectClassName()}
        onChange={(event) => {
          replaceFilters({ type: event.target.value })
        }}
        value={type}
      >
        {typeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <select
        aria-label="Filtrar por estado"
        className={selectClassName()}
        onChange={(event) => {
          replaceFilters({ status: event.target.value })
        }}
        value={status}
      >
        {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <Input
        aria-label="Desde fecha"
        onChange={(event) => {
          replaceFilters({ from: event.target.value })
        }}
        type="date"
        value={dateFrom}
      />
      <Input
        aria-label="Hasta fecha"
        onChange={(event) => {
          replaceFilters({ to: event.target.value })
        }}
        type="date"
        value={dateTo}
      />
    </div>
  )
}
