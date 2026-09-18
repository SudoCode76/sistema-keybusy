"use client"

import { useTransition } from "react"
import { AlertTriangleIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import { deleteEmailWithRelations } from "@/app/actions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatDate } from "@/lib/date"

import type { EmailHistoryEntry } from "./data"

export function EmailHistoryDeleteDialog({
  emailEntry,
  open,
  onOpenChange,
  onDeleted,
}: {
  emailEntry: EmailHistoryEntry | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted?: (deletedId: string) => void
}) {
  const [isPending, startTransition] = useTransition()

  if (!emailEntry) return null

  const activePlatforms = emailEntry.platforms.filter((p) => p.status === "active")
  const inactivePlatforms = emailEntry.platforms.filter((p) => p.status === "inactive")

  const handleDelete = () => {
    startTransition(async () => {
      try {
        const formData = new FormData()
        formData.append("id", emailEntry.id)
        await deleteEmailWithRelations(formData)
        toast.success(`Correo ${emailEntry.email} eliminado con éxito`)
        onOpenChange(false)
        if (onDeleted) onDeleted(emailEntry.id)
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "No se pudo eliminar el correo"
        )
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <Trash2Icon className="size-5 shrink-0" />
            <DialogTitle className="text-base sm:text-lg font-semibold leading-snug">
              ¿Eliminar correo y sus plataformas relacionadas?
            </DialogTitle>
          </div>
          <DialogDescription className="break-all font-mono text-xs font-medium text-foreground">
            {emailEntry.email}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {emailEntry.hasActivePlatforms ? (
            <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
              <AlertTriangleIcon className="size-4 shrink-0" />
              <AlertTitle className="font-semibold">¡Atención: Servicios activos detectados!</AlertTitle>
              <AlertDescription className="text-xs">
                Este correo tiene <strong>{activePlatforms.length}</strong> plataforma(s) en estado{" "}
                <strong>Activo</strong>. Si procedes, el correo y todos sus historiales de uso serán
                eliminados permanentemente del sistema.
              </AlertDescription>
            </Alert>
          ) : (
            <p className="text-xs text-muted-foreground">
              Este correo está libre de servicios activos. Se eliminará del inventario junto con todos
              los registros históricos y usos que tuvo asociados.
            </p>
          )}

          {/* Resumen de plataformas a eliminar */}
          <div className="rounded-xl border bg-muted/30 p-3 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Resumen de plataformas asociadas ({emailEntry.platforms.length})
            </div>

            {emailEntry.platforms.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                Sin plataformas asociadas registradas.
              </p>
            ) : (
              <div className="divide-y rounded-lg border bg-background text-xs max-h-48 overflow-y-auto">
                {emailEntry.platforms.map((plat) => (
                  <div key={plat.id} className="p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">{plat.platformName}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {plat.customerName ? `Cliente: ${plat.customerName}` : plat.purpose}
                        {plat.endedAt ? ` · Fin: ${formatDate(plat.endedAt)}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0 self-start sm:self-auto">
                      {plat.status === "active" ? (
                        <Badge
                          variant="default"
                          className="bg-emerald-600 hover:bg-emerald-700 text-[10px] px-1.5 py-0"
                        >
                          Activo
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-rose-300 text-rose-700 dark:border-rose-800 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 text-[10px] px-1.5 py-0 font-medium"
                        >
                          Inactivo
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Planes familiares si los hay */}
            {emailEntry.familyPlans.length > 0 && (
              <div className="pt-2">
                <span className="text-xs font-medium text-foreground block mb-1">
                  Planes familiares de Spotify registrados ({emailEntry.familyPlans.length}):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {emailEntry.familyPlans.map((fp) => (
                    <Badge key={fp.id} variant="secondary" className="text-[11px]">
                      {fp.planLabel} ({fp.statusLabel})
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
            className="w-full sm:w-auto"
          >
            {isPending ? "Eliminando..." : "Eliminar definitivamente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
