"use client"

import { useActionState, useState } from "react"
import { CopyIcon, MoreHorizontalIcon } from "lucide-react"

import { assignPendingSpotifyMember, cancelSubscription, moveSpotifyMember, promoteSpotifyMemberToMother, removeOrphanedSpotifyMember, removeSpotifyMember, updateSpotifyMember, updateSpotifyMemberName } from "@/app/actions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { buttonVariants, Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatDate } from "@/lib/date"
import { FormSubmitButton } from "./form-submit-button"

function CopyValue({ label, value }: { label: string; value: string | null }) {
  const [copied, setCopied] = useState(false)

  if (!value) {
    return (
      <div className="grid gap-1 border-b pb-3 last:border-b-0 last:pb-0">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span>-</span>
      </div>
    )
  }

  const text = value

  async function copyValue() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div className="grid gap-1 border-b pb-3 last:border-b-0 last:pb-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <button
        aria-label={`Copiar ${label}`}
        className="flex max-w-full items-center gap-2 text-left font-medium hover:text-primary"
        onClick={copyValue}
        type="button"
      >
        <span className="min-w-0 break-all">{text}</span>
        {copied ? <span className="text-xs text-muted-foreground">Copiado</span> : <CopyIcon className="size-4 shrink-0" />}
      </button>
    </div>
  )
}

