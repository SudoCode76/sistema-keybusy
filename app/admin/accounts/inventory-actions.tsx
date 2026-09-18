"use client"

import {
  rotateSpotifyMotherAccount,
  demoteSpotifyMotherToMembers,
  createCost,
  deleteServiceAccount,
  markAccountDead,
  renewMotherAccount,
} from "@/app/actions"
import { InventoryForm } from "@/app/admin/accounts/inventory-form"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogForm,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { formatDate } from "@/lib/date"
import Link from "next/link"
import { nextRenewalSuggestion } from "@/app/admin/subscriptions/mother-access"
import { CheckIcon, CopyIcon, MoreHorizontalIcon } from "lucide-react"
import { useState } from "react"

import { FormSubmitButton } from "./form-submit-button"

type ServiceOption = {
  id: string
  name: string
  slug: string
  account_model: "private" | "mother"
  default_seat_capacity: number | null
}

type ProviderOption = {
  id: string
  name: string
  serviceIds: string[]
}

type SpotifyConversionClient = {
  id: string
  currentSubscriptionId: string | null
  serviceAccountId: string
  customerName: string
  contact: string | null
  memberName: string | null
  loginEmail: string | null
  status: string
  hasActiveSale: boolean
}

type Nested<T> = T | T[] | null | undefined

type InventoryAccount = {
  id: string
  service_id: string | null
  provider_id: string | null
  email_address_id: string | null
  label: string | null
  login_email: string | null
  username: string | null
  status: string
  started_at: string | null
  dead_at: string | null
  replacement_account_id: string | null
  base_cost_amount: number | null
  base_cost_currency: string | null
  base_cost_exchange_rate: number | null
  base_cost_usdt: number | null
  base_cost_bob: number | null
  renewal_due_on: string | null
  seat_capacity: number | null
  two_factor_url: string | null
  notes: string | null
  services?: Nested<{ name: string | null; slug: string | null; account_model: "private" | "mother" }>
  providers?: Nested<{ name: string | null }>
  email_addresses?: Nested<{
    email: string
    email_password: string | null
    origin: string
    provider_id: string | null
  }>
  spotify_family_plans?: Nested<{
    invite_url: string | null
    address: string | null
    seats_total: number | null
  }>
  account_credentials?: Nested<{ secret_payload: string | null }>
}

function one<T>(value: Nested<T>) {
  return Array.isArray(value) ? value[0] : value
}

export function parseSecretPayload(payload: string | null | undefined) {
  const parsed: Record<string, string> = {}

  for (const line of payload?.split(/\r?\n/) ?? []) {
    const [key, ...valueParts] = line.split(":")
    const value = valueParts.join(":").trim()
    if (key?.trim() && value) {
      parsed[key.trim()] = value
    }
  }

  return parsed
}

function durationText(startedAt: string | null, deadAt: string | null) {
  if (!startedAt) return null

  const end = deadAt ? new Date(deadAt) : new Date()
  const days = Math.max(0, Math.ceil((end.getTime() - new Date(startedAt).getTime()) / 86400000))

  return `${days} dias`
}

function CopyField({ label, value }: { label: string; value: string | null | undefined }) {
  const [copied, setCopied] = useState(false)

  if (!value) {
    return null
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(value ?? "")
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-center justify-between gap-3 rounded-lg border p-2">
        <p className="min-w-0 truncate text-sm">{value}</p>
        <Button type="button" variant="ghost" size="icon-sm" onClick={copy}>
          {copied ? <CheckIcon /> : <CopyIcon />}
          <span className="sr-only">Copiar</span>
        </Button>
      </div>
    </Field>
  )
}

