"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  CheckIcon,
  CopyIcon,
  KeyRoundIcon,
  MailIcon,
  PlusCircleIcon,
  SearchIcon,
  ShieldAlertIcon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

import type { EmailHistoryEntry } from "./data"
import { EmailHistoryDeleteDialog } from "./email-history-delete-dialog"
import { EmailHistoryDetailDialog } from "./email-history-dialog"

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success(`${label} copiada`)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      className="h-6 w-6 text-muted-foreground hover:text-foreground inline-flex ml-1"
      onClick={handleCopy}
      title={`Copiar ${label.toLowerCase()}`}
    >
      {copied ? <CheckIcon className="size-3.5 text-emerald-600" /> : <CopyIcon className="size-3.5" />}
    </Button>
  )
}

export function EmailHistoryTable({
  initialEntries,
}: {
  initialEntries: EmailHistoryEntry[]
}) {
  const [entries, setEntries] = useState(initialEntries)
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<"all" | "free" | "mixed">("all")
  const [selectedEntry, setSelectedEntry] = useState<EmailHistoryEntry | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteEntry, setDeleteEntry] = useState<EmailHistoryEntry | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const filteredEntries = useMemo(() => {
    const q = query.trim().toLowerCase()
    return entries.filter((item) => {
      // Filter tab
      if (filter === "free" && item.hasActivePlatforms) return false
      if (filter === "mixed" && !item.hasActivePlatforms) return false

      if (!q) return true

      // Search in email, platforms, provider, passwords
      const matchesEmail = item.email.toLowerCase().includes(q)
      const matchesProvider = item.providerName?.toLowerCase().includes(q) ?? false
      const matchesPlatforms = item.platforms.some(
        (p) =>
          p.platformName.toLowerCase().includes(q) ||
          p.purpose.toLowerCase().includes(q) ||
          (p.customerName?.toLowerCase().includes(q) ?? false)
      )
      const matchesFamily = item.familyPlans.some(
        (f) =>
          f.planLabel.toLowerCase().includes(q) ||
          (f.memberName?.toLowerCase().includes(q) ?? false) ||
          (f.customerName?.toLowerCase().includes(q) ?? false)
      )

      return matchesEmail || matchesProvider || matchesPlatforms || matchesFamily
    })
  }, [entries, query, filter])

  const openDetail = (entry: EmailHistoryEntry) => {
    setSelectedEntry(entry)
    setDialogOpen(true)
  }

  const openDelete = (e: React.MouseEvent, entry: EmailHistoryEntry) => {
    e.stopPropagation()
    setDeleteEntry(entry)
    setDeleteDialogOpen(true)
  }

  const handleDeleted = (deletedId: string) => {
    setEntries((prev) => prev.filter((item) => item.id !== deletedId))
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Search & Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por correo, plataforma, cliente..."
            className="pl-9"
          />
        </div>

        <Tabs
          value={filter}
          onValueChange={(val) => setFilter(val as "all" | "free" | "mixed")}
        >
          <TabsList>
            <TabsTrigger value="all">
              Todos ({entries.length})
            </TabsTrigger>
            <TabsTrigger value="free">
              Completamente libres ({entries.filter((e) => !e.hasActivePlatforms).length})
            </TabsTrigger>
            <TabsTrigger value="mixed">
              Uso mixto ({entries.filter((e) => e.hasActivePlatforms).length})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Main Table */}
      <div className="rounded-xl border overflow-x-auto bg-card">
        <Table className="min-w-[55rem]">
          <TableHeader>
            <TableRow>
              <TableHead>Correo guardado</TableHead>
              <TableHead>Clave del correo</TableHead>
              <TableHead>Plataformas asociadas</TableHead>
              <TableHead>Planes familiares</TableHead>
              <TableHead>Última finalización</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEntries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No se encontraron correos con los filtros seleccionados.
                </TableCell>
              </TableRow>
            ) : (
              filteredEntries.map((item) => {
                // Group platform badges
                const uniquePlatforms = Array.from(
                  new Map(
                    item.platforms.map((p) => [p.platformName, p])
                  ).values()
                )

                return (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer hover:bg-muted/40 transition-colors"
                    onClick={() => openDetail(item)}
                  >
                    {/* Correo */}
                    <TableCell className="align-top font-medium">
                      <div className="flex items-center gap-1.5">
                        <MailIcon className="size-4 text-primary shrink-0" />
                        <span className="break-all">{item.email}</span>
                        <CopyButton text={item.email} label="Correo" />
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>Origen: {item.origin === "self" ? "Propio" : "Proveedor"}</span>
                        {item.providerName && <span>· {item.providerName}</span>}
                      </div>
                    </TableCell>

                    {/* Clave del correo */}
                    <TableCell className="align-top">
                      {item.emailPassword ? (
                        <div className="flex items-center gap-1 font-mono text-xs">
                          <span className="truncate max-w-[8rem] text-muted-foreground">
                            ••••••••
                          </span>
                          <CopyButton text={item.emailPassword} label="Clave de correo" />
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Sin clave</span>
                      )}
                    </TableCell>

                    {/* Plataformas asociadas - Alto Contraste */}
                    <TableCell className="align-top">
                      <div className="flex flex-wrap gap-1.5 max-w-xs">
                        {uniquePlatforms.map((plat) => {
                          const hasActive = item.platforms.some(
                            (p) => p.platformName === plat.platformName && p.status === "active"
                          )
                          return (
                            <Badge
                              key={plat.id}
                              variant="outline"
                              className={`text-[11px] py-0 px-2 font-medium border ${
                                hasActive
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
                                  : "bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800"
                              }`}
                            >
                              <span
                                className={`size-1.5 rounded-full mr-1 inline-block ${
                                  hasActive ? "bg-emerald-600 dark:bg-emerald-400" : "bg-rose-600 dark:bg-rose-400"
                                }`}
                              />
                              {plat.platformName}: {hasActive ? "Activo" : "Inactivo"}
                            </Badge>
                          )
                        })}
                      </div>
                    </TableCell>

                    {/* Planes familiares */}
                    <TableCell className="align-top">
                      {item.familyPlans.length > 0 ? (
                        <div className="flex items-center gap-1.5 text-xs">
                          <UsersIcon className="size-4 text-muted-foreground shrink-0" />
                          <span>
                            {item.familyPlans.length}{" "}
                            {item.familyPlans.length === 1 ? "plan" : "planes"}
                          </span>
                          {item.familyPlans.some((f) => !f.isEligibleForNewPlan) && (
                            <span title="Restricción de 12 meses Spotify activa">
                              <ShieldAlertIcon className="size-3.5 text-amber-500 shrink-0 inline" />
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>

                    {/* Última finalización */}
                    <TableCell className="align-top text-xs text-muted-foreground whitespace-nowrap">
                      {item.lastEndedAt ? formatDate(item.lastEndedAt) : "N/D"}
                    </TableCell>

                    {/* Acciones */}
                    <TableCell className="align-top text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          onClick={() => openDetail(item)}
                          className="text-xs"
                        >
                          <KeyRoundIcon className="size-3.5 mr-1" />
                          Ver contraseñas
                        </Button>
                        <Button
                          nativeButton={false}
                          render={
                            <Link
                              href={`/admin/subscriptions?new=1&email=${encodeURIComponent(
                                item.email
                              )}`}
                            />
                          }
                          variant="ghost"
                          size="icon-xs"
                          title="Crear nueva venta con este correo"
                        >
                          <PlusCircleIcon className="size-4 text-primary" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={(e) => openDelete(e, item)}
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          title="Eliminar correo y sus plataformas"
                        >
                          <Trash2Icon className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Detailed Modal Dialog */}
      <EmailHistoryDetailDialog
        emailEntry={selectedEntry}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />

      {/* Delete Confirmation Dialog */}
      <EmailHistoryDeleteDialog
        emailEntry={deleteEntry}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onDeleted={handleDeleted}
      />
    </div>
  )
}