export function SpotifyMemberActions({
  accountId,
  currentPlanEmail,
  member,
  providers,
  targetPlans,
}: {
  accountId: string
  currentPlanEmail: string | null
  providers: Array<{ id: string; name: string }>
  targetPlans: Array<{
    id: string
    label: string | null
    loginEmail: string | null
    seatsTotal: number
    seatsUsed: number
    renewalDueOn: string | null
    isOverdue: boolean
  }>
  member: {
    id: string
    memberName: string | null
    loginEmail: string | null
    loginPassword: string | null
    emailPassword: string | null
    status: string
    sourceSubscriptionId: string | null
    currentSubscriptionId: string | null
    customerName: string
    contact: string | null
    profileLabel: string | null
    startsOn: string | null
    endsOn: string | null
    durationMonths: number | null
    serviceAccountLabel: string
    purchaseMode: string | null
    allowAccountReuseOnCancel: boolean
    hasActiveSale: boolean
  }
}) {
  const [nameOpen, setNameOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [promoteOpen, setPromoteOpen] = useState(false)
  const [pendingAssignOpen, setPendingAssignOpen] = useState(false)
  const [targetAccountId, setTargetAccountId] = useState("")
  const [pendingTargetAccountId, setPendingTargetAccountId] = useState("")
  const [editState, editAction] = useActionState(
    async (previousState: { error?: string }, formData: FormData) => {
      try {
        await updateSpotifyMember(formData)
        setEditOpen(false)
        return {}
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : "No se pudo actualizar el miembro",
        }
      }
    },
    {}
  )
  const [cancelState, cancelAction] = useActionState(
    async (previousState: { error?: string }, formData: FormData) => {
      try {
        await cancelSubscription(formData)
        setCancelOpen(false)
        return {}
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : "No se pudo dar de baja la venta",
        }
      }
    },
    {}
  )
  const [moveState, moveAction] = useActionState(
    async (previousState: { error?: string }, formData: FormData) => {
      try {
        await moveSpotifyMember(formData)
        setMoveOpen(false)
        setTargetAccountId("")
        return {}
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : "No se pudo cambiar el plan familiar",
        }
      }
    },
    {}
  )
  const [promoteState, promoteAction] = useActionState(
    async (_previousState: { error?: string }, formData: FormData) => {
      try {
        await promoteSpotifyMemberToMother(formData)
        setPromoteOpen(false)
        return {}
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : "No se pudo convertir el miembro",
        }
      }
    },
    {}
  )
  const [pendingAssignState, pendingAssignAction] = useActionState(
    async (_previousState: { error?: string }, formData: FormData) => {
      try {
        await assignPendingSpotifyMember(formData)
        setPendingAssignOpen(false)
        setPendingTargetAccountId("")
        return {}
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : "No se pudo reasignar el pendiente",
        }
      }
    },
    {}
  )

  const availableTargetPlans = targetPlans.filter(
    (plan) => plan.id !== accountId
  )
  const selectedTargetPlan = availableTargetPlans.find(
    (plan) => plan.id === targetAccountId
  )
  const selectedTargetUnavailable = Boolean(
    selectedTargetPlan &&
      (selectedTargetPlan.isOverdue ||
        selectedTargetPlan.seatsUsed >= selectedTargetPlan.seatsTotal)
  )
  const selectedPendingTarget = availableTargetPlans.find(
    (plan) => plan.id === pendingTargetAccountId
  )
  const selectedPendingUnavailable = Boolean(
    selectedPendingTarget &&
      (selectedPendingTarget.isOverdue || selectedPendingTarget.seatsUsed >= selectedPendingTarget.seatsTotal)
  )

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className={buttonVariants({ variant: "outline", size: "sm" })}>
          <MoreHorizontalIcon data-icon="inline-start" />
          Opciones
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setViewOpen(true)}>
              Ver cuenta
            </DropdownMenuItem>
            {member.status !== "removed" ? (
              <>
                <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  Editar miembro
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setNameOpen(true)}>
                  Asignar nombre
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPromoteOpen(true)}>
                  Convertir en cuenta madre
                </DropdownMenuItem>
                {member.status === "assigned" && member.currentSubscriptionId ? (
                  <DropdownMenuItem
                    disabled={availableTargetPlans.length === 0}
                    onClick={() => {
                      setTargetAccountId("")
                      setMoveOpen(true)
                    }}
                  >
                    Cambiar plan familiar
                  </DropdownMenuItem>
                ) : null}
                {member.currentSubscriptionId ? (
                  <DropdownMenuItem onClick={() => setCancelOpen(true)}>
                    Dar de baja venta
                  </DropdownMenuItem>
                ) : null}
              </>
            ) : null}
            {member.status === "available" && member.sourceSubscriptionId ? (
              <DropdownMenuItem
                onClick={() => {
                  setPendingTargetAccountId("")
                  setPendingAssignOpen(true)
                }}
              >
                Asignar a otro plan
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuGroup>
          {member.status === "assigned" && !member.hasActiveSale ? (
            <>
              <DropdownMenuSeparator />
              <form
                action={removeOrphanedSpotifyMember}
                onSubmit={(event) => {
                  if (!window.confirm("Este miembro no tiene una venta activa. ¿Quieres marcarlo como eliminado y conservar su historial?")) {
                    event.preventDefault()
                  }
                }}
              >
                <input name="member_id" type="hidden" value={member.id} />
                <DropdownMenuItem nativeButton render={<button type="submit" />} variant="destructive">
                  Eliminar miembro huérfano
                </DropdownMenuItem>
              </form>
            </>
          ) : null}
          {member.status === "available" ? (
            <>
              <DropdownMenuSeparator />
              <form
                action={removeSpotifyMember}
                onSubmit={(event) => {
                  if (!window.confirm("Confirma que ya eliminaste este miembro del plan familiar de Spotify. Esto liberará el cupo.")) {
                    event.preventDefault()
                  }
                }}
              >
                <input name="member_id" type="hidden" value={member.id} />
                <DropdownMenuItem nativeButton render={<button type="submit" />} variant="destructive">
                  Eliminar de Spotify
                </DropdownMenuItem>
              </form>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={promoteOpen} onOpenChange={setPromoteOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Convertir miembro en cuenta madre</DialogTitle>
            <DialogDescription>
              Se conservarán las credenciales, nombre, cliente, venta, pagos y todo el historial del miembro.
            </DialogDescription>
          </DialogHeader>
          <form action={promoteAction}>
            <FieldGroup>
              <input name="member_id" type="hidden" value={member.id} />
              <Field>
                <FieldLabel htmlFor={`spotify_promote_label_${member.id}`}>Etiqueta</FieldLabel>
                <Input defaultValue={member.memberName || member.loginEmail || "Plan Spotify"} id={`spotify_promote_label_${member.id}`} name="label" required />
              </Field>
              <Field>
                <FieldLabel>Proveedor</FieldLabel>
                <Select defaultValue="none" name="provider_id">
                  <SelectTrigger><SelectValue placeholder="Sin proveedor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin proveedor</SelectItem>
                    {providers.map((provider) => <SelectItem key={provider.id} value={provider.id}>{provider.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor={`spotify_promote_cost_${member.id}`}>Costo base</FieldLabel>
                  <Input defaultValue="0" id={`spotify_promote_cost_${member.id}`} min="0" name="base_cost_amount" step="0.01" type="number" />
                </Field>
                <Field>
                  <FieldLabel>Moneda</FieldLabel>
                  <Select defaultValue="USDT" name="base_cost_currency">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="USDT">USDT</SelectItem><SelectItem value="BOB">BOB</SelectItem></SelectContent>
                  </Select>
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor={`spotify_promote_rate_${member.id}`}>Tipo de cambio</FieldLabel>
                <Input id={`spotify_promote_rate_${member.id}`} min="0" name="base_cost_exchange_rate" step="0.000001" type="number" />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor={`spotify_promote_renewal_${member.id}`}>Próximo pago</FieldLabel>
                  <Input defaultValue={member.endsOn ?? ""} id={`spotify_promote_renewal_${member.id}`} name="renewal_due_on" required type="date" />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`spotify_promote_seats_${member.id}`}>Cupos</FieldLabel>
                  <Input defaultValue="6" id={`spotify_promote_seats_${member.id}`} min="1" name="seat_capacity" required type="number" />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field><FieldLabel htmlFor={`spotify_promote_invite_${member.id}`}>Link de invitación</FieldLabel><Input id={`spotify_promote_invite_${member.id}`} name="invite_url" /></Field>
                <Field><FieldLabel htmlFor={`spotify_promote_address_${member.id}`}>Dirección</FieldLabel><Input id={`spotify_promote_address_${member.id}`} name="address" /></Field>
              </div>
              {promoteState.error ? <Alert variant="destructive"><AlertTitle>No se pudo convertir</AlertTitle><AlertDescription>{promoteState.error}</AlertDescription></Alert> : null}
              <div className="flex justify-end gap-2"><Button onClick={() => setPromoteOpen(false)} type="button" variant="outline">Cancelar</Button><FormSubmitButton pendingLabel="Convirtiendo...">Convertir cuenta</FormSubmitButton></div>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={pendingAssignOpen} onOpenChange={setPendingAssignOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Asignar pendiente a otro plan</DialogTitle>
            <DialogDescription>La venta y el cliente seguirán siendo los mismos; solo cambiará el plan Spotify.</DialogDescription>
          </DialogHeader>
          <form action={pendingAssignAction}>
            <FieldGroup>
              <input name="member_id" type="hidden" value={member.id} />
              <input name="subscription_id" type="hidden" value={member.sourceSubscriptionId ?? ""} />
              <input name="target_service_account_id" type="hidden" value={pendingTargetAccountId} />
              <div className="rounded-lg border p-3 text-sm"><span className="font-medium">{member.customerName}</span><p className="break-all text-muted-foreground">{member.loginEmail || "Sin correo"}</p></div>
              <Field>
                <FieldLabel>Plan familiar destino</FieldLabel>
                <Select value={pendingTargetAccountId} onValueChange={(value) => setPendingTargetAccountId(value ?? "")}>
                  <SelectTrigger><SelectValue placeholder="Selecciona un plan familiar" /></SelectTrigger>
                  <SelectContent>
                    {availableTargetPlans.map((plan) => {
                      const isFull = plan.seatsUsed >= plan.seatsTotal
                      return <SelectItem disabled={plan.isOverdue || isFull} key={plan.id} value={plan.id}>{plan.label || "Plan Spotify"} · {plan.seatsUsed}/{plan.seatsTotal}{plan.isOverdue ? " · Vencido" : isFull ? " · Lleno" : ""}</SelectItem>
                    })}
                  </SelectContent>
                </Select>
              </Field>
              {pendingAssignState.error ? <Alert variant="destructive"><AlertTitle>No se pudo reasignar</AlertTitle><AlertDescription>{pendingAssignState.error}</AlertDescription></Alert> : null}
              <div className="flex justify-end gap-2"><Button onClick={() => setPendingAssignOpen(false)} type="button" variant="outline">Cancelar</Button><FormSubmitButton disabled={!pendingTargetAccountId || selectedPendingUnavailable} pendingLabel="Reasignando...">Confirmar asignación</FormSubmitButton></div>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Cambiar plan familiar</DialogTitle>
            <DialogDescription>
              Mueve este miembro a otro plan sin modificar su venta ni sus credenciales.
            </DialogDescription>
          </DialogHeader>
          <form action={moveAction}>
            <FieldGroup>
              <input name="member_id" type="hidden" value={member.id} />
              <input name="subscription_id" type="hidden" value={member.currentSubscriptionId ?? ""} />
              <input
                name="expected_current_service_account_id"
                type="hidden"
                value={accountId}
              />
              <input
                name="target_service_account_id"
                type="hidden"
                value={targetAccountId}
              />
              <div className="grid gap-3 rounded-lg border p-3 text-sm">
                <div className="grid gap-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Plan familiar actual
                  </span>
                  <span className="font-semibold">{member.serviceAccountLabel}</span>
                  <span className="break-all text-muted-foreground">
                    {currentPlanEmail || "Correo no configurado"}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4 border-t pt-3">
                  <span className="text-muted-foreground">Miembro</span>
                  <span className="max-w-[65%] break-all text-right">
                    {member.memberName || member.loginEmail || "Sin nombre"}
                  </span>
                </div>
              </div>
              <Field>
                <FieldLabel htmlFor={`spotify_move_target_${member.id}`}>
                  Plan familiar destino
                </FieldLabel>
                <Select
                  value={targetAccountId}
                  onValueChange={(value) => setTargetAccountId(value ?? "")}
                >
                  <SelectTrigger id={`spotify_move_target_${member.id}`}>
                    <SelectValue placeholder="Selecciona un plan familiar" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTargetPlans.map((plan) => {
                      const isFull = plan.seatsUsed >= plan.seatsTotal
                      const isUnavailable = plan.isOverdue || isFull
                      return (
                        <SelectItem disabled={isUnavailable} key={plan.id} value={plan.id}>
                          <span className="flex min-w-0 flex-col items-start">
                            <span>{plan.label || "Plan Spotify"} · {plan.seatsUsed}/{plan.seatsTotal}</span>
                            <span className="max-w-full truncate text-xs text-muted-foreground">
                              {plan.loginEmail || "Correo no configurado"}
                              {plan.isOverdue ? " · Vencido" : isFull ? " · Lleno" : ""}
                            </span>
                          </span>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </Field>
              {selectedTargetPlan ? (
                <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                  <div className="grid gap-1 border-b pb-3">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Plan familiar destino
                    </span>
                    <span className="font-semibold">
                      {selectedTargetPlan.label || "Plan Spotify"}
                    </span>
                    <span className="break-all text-muted-foreground">
                      {selectedTargetPlan.loginEmail || "Correo no configurado"}
                    </span>
                  </div>
                  <div className="mt-3 flex items-start justify-between gap-4">
                    <span className="text-muted-foreground">Disponibilidad</span>
                    <span className="text-right font-medium">
                      {selectedTargetPlan.seatsUsed}/{selectedTargetPlan.seatsTotal} cupos usados
                    </span>
                  </div>
                  <div className="mt-2 flex items-start justify-between gap-4">
                    <span className="text-muted-foreground">Renovación</span>
                    <span className="text-right">
                      {selectedTargetPlan.isOverdue
                        ? "Vencido"
                        : formatDate(selectedTargetPlan.renewalDueOn)}
                    </span>
                  </div>
                </div>
              ) : null}
              <p className="rounded-lg border p-3 text-sm text-muted-foreground">
                El cliente, las fechas, el precio, las credenciales y el nombre del miembro se conservarán.
              </p>
              {moveState.error ? (
                <Alert variant="destructive">
                  <AlertTitle>No se pudo cambiar el plan</AlertTitle>
                  <AlertDescription>{moveState.error}</AlertDescription>
                </Alert>
              ) : null}
              <div className="flex justify-end gap-2">
                <Button onClick={() => setMoveOpen(false)} type="button" variant="outline">
                  Cancelar
                </Button>
                <FormSubmitButton
                  disabled={!targetAccountId || selectedTargetUnavailable}
                  pendingLabel="Cambiando plan..."
                >
                  Confirmar cambio
                </FormSubmitButton>
              </div>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cuenta del miembro</DialogTitle>
            <DialogDescription>{member.serviceAccountLabel}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 text-sm">
            <CopyValue label="Correo de la cuenta" value={member.loginEmail} />
            <CopyValue label="Contraseña de la cuenta" value={member.loginPassword} />
            <CopyValue label="Contraseña del correo" value={member.emailPassword} />
            <div className="flex items-start justify-between gap-4 border-b pb-2">
              <span className="text-muted-foreground">Nombre</span>
              <span className="text-right font-medium">{member.memberName || "Sin nombre"}</span>
            </div>
            <div className="flex items-start justify-between gap-4 border-b pb-2">
              <span className="text-muted-foreground">Cliente</span>
              <span className="text-right font-medium">{member.customerName}</span>
            </div>
            <div className="flex items-start justify-between gap-4 border-b pb-2">
              <span className="text-muted-foreground">Correo o contacto</span>
              <span className="max-w-[65%] break-all text-right">{member.contact || "-"}</span>
            </div>
            <div className="flex items-start justify-between gap-4 border-b pb-2">
              <span className="text-muted-foreground">Perfil</span>
              <span className="text-right">{member.profileLabel || "Miembro familiar"}</span>
            </div>
            <div className="flex items-start justify-between gap-4 border-b pb-2">
              <span className="text-muted-foreground">Estado</span>
              <span className="text-right">{member.status}</span>
            </div>
            <div className="flex items-start justify-between gap-4 border-b pb-2">
              <span className="text-muted-foreground">Inicio</span>
              <span className="text-right">{formatDate(member.startsOn)}</span>
            </div>
            <div className="flex items-start justify-between gap-4 border-b pb-2">
              <span className="text-muted-foreground">Finaliza</span>
              <span className="text-right">{formatDate(member.endsOn)}</span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <span className="text-muted-foreground">Duración</span>
              <span className="text-right">
                {member.durationMonths
                  ? `${member.durationMonths} ${member.durationMonths === 1 ? "mes" : "meses"}`
                  : "-"}
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dar de baja venta</DialogTitle>
            <DialogDescription>
              Se cancelará la venta de {member.customerName} y se conservará su historial.
            </DialogDescription>
          </DialogHeader>
          <form action={cancelAction}>
            <FieldGroup>
              <input name="id" type="hidden" value={member.currentSubscriptionId ?? ""} />
              <input name="keep_account_available" type="hidden" value="1" />
              <p className="rounded-lg border p-3 text-sm text-muted-foreground">
                La cuenta madre se mantendrá activa para sus otros miembros y futuras asignaciones.
              </p>
              {cancelState.error ? (
                <Alert variant="destructive">
                  <AlertTitle>No se pudo dar de baja</AlertTitle>
                  <AlertDescription>{cancelState.error}</AlertDescription>
                </Alert>
              ) : null}
              <div className="flex justify-end gap-2">
                <Button onClick={() => setCancelOpen(false)} type="button" variant="outline">
                  Cancelar
                </Button>
                <FormSubmitButton pendingLabel="Dando de baja...">
                  Confirmar baja
                </FormSubmitButton>
              </div>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Editar miembro Spotify</DialogTitle>
            <DialogDescription>
              Si cambias el correo, el anterior conservará su historial y el nuevo quedará como acceso activo.
            </DialogDescription>
          </DialogHeader>
          <form action={editAction}>
            <FieldGroup>
              <input name="member_id" type="hidden" value={member.id} />
              <Field>
                <FieldLabel htmlFor={`spotify_edit_email_${member.id}`}>Correo de la cuenta</FieldLabel>
                <Input
                  defaultValue={member.loginEmail ?? ""}
                  id={`spotify_edit_email_${member.id}`}
                  name="login_email"
                  required
                  type="email"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`spotify_edit_password_${member.id}`}>Contraseña de la cuenta</FieldLabel>
                <Input
                  defaultValue={member.loginPassword ?? ""}
                  id={`spotify_edit_password_${member.id}`}
                  name="login_password"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`spotify_edit_email_password_${member.id}`}>Contraseña del correo</FieldLabel>
                <Input
                  defaultValue={member.emailPassword ?? ""}
                  id={`spotify_edit_email_password_${member.id}`}
                  name="email_password"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`spotify_edit_name_${member.id}`}>Nombre de la cuenta</FieldLabel>
                <Input
                  defaultValue={member.memberName ?? ""}
                  id={`spotify_edit_name_${member.id}`}
                  name="member_name"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`spotify_edit_profile_${member.id}`}>Perfil</FieldLabel>
                <Input
                  defaultValue={member.profileLabel ?? "Miembro familiar"}
                  id={`spotify_edit_profile_${member.id}`}
                  name="profile_label"
                />
              </Field>
              {editState.error ? (
                <Alert variant="destructive">
                  <AlertTitle>No se pudo actualizar</AlertTitle>
                  <AlertDescription>{editState.error}</AlertDescription>
                </Alert>
              ) : null}
              <FormSubmitButton pendingLabel="Guardando cambios...">
                Guardar y conservar historial
              </FormSubmitButton>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={nameOpen} onOpenChange={setNameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignar nombre</DialogTitle>
            <DialogDescription>El nombre se mostrará en la cuenta del miembro.</DialogDescription>
          </DialogHeader>
          <form action={updateSpotifyMemberName} onSubmit={() => setNameOpen(false)}>
            <FieldGroup>
              <input name="member_id" type="hidden" value={member.id} />
              <Field>
                <FieldLabel htmlFor={`spotify_member_name_${member.id}`}>Nombre de la cuenta</FieldLabel>
                <Input
                  defaultValue={member.memberName ?? ""}
                  id={`spotify_member_name_${member.id}`}
                  name="member_name"
                  placeholder="Ej. Familia principal"
                />
              </Field>
              <FormSubmitButton pendingLabel="Guardando...">Guardar</FormSubmitButton>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
