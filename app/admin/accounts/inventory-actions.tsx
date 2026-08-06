"use client"

import {
  createCost,
  deleteServiceAccount,
  markAccountDead,
  renewMotherAccount,
} from "@/app/actions"
import { InventoryForm } from "@/app/admin/accounts/inventory-form"
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
}: {
  account: InventoryAccount
  assignmentHref?: string
  assignmentLabel?: string
  assignmentUnavailableReason?: string
  replacementLabel?: string | null
  returnPath?: "/admin/accounts" | "/admin/personal-accounts"
  services: ServiceOption[]
  providers: ProviderOption[]
}) {
  const [viewOpen, setViewOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [renewOpen, setRenewOpen] = useState(false)
  const spotifyPlan = one(account.spotify_family_plans)
  const isMother = one(account.services)?.account_model === "mother"
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
            <DropdownMenuItem onClick={() => setEditOpen(true)}>Editar</DropdownMenuItem>
            {account.status === "active" ? (
              <>
                <DropdownMenuItem onClick={() => setRenewOpen(true)}>Renovar</DropdownMenuItem>
                <form action={markAccountDead}>
                  <input type="hidden" name="id" value={account.id} />
                  <FormSubmitButton pendingLabel="Marcando..." variant="ghost" size="sm">
                    Muerta
                  </FormSubmitButton>
                </form>
              </>
            ) : null}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <form action={deleteServiceAccount}>
            <input type="hidden" name="id" value={account.id} />
            <input type="hidden" name="return_path" value={returnPath} />
            <FormSubmitButton pendingLabel="Eliminando..." variant="ghost" size="sm">
              Eliminar
            </FormSubmitButton>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>

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
            <CopyField label="Link plan familiar" value={spotifyPlan?.invite_url} />
            <CopyField label="Link 2FA" value={account.two_factor_url} />
            <CopyField label="Inicio" value={formatDate(account.started_at)} />
            <CopyField label="Muerte" value={account.dead_at ? formatDate(account.dead_at) : null} />
            <CopyField label="Duración" value={durationText(account.started_at, account.dead_at)} />
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
            <DialogTitle>Registrar renovación</DialogTitle>
            <DialogDescription>{account.label}</DialogDescription>
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
