"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDate } from "@/lib/date"

import type { EmailRow } from "./data"
import { EmailActions } from "./email-dialogs"

type ProviderOption = { id: string; name: string }

export function EmailsTable({
  initialRows,
  initialTotal,
  providers,
}: {
  initialRows: EmailRow[]
  initialTotal: number
  providers: ProviderOption[]
}) {
  const [filter, setFilter] = useState("available")
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState(initialRows)
  const [total, setTotal] = useState(initialTotal)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [refreshToken, setRefreshToken] = useState(0)
  const firstLoad = useRef(true)
  const totalPages = Math.max(1, Math.ceil(total / 20))

  useEffect(() => {
    const refresh = () => setRefreshToken((value) => value + 1)
    window.addEventListener("email-saved", refresh)
    return () => window.removeEventListener("email-saved", refresh)
  }, [])

  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false
      return
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setLoading(true)
      setError("")
      try {
        const params = new URLSearchParams({ page: String(page), filter })
        if (query.trim()) params.set("q", query.trim())
        const response = await fetch(`/admin/emails/data?${params}`, { signal: controller.signal })
        if (!response.ok) throw new Error()
        const result = (await response.json()) as { rows: EmailRow[]; total: number }
        setRows(result.rows)
        setTotal(result.total)
      } catch {
        if (!controller.signal.aborted) setError("No se pudieron cargar los correos.")
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, query ? 250 : 0)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [filter, page, query, refreshToken])

  return (
    <div className="flex flex-col gap-4">
      <Input
        aria-label="Buscar correo"
        className="md:max-w-sm"
        onChange={(event) => { setQuery(event.target.value); setPage(1) }}
        placeholder="Buscar correo"
        value={query}
      />
      <Tabs value={filter} onValueChange={(value) => { setFilter(value); setPage(1) }}>
        <TabsList>
          <TabsTrigger value="available">Disponibles</TabsTrigger>
          <TabsTrigger value="used">En uso</TabsTrigger>
          <TabsTrigger value="all">Todos</TabsTrigger>
        </TabsList>
      </Tabs>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Correo</TableHead>
            <TableHead>Origen</TableHead>
            <TableHead>Proveedor</TableHead>
            <TableHead>Usos activos</TableHead>
            <TableHead>Último uso</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? Array.from({ length: 5 }, (_, row) => (
            <TableRow key={row}>
              {Array.from({ length: 7 }, (_, cell) => (
                <TableCell key={cell}><Skeleton className="h-4 w-full" /></TableCell>
              ))}
            </TableRow>
          )) : rows.map((email) => (
            <TableRow key={email.id}>
              <TableCell className="font-medium">{email.email}</TableCell>
              <TableCell>{email.origin === "self" ? "Propio" : "Proveedor"}</TableCell>
              <TableCell>{email.providerName ?? "-"}</TableCell>
              <TableCell>{email.activeUsageCount}</TableCell>
              <TableCell>{email.lastUsedAt ? formatDate(email.lastUsedAt) : "-"}</TableCell>
              <TableCell>
                <Badge variant="secondary">{email.status === "active" ? "Activo" : "Desactivado"}</Badge>
              </TableCell>
              <TableCell><EmailActions email={email} providers={providers} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {!loading && rows.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Sin correos para este filtro.</div>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{total} registros · Página {page} de {totalPages}</p>
        <div className="flex gap-2">
          <Button aria-label="Página anterior" disabled={loading || page === 1} onClick={() => setPage((value) => value - 1)} size="icon" variant="outline">
            <ChevronLeftIcon />
          </Button>
          <Button aria-label="Página siguiente" disabled={loading || page === totalPages} onClick={() => setPage((value) => value + 1)} size="icon" variant="outline">
            <ChevronRightIcon />
          </Button>
        </div>
      </div>
    </div>
  )
}