export function InventoryActions({
  account,
  assignmentHref,
  assignmentLabel,
  assignmentUnavailableReason,
  replacementLabel,
  returnPath = "/admin/accounts",
  services,
  providers,
  spotifyConversionClients,
  spotifyFamilyPlans,
}: {
  account: InventoryAccount
  assignmentHref?: string
  assignmentLabel?: string
  assignmentUnavailableReason?: string
  replacementLabel?: string | null
  returnPath?: "/admin/accounts" | "/admin/personal-accounts"
  services: ServiceOption[]
  providers: ProviderOption[]
  spotifyConversionClients: SpotifyConversionClient[]
  spotifyFamilyPlans: Array<{
    id: string
    label: string | null
    loginEmail: string | null
    seatsTotal: number
    seatsUsed: number
    renewalDueOn: string | null
    isOverdue: boolean
  }>
}) {
  const [viewOpen, setViewOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [renewOpen, setRenewOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [convertOpen, setConvertOpen] = useState(false)
  const [rotateOpen, setRotateOpen] = useState(false)
  const [newMotherMemberId, setNewMotherMemberId] = useState("")
  const [conversionTargets, setConversionTargets] = useState<Record<string, string>>({})
  const spotifyPlan = one(account.spotify_family_plans)
  const isSpotify = one(account.services)?.slug === "spotify"
  const isMother = one(account.services)?.account_model === "mother"
  const isSpotifyMother = isSpotify && isMother
  const activeConversionClients = spotifyConversionClients.filter(
    (client) => client.hasActiveSale && client.currentSubscriptionId
  )
  const conversionAssignments = activeConversionClients.map((client) => ({
    subscription_id: client.currentSubscriptionId,
    target_service_account_id: conversionTargets[client.currentSubscriptionId ?? ""] || null,
  }))
  const [conversionState, setConversionState] = useState<{ error?: string }>({})
  const [conversionPending, setConversionPending] = useState(false)
  const credentials = one(account.account_credentials)
  const secrets = parseSecretPayload(credentials?.secret_payload)
  const platformPassword = secrets.platform_password ?? secrets.password
  const emailPassword = secrets.email_password
  const extraPasswords = Object.entries(secrets).filter(
    ([key]) =>
      key.toLowerCase().includes("password") &&
      !["password", "platform_password", "email_password"].includes(key)
  )

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className={buttonVariants({ variant: "outline", size: "sm" })}>
          <MoreHorizontalIcon data-icon="inline-start" />
          Opciones
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          <DropdownMenuGroup>
            <DropdownMenuItem
              disabled={!assignmentHref}
              render={assignmentHref ? <Link href={assignmentHref} /> : undefined}
              title={assignmentUnavailableReason}
            >
              {assignmentLabel ?? "Asignar a nuevo usuario"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setViewOpen(true)}>Ver cuenta</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setEditOpen(true)}>Editar cuenta</DropdownMenuItem>
            {account.status === "active" ? (
              <>
                <DropdownMenuItem onClick={() => setRenewOpen(true)}>
                  Renovar cuenta madre
                </DropdownMenuItem>
                <form action={markAccountDead}>
                  <input type="hidden" name="id" value={account.id} />
                  <FormSubmitButton pendingLabel="Marcando..." variant="ghost" size="sm">
                    Muerta
                  </FormSubmitButton>
                </form>
              </>
            ) : null}
            {isSpotifyMother && account.status === "active" ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setRotateOpen(true)}>
                  Reemplazar cuenta madre
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setConversionTargets(
                      Object.fromEntries(activeConversionClients.map((client) => [client.currentSubscriptionId as string, ""]))
                    )
                    setConvertOpen(true)
                  }}
                >
                  Convertir en miembros
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setArchiveOpen(true)}>
            Archivar cuenta
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={rotateOpen} onOpenChange={setRotateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Reemplazar cuenta madre (Spotify)</DialogTitle>
            <DialogDescription>
              Uno de los miembros actuales pasará a ser la nueva cuenta madre del plan. El antiguo titular quedará como miembro. Todos conservan sus fechas y pagos.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={async (event) => {
              event.preventDefault()
              setConversionPending(true)
              setConversionState({})
              try {
                const formData = new FormData(event.currentTarget)
                await rotateSpotifyMotherAccount(formData)
                setRotateOpen(false)
              } catch (error) {
                setConversionState({
                  error: error instanceof Error ? error.message : "No se pudo reemplazar la cuenta madre",
                })
              } finally {
                setConversionPending(false)
              }
            }}
          >
            <FieldGroup>
              <input name="source_account_id" type="hidden" value={account.id} />
              
              <Field>
                <FieldLabel>Selecciona el miembro que será la nueva cuenta madre</FieldLabel>
                <Select value={newMotherMemberId} onValueChange={(val) => setNewMotherMemberId(val || "")} name="new_mother_member_id" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar miembro..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activeConversionClients.filter(c => c.id).map(client => (
                      <SelectItem key={client.id} value={client.id}>
                        <div className="flex flex-col items-start">
                          <span className="font-medium">{client.memberName || client.customerName || "Miembro"}</span>
                          <span className="text-xs text-muted-foreground">{client.loginEmail || client.contact || "Sin correo"}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel htmlFor={`spotify_rotate_label_${account.id}`}>Etiqueta del nuevo plan</FieldLabel>
                <Input defaultValue={account.label ? `${account.label} (Nuevo)` : "Plan Spotify"} id={`spotify_rotate_label_${account.id}`} name="label" required />
              </Field>

              <Field>
                <FieldLabel>Proveedor (Opcional)</FieldLabel>
                <Select defaultValue={account.provider_id ?? "none"} name="provider_id">
                  <SelectTrigger><SelectValue placeholder="Sin proveedor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin proveedor</SelectItem>
                    {providers.map((provider) => <SelectItem key={provider.id} value={provider.id}>{provider.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor={`spotify_rotate_cost_${account.id}`}>Costo base</FieldLabel>
                  <Input defaultValue={account.base_cost_amount ?? "0"} id={`spotify_rotate_cost_${account.id}`} min="0" name="base_cost_amount" step="0.01" type="number" />
                </Field>
                <Field>
                  <FieldLabel>Moneda</FieldLabel>
                  <Select defaultValue={account.base_cost_currency ?? "USDT"} name="base_cost_currency">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="USDT">USDT</SelectItem><SelectItem value="BOB">BOB</SelectItem></SelectContent>
                  </Select>
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor={`spotify_rotate_rate_${account.id}`}>Tipo de cambio</FieldLabel>
                <Input defaultValue={account.base_cost_exchange_rate ?? ""} id={`spotify_rotate_rate_${account.id}`} min="0" name="base_cost_exchange_rate" step="0.000001" type="number" />
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor={`spotify_rotate_renewal_${account.id}`}>Próximo pago al proveedor</FieldLabel>
                  <Input defaultValue={account.renewal_due_on ?? ""} id={`spotify_rotate_renewal_${account.id}`} name="renewal_due_on" required type="date" />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`spotify_rotate_seats_${account.id}`}>Cupos de familia</FieldLabel>
                  <Input defaultValue={account.seat_capacity ?? "6"} id={`spotify_rotate_seats_${account.id}`} min={activeConversionClients.length + 1} name="seat_capacity" required type="number" />
                </Field>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field><FieldLabel htmlFor={`spotify_rotate_invite_${account.id}`}>Link de invitación (Nuevo)</FieldLabel><Input id={`spotify_rotate_invite_${account.id}`} name="invite_url" /></Field>
                <Field><FieldLabel htmlFor={`spotify_rotate_address_${account.id}`}>Dirección</FieldLabel><Input defaultValue={spotifyPlan?.address ?? ""} id={`spotify_rotate_address_${account.id}`} name="address" /></Field>
              </div>

              <Alert variant="default" className="bg-muted/50">
                <AlertTitle className="font-medium text-amber-600 dark:text-amber-500">Aviso sobre la regla de 12 meses</AlertTitle>
                <AlertDescription className="text-xs text-muted-foreground mt-1">
                  Si un miembro formó parte de otro plan familiar hace menos de 12 meses, Spotify podría no permitirle unirse a este nuevo enlace. En ese caso se requerirá que cambie de cuenta o apele a soporte. Esta operación de reemplazo archiva automáticamente el plan actual.
                </AlertDescription>
              </Alert>

              {conversionState.error ? (
                <Alert variant="destructive">
                  <AlertTitle>Error en la operación</AlertTitle>
                  <AlertDescription>{conversionState.error}</AlertDescription>
                </Alert>
              ) : null}

              <div className="flex justify-end gap-2">
                <Button onClick={() => setRotateOpen(false)} type="button" variant="outline">Cancelar</Button>
                <FormSubmitButton disabled={!newMotherMemberId} pendingLabel="Procesando...">Reemplazar cuenta</FormSubmitButton>
              </div>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Convertir cuenta madre en miembros</DialogTitle>
            <DialogDescription>
              Cada venta conservará su cliente, precio, fechas, pagos, credenciales e historial. Puedes moverla a otro plan o dejarla pendiente.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={async (event) => {
              event.preventDefault()
              setConversionPending(true)
              setConversionState({})
              try {
                const formData = new FormData(event.currentTarget)
                await demoteSpotifyMotherToMembers(formData)
                setConvertOpen(false)
              } catch (error) {
                setConversionState({
                  error: error instanceof Error ? error.message : "No se pudo convertir la cuenta",
                })
              } finally {
                setConversionPending(false)
              }
            }}
          >
            <FieldGroup>
              <input name="account_id" type="hidden" value={account.id} />
              <input name="assignments" type="hidden" value={JSON.stringify(conversionAssignments)} />
              {activeConversionClients.length ? (
                <div className="grid gap-3">
                  {activeConversionClients.map((client) => {
                    const subscriptionId = client.currentSubscriptionId as string
                    return (
                      <div className="grid gap-2 rounded-lg border p-3" key={subscriptionId}>
                        <div className="flex items-start justify-between gap-3 text-sm">
                          <div className="min-w-0">
                            <p className="font-medium">{client.memberName || client.customerName}</p>
                            <p className="break-all text-muted-foreground">{client.contact || client.loginEmail || "Sin correo"}</p>
                          </div>
                          <span className="shrink-0 text-xs text-muted-foreground">Venta activa</span>
                        </div>
                        <Select
                          value={conversionTargets[subscriptionId] ?? ""}
                          onValueChange={(value) => setConversionTargets((current) => ({ ...current, [subscriptionId]: value === "__pending__" ? "" : value ?? "" }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Pendiente de reasignación" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__pending__">Pendiente de reasignación</SelectItem>
                            {spotifyFamilyPlans
                              .filter((plan) => plan.id !== account.id)
                              .map((plan) => {
                                const isFull = plan.seatsUsed >= plan.seatsTotal
                                const unavailable = isFull || plan.isOverdue
                                return (
                                  <SelectItem disabled={unavailable} key={plan.id} value={plan.id}>
                                    {plan.label || "Plan Spotify"} · {plan.seatsUsed}/{plan.seatsTotal}{plan.isOverdue ? " · Vencido" : isFull ? " · Lleno" : ""}
                                  </SelectItem>
                                )
                              })}
                          </SelectContent>
                        </Select>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="rounded-lg border p-3 text-sm text-muted-foreground">
                  Esta cuenta no tiene clientes activos. Se archivará como la acción de archivado actual.
                </p>
              )}
              {conversionState.error ? (
                <Alert variant="destructive">
                  <AlertTitle>No se pudo convertir la cuenta</AlertTitle>
                  <AlertDescription>{conversionState.error}</AlertDescription>
                </Alert>
              ) : null}
              <div className="flex justify-end gap-2">
                <Button onClick={() => setConvertOpen(false)} type="button" variant="outline">Cancelar</Button>
                <Button disabled={conversionPending} type="submit">
                  {conversionPending ? "Convirtiendo..." : "Confirmar conversión"}
                </Button>
              </div>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archivar cuenta</DialogTitle>
            <DialogDescription>
              La cuenta <strong>{account.label}</strong> quedará inactiva. Se conservarán sus ventas, costos, credenciales e historial.
            </DialogDescription>
          </DialogHeader>
          <DialogForm action={deleteServiceAccount}>
            <input name="id" type="hidden" value={account.id} />
            <input name="return_path" type="hidden" value={returnPath} />
            <div className="flex justify-end gap-2">
              <Button onClick={() => setArchiveOpen(false)} type="button" variant="outline">
                Cancelar
              </Button>
              <FormSubmitButton pendingLabel="Archivando..." variant="destructive">
                Confirmar archivado
              </FormSubmitButton>
            </div>
          </DialogForm>
        </DialogContent>
      </Dialog>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{account.label}</DialogTitle>
            <DialogDescription>Datos listos para copiar.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <CopyField label="Correo" value={account.login_email ?? account.username} />
            <CopyField label="Contraseña plataforma" value={platformPassword} />
            <CopyField label="Contraseña correo" value={emailPassword} />
            {extraPasswords.map(([key, value]) => (
              <CopyField key={key} label={key} value={value} />
            ))}
            {isSpotify ? (
              <CopyField label="Dirección" value={spotifyPlan?.address} />
            ) : null}
            <CopyField label="Link plan familiar" value={spotifyPlan?.invite_url} />
            <CopyField label="Link 2FA" value={account.two_factor_url} />
            {!isSpotify ? (
              <>
                <CopyField label="Inicio" value={formatDate(account.started_at)} />
                <CopyField label="Muerte" value={account.dead_at ? formatDate(account.dead_at) : null} />
                <CopyField label="Duración" value={durationText(account.started_at, account.dead_at)} />
              </>
            ) : null}
            <CopyField label="Reemplazada por" value={replacementLabel} />
          </FieldGroup>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogTitle className="sr-only">Editar inventario</DialogTitle>
          <InventoryForm
            account={account}
            returnPath={returnPath}
            services={services}
            providers={providers}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={renewOpen} onOpenChange={setRenewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renovar cuenta madre</DialogTitle>
            <DialogDescription>
              Registra el próximo pago y el costo de {account.label}. Esto no modifica las ventas de los clientes.
            </DialogDescription>
          </DialogHeader>
          <DialogForm action={isMother ? renewMotherAccount : createCost}>
            <FieldGroup>
              <input type="hidden" name="service_account_id" value={account.id} />
              <input type="hidden" name="provider_id" value={account.provider_id ?? "none"} />
              <input type="hidden" name="cost_type" value="renewal" />
              {isMother ? (
                <Field>
                  <FieldLabel htmlFor={`next_renewal_${account.id}`}>
                    Próximo pago
                  </FieldLabel>
                  <Input
                    defaultValue={nextRenewalSuggestion(
                      account.renewal_due_on
                    )}
                    id={`next_renewal_${account.id}`}
                    name="next_renewal_on"
                    required
                    type="date"
                  />
                </Field>
              ) : null}
              <div className="grid gap-3 md:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor={`amount_${account.id}`}>Monto</FieldLabel>
                  <Input id={`amount_${account.id}`} name="amount" type="number" step="0.01" required />
                </Field>
                <Field>
                  <FieldLabel>Moneda</FieldLabel>
                  <Select name="currency" defaultValue="USDT">
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="USDT">USDT</SelectItem>
                        <SelectItem value="BOB">BOB</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor={`rate_${account.id}`}>Cambio</FieldLabel>
                  <Input id={`rate_${account.id}`} name="exchange_rate" type="number" step="0.000001" />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor={`notes_${account.id}`}>Notas</FieldLabel>
                <Textarea id={`notes_${account.id}`} name="notes" />
              </Field>
              <FormSubmitButton pendingLabel="Guardando...">Guardar renovación</FormSubmitButton>
            </FieldGroup>
          </DialogForm>
        </DialogContent>
      </Dialog>
    </>
  )
}
