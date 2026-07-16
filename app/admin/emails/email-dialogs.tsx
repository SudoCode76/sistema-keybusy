"use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { CheckIcon, CopyIcon, MoreHorizontalIcon, PlusIcon } from "lucide-react"

import {
  createManagedEmail,
  updateManagedEmail,
  type EmailState,
} from "@/app/actions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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

import type { EmailRow } from "./data"
import { FormSubmitButton } from "../accounts/form-submit-button"

type ProviderOption = { id: string; name: string }

function EmailForm({
  email,
  providers,
  onSaved,
}: {
  email?: EmailRow
  providers: ProviderOption[]
  onSaved: () => void
}) {
  const action = email ? updateManagedEmail : createManagedEmail
  const [state, formAction] = useActionState<EmailState, FormData>(action, {})
  const [origin, setOrigin] = useState<"self" | "provider">(email?.origin ?? "self")
  const [providerId, setProviderId] = useState(email?.providerId ?? "none")
  const [status, setStatus] = useState<"active" | "inactive">(email?.status ?? "active")

  useEffect(() => {
    if (state.message) onSaved()
  }, [onSaved, state.message])

  return (
    <form action={formAction}>
      <FieldGroup>
        {email ? <input name="id" type="hidden" value={email.id} /> : null}
        <input name="origin" type="hidden" value={origin} />
        <input name="provider_id" type="hidden" value={providerId} />
        <input name="status" type="hidden" value={status} />
        {state.error ? (
          <Alert variant="destructive">
            <AlertTitle>No se pudo guardar</AlertTitle>
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}
        <Field>
          <FieldLabel htmlFor={`email_${email?.id ?? "new"}`}>Correo</FieldLabel>
          <Input
            defaultValue={email?.email ?? ""}
            id={`email_${email?.id ?? "new"}`}
            name="email"
            required
            type="email"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`password_${email?.id ?? "new"}`}>
            Contraseña actual
          </FieldLabel>
          <Input
            defaultValue={email?.emailPassword ?? ""}
            id={`password_${email?.id ?? "new"}`}
            name="email_password"
            type="text"
          />
        </Field>
        <div className="grid gap-3 md:grid-cols-2">
          <Field>
            <FieldLabel>Origen</FieldLabel>
            <Select
              value={origin === "provider" ? "Proveedor" : "Creado por mí"}
              onValueChange={(value) => {
                setOrigin(value === "Proveedor" ? "provider" : "self")
                if (value !== "Proveedor") setProviderId("none")
              }}
            >
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="Creado por mí">Creado por mí</SelectItem>
                  <SelectItem value="Proveedor">Entregado por proveedor</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>Estado</FieldLabel>
            <Select
              value={status === "inactive" ? "Desactivado" : "Activo"}
              onValueChange={(value) => setStatus(value === "Desactivado" ? "inactive" : "active")}
            >
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="Activo">Activo</SelectItem>
                  <SelectItem value="Desactivado">Desactivado</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </div>
        {origin === "provider" ? (
          <Field>
            <FieldLabel>Proveedor</FieldLabel>
            <Select
              value={providers.find((provider) => provider.id === providerId)?.name ?? "Sin proveedor"}
              onValueChange={(value) => setProviderId(providers.find((provider) => provider.name === value)?.id ?? "none")}
            >
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="Sin proveedor">Sin proveedor</SelectItem>
                  {providers.map((provider) => (
                    <SelectItem key={provider.id} value={provider.name}>{provider.name}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        ) : null}
        <Field>
          <FieldLabel htmlFor={`notes_${email?.id ?? "new"}`}>Notas</FieldLabel>
          <Textarea
            defaultValue={email?.notes ?? ""}
            id={`notes_${email?.id ?? "new"}`}
            name="notes"
          />
        </Field>
        <FormSubmitButton>{email ? "Guardar cambios" : "Guardar correo"}</FormSubmitButton>
      </FieldGroup>
    </form>
  )
}

function CopyLine({ label, value }: { label: string; value: string | null }) {
  const [copied, setCopied] = useState(false)
  if (!value) return null

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-2">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm">{value}</p>
      </div>
      <Button
        aria-label={`Copiar ${label}`}
        onClick={async () => {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1200)
        }}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </Button>
    </div>
  )
}

export function NewEmailDialog({ providers }: { providers: ProviderOption[] }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={buttonVariants()}>
        <PlusIcon data-icon="inline-start" />
        Nuevo correo
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo correo</DialogTitle>
          <DialogDescription>Quedará disponible hasta que lo enlaces a una cuenta.</DialogDescription>
        </DialogHeader>
        <EmailForm providers={providers} onSaved={() => {
          setOpen(false)
          window.dispatchEvent(new Event("email-saved"))
          router.refresh()
        }} />
      </DialogContent>
    </Dialog>
  )
}

export function EmailActions({
  email,
  providers,
}: {
  email: EmailRow
  providers: ProviderOption[]
}) {
  const [viewOpen, setViewOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const router = useRouter()

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className={buttonVariants({ variant: "outline", size: "sm" })}>
          <MoreHorizontalIcon data-icon="inline-start" />
          Opciones
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setViewOpen(true)}>Ver correo</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setEditOpen(true)}>Editar</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{email.email}</DialogTitle>
            <DialogDescription>Datos e historial listos para copiar.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <CopyLine label="Correo" value={email.email} />
            <CopyLine label="Contraseña del correo" value={email.emailPassword} />
            <div className="grid gap-2">
              <p className="text-sm font-medium">Usos</p>
              {email.usages.length ? email.usages.map((usage) => (
                <div className="grid gap-2 rounded-lg border p-3" key={usage.id}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{usage.purpose}</p>
                    <Badge variant="secondary">{usage.endedAt ? "Finalizado" : "Activo"}</Badge>
                  </div>
                  <CopyLine label="Contraseña plataforma" value={usage.platformPassword} />
                  <p className="text-xs text-muted-foreground">
                    {formatDate(usage.startedAt)}{usage.endedAt ? ` - ${formatDate(usage.endedAt)}` : " - actual"}
                  </p>
                </div>
              )) : (
                <p className="text-sm text-muted-foreground">Todavía no fue usado.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar correo</DialogTitle>
            <DialogDescription>{email.email}</DialogDescription>
          </DialogHeader>
          <EmailForm
            email={email}
            providers={providers}
            onSaved={() => {
              setEditOpen(false)
              window.dispatchEvent(new Event("email-saved"))
              router.refresh()
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
