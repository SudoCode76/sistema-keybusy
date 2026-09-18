"use client"

import { useState } from "react"
import {
  AlertTriangleIcon,
  CalendarIcon,
  CheckIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  KeyRoundIcon,
  MailIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  UserCheckIcon,
  UsersIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDate } from "@/lib/date"

import type { EmailHistoryEntry } from "./data"

function CopyableValue({
  value,
  label,
  isSecret = false,
}: {
  value: string | null | undefined
  label: string
  isSecret?: boolean
}) {
  const [show, setShow] = useState(false)
  const [copied, setCopied] = useState(false)

  if (!value) {
    return <span className="text-muted-foreground italic text-xs">No registrada</span>
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    toast.success(`${label} copiada al portapapeles`)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-1.5 font-mono text-xs">
      <span className="truncate max-w-[14rem] sm:max-w-[20rem]">
        {isSecret && !show ? "••••••••••••" : value}
      </span>
      {isSecret && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          onClick={() => setShow(!show)}
          title={show ? "Ocultar" : "Mostrar"}
        >
          {show ? <EyeOffIcon className="size-3.5" /> : <EyeIcon className="size-3.5" />}
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="h-6 w-6 text-muted-foreground hover:text-foreground"
        onClick={handleCopy}
        title="Copiar"
      >
        {copied ? (
          <CheckIcon className="size-3.5 text-emerald-600" />
        ) : (
          <CopyIcon className="size-3.5" />
        )}
      </Button>
    </div>
  )
}

export function EmailHistoryDetailDialog({
  emailEntry,
  open,
  onOpenChange,
}: {
  emailEntry: EmailHistoryEntry | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  if (!emailEntry) return null

  const activePlatforms = emailEntry.platforms.filter((p) => p.status === "active")
  const inactivePlatforms = emailEntry.platforms.filter((p) => p.status === "inactive")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-xl font-semibold break-all">
              <MailIcon className="size-5 text-primary shrink-0" />
              {emailEntry.email}
            </DialogTitle>
            <div className="flex items-center gap-1.5">
              {emailEntry.hasActivePlatforms ? (
                <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400">
                  Uso mixto (Activo + Inactivo)
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-muted text-muted-foreground">
                  Completamente libre / inactivo
                </Badge>
              )}
            </div>
          </div>
          <DialogDescription className="text-xs">
            Historial detallado de accesos, contraseñas de servicios y registros de planes familiares.
          </DialogDescription>
        </DialogHeader>

        {/* Box: Correo y Clave del buzón */}
        <div className="rounded-xl border bg-muted/40 p-4 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Credenciales del buzón de correo
          </div>
          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <span className="text-xs text-muted-foreground block mb-0.5">Correo electrónico:</span>
              <CopyableValue value={emailEntry.email} label="Correo" />
            </div>
            <div>
              <span className="text-xs text-muted-foreground block mb-0.5">
                Contraseña del buzón (Outlook / Gmail):
              </span>
              <CopyableValue
                value={emailEntry.emailPassword}
                label="Contraseña de correo"
                isSecret
              />
            </div>
            {emailEntry.providerName && (
              <div>
                <span className="text-xs text-muted-foreground block mb-0.5">Proveedor:</span>
                <span className="text-xs font-medium">{emailEntry.providerName}</span>
              </div>
            )}
            {emailEntry.notes && (
              <div className="sm:col-span-2">
                <span className="text-xs text-muted-foreground block mb-0.5">Notas del correo:</span>
                <span className="text-xs text-muted-foreground">{emailEntry.notes}</span>
              </div>
            )}
          </div>
        </div>

        {/* Tabs: Plataformas y Planes Familiares */}
        <Tabs defaultValue="platforms" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="platforms" className="text-xs">
              Plataformas ({emailEntry.platforms.length})
            </TabsTrigger>
            <TabsTrigger value="family" className="text-xs flex items-center gap-1.5">
              <UsersIcon className="size-3.5" />
              Planes familiares ({emailEntry.familyPlans.length})
            </TabsTrigger>
          </TabsList>

          {/* Pestaña: Plataformas asociadas */}
          <TabsContent value="platforms" className="space-y-3 pt-2">
            {emailEntry.platforms.length === 0 ? (
              <p className="text-center py-6 text-sm text-muted-foreground">
                No hay plataformas registradas para este correo.
              </p>
            ) : (
              <div className="divide-y rounded-xl border">
                {emailEntry.platforms.map((platform) => (
                  <div key={platform.id} className="p-3.5 space-y-2 text-sm hover:bg-muted/20 transition-colors">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">
                          {platform.platformName}
                        </span>
                        {platform.status === "active" ? (
                          <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-xs">
                            Activo
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">
                            Inactivo / Finalizado
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <CalendarIcon className="size-3.5" />
                        {platform.startedAt ? formatDate(platform.startedAt) : "Inicio n/d"}
                        {" — "}
                        {platform.endedAt ? formatDate(platform.endedAt) : "Presente"}
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 pt-1">
                      <div className="rounded-lg bg-background p-2 border">
                        <span className="text-[11px] font-medium text-muted-foreground block mb-0.5">
                          Contraseña en esta plataforma:
                        </span>
                        <CopyableValue
                          value={platform.platformPassword}
                          label={`Contraseña de ${platform.platformName}`}
                          isSecret
                        />
                      </div>
                      <div className="rounded-lg bg-background p-2 border flex flex-col justify-center">
                        <span className="text-[11px] font-medium text-muted-foreground block">
                          Cliente / Asignación:
                        </span>
                        <span className="text-xs font-medium">
                          {platform.customerName ?? (
                            <span className="text-muted-foreground italic">Sin cliente asignado</span>
                          )}
                        </span>
                      </div>
                    </div>

                    {platform.purpose && (
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground/80">Propósito/Producto:</span>{" "}
                        {platform.purpose}
                        {platform.notes ? ` · ${platform.notes}` : ""}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Pestaña: Historial de planes familiares */}
          <TabsContent value="family" className="space-y-4 pt-2">
            {emailEntry.familyPlans.length === 0 ? (
              <div className="rounded-xl border p-6 text-center text-sm text-muted-foreground space-y-1">
                <UsersIcon className="size-8 mx-auto text-muted-foreground/50 mb-2" />
                <p>Este correo nunca ha estado registrado como miembro en un plan familiar.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {emailEntry.familyPlans.map((plan) => (
                  <div
                    key={plan.id}
                    className="rounded-xl border p-4 space-y-3 bg-card hover:bg-muted/10 transition-colors"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-semibold text-sm sm:text-base flex items-center gap-2">
                          <span>{plan.planLabel}</span>
                          <span className="text-xs text-muted-foreground font-normal">({plan.platformName})</span>
                        </div>
                        {plan.memberName && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <UserCheckIcon className="size-3.5" />
                            Nombre de perfil: <span className="font-medium text-foreground">{plan.memberName}</span>
                          </div>
                        )}
                      </div>

                      <div>
                        {plan.status === "active" ? (
                          <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-xs">
                            {plan.statusLabel}
                          </Badge>
                        ) : plan.status === "removed" ? (
                          <Badge variant="destructive" className="text-xs">
                            {plan.statusLabel}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            {plan.statusLabel}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Spotify 12-Month Rule Notice */}
                    {plan.removedAt && (
                      <div
                        className={`rounded-lg p-2.5 text-xs flex items-start gap-2 border ${
                          plan.isEligibleForNewPlan
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                            : "bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300"
                        }`}
                      >
                        {plan.isEligibleForNewPlan ? (
                          <ShieldCheckIcon className="size-4 shrink-0 text-emerald-600 mt-0.5" />
                        ) : (
                          <AlertTriangleIcon className="size-4 shrink-0 text-amber-600 mt-0.5" />
                        )}
                        <div>
                          <p className="font-medium">
                            {plan.isEligibleForNewPlan
                              ? "Apto para ingresar a otro plan familiar de Spotify"
                              : "Restricción anual de Spotify activa (cambio de familia cada 12 meses)"}
                          </p>
                          <p className="text-[11px] opacity-90 mt-0.5">
                            Salió del plan el {formatDate(plan.removedAt)}.{" "}
                            {plan.isEligibleForNewPlan
                              ? "Ya han transcurrido más de 12 meses."
                              : `Podrá unirse a un plan diferente a partir de: ${formatDate(plan.eligibleAfterDate)}.`}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Credentials inside family plan */}
                    <div className="grid gap-2 sm:grid-cols-2 text-xs bg-muted/40 p-3 rounded-lg border">
                      <div>
                        <span className="text-muted-foreground block mb-0.5 font-medium">
                          Clave Spotify en este plan:
                        </span>
                        <CopyableValue
                          value={plan.loginPassword}
                          label="Contraseña de Spotify"
                          isSecret
                        />
                      </div>
                      <div>
                        <span className="text-muted-foreground block mb-0.5 font-medium">
                          Cliente histórico:
                        </span>
                        <span className="font-medium text-foreground">
                          {plan.customerName ?? <span className="italic text-muted-foreground">Sin cliente</span>}
                        </span>
                      </div>
                      <div className="sm:col-span-2 text-muted-foreground pt-1 flex items-center gap-2">
                        <CalendarIcon className="size-3.5" />
                        <span>
                          Ingreso: {plan.joinedAt ? formatDate(plan.joinedAt) : "n/d"}
                          {plan.removedAt ? ` · Salida: ${formatDate(plan.removedAt)}` : " · Actualmente activo"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
