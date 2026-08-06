"use client"

import { useState } from "react"
import { PlusIcon } from "lucide-react"

import { createPlatformWithProduct } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogForm,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const fieldOptions = [
  ["login_email", "Correo"],
  ["login_password", "Contraseña de plataforma"],
  ["email_password", "Contraseña del correo"],
  ["profile_label", "Perfil asignado"],
  ["invitation_email", "Correo de invitación"],
  ["two_factor_url", "Link 2FA"],
] as const

export function AccessFieldsChecklist({
  values = [],
  idPrefix = "new",
  includeTwoFactor = true,
}: {
  values?: string[]
  idPrefix?: string
  includeTwoFactor?: boolean
}) {
  return (
    <div className="grid gap-3 rounded-lg border p-3 md:grid-cols-2">
      {fieldOptions.filter(([value]) => includeTwoFactor || value !== "two_factor_url").map(([value, label]) => (
        <Field key={value} orientation="horizontal">
          <Checkbox
            defaultChecked={values.includes(value)}
            id={`access_field_${idPrefix}_${value}`}
            name="access_fields"
            value={value}
          />
          <FieldLabel htmlFor={`access_field_${idPrefix}_${value}`}>
            {label}
          </FieldLabel>
        </Field>
      ))}
    </div>
  )
}

export function NewPlatformDialog() {
  const [model, setModel] = useState<"mother" | "private">("private")

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>
        <PlusIcon data-icon="inline-start" />
        Nueva plataforma
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nueva plataforma</DialogTitle>
        <DialogDescription>Define cómo se asignarán las cuentas y crea su primer plan vendible.</DialogDescription>
        </DialogHeader>
        <DialogForm action={createPlatformWithProduct}>
          <FieldGroup>
            <input name="account_model" type="hidden" value={model} />
            <Field>
              <FieldLabel>¿Cómo se vende esta plataforma?</FieldLabel>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  className={`rounded-xl border p-4 text-left transition-colors ${model === "private" ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                  onClick={() => setModel("private")}
                  type="button"
                >
                  <span className="block font-medium">Cuentas privadas</span>
                  <span className="mt-1 block text-sm text-muted-foreground">Una cuenta disponible por cada cliente.</span>
                </button>
                <button
                  className={`rounded-xl border p-4 text-left transition-colors ${model === "mother" ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                  onClick={() => setModel("mother")}
                  type="button"
                >
                  <span className="block font-medium">Cuenta madre con cupos</span>
                  <span className="mt-1 block text-sm text-muted-foreground">Varios clientes comparten una misma cuenta.</span>
                </button>
              </div>
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="platform_name">Plataforma</FieldLabel>
                <Input id="platform_name" name="platform_name" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="platform_slug">Código opcional</FieldLabel>
                <Input id="platform_slug" name="platform_slug" placeholder="youtube-premium" />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="platform_description">Descripción</FieldLabel>
              <Input id="platform_description" name="description" />
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="first_product_name">Primer plan vendible</FieldLabel>
                <Input id="first_product_name" name="product_name" placeholder="Gemini Pro familiar" required />
                <FieldDescription>Es el nombre que verá el cliente al comprar.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="first_product_slug">Código opcional</FieldLabel>
                <Input id="first_product_slug" name="product_slug" placeholder="youtube_private" />
              </Field>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field>
                <FieldLabel>Tipo</FieldLabel>
                <Select name="product_type" defaultValue="profile">
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="profile">Perfil</SelectItem>
                      <SelectItem value="seat">Acceso</SelectItem>
                      <SelectItem value="account">Cuenta</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="platform_months">Meses</FieldLabel>
                <Input id="platform_months" name="default_duration_months" type="number" min="1" defaultValue="1" />
              </Field>
            </div>
            {model === "mother" ? (
              <Field className="rounded-lg border border-dashed p-3">
                <FieldLabel htmlFor="platform_seat_capacity">Cupos por cuenta madre</FieldLabel>
                <Input id="platform_seat_capacity" min="1" name="default_seat_capacity" required type="number" defaultValue="5" />
                <FieldDescription>El costo de compra se registra después en Cuentas madre, al crear cada cuenta.</FieldDescription>
              </Field>
            ) : null}
            <div className="grid gap-3 md:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="platform_sale_price">Precio de venta del plan</FieldLabel>
                <Input id="platform_sale_price" name="default_price_amount" type="number" step="0.01" />
              </Field>
              <Field>
                <FieldLabel>Moneda</FieldLabel>
                <Select name="default_price_currency" defaultValue="BOB">
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectGroup><SelectItem value="BOB">BOB</SelectItem><SelectItem value="USDT">USDT</SelectItem></SelectGroup></SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="platform_sale_rate">Cambio</FieldLabel>
                <Input id="platform_sale_rate" name="default_exchange_rate" type="number" step="0.000001" />
              </Field>
            </div>
            {model === "private" ? (
              <>
                <div className="grid gap-3 rounded-lg border p-3 md:grid-cols-3">
                  <Field>
                    <FieldLabel htmlFor="platform_purchase_price">Compra default</FieldLabel>
                    <Input id="platform_purchase_price" name="default_purchase_amount" type="number" step="0.01" />
                  </Field>
                  <Field>
                    <FieldLabel>Moneda compra</FieldLabel>
                    <Select name="default_purchase_currency" defaultValue="USDT">
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectGroup><SelectItem value="USDT">USDT</SelectItem><SelectItem value="BOB">BOB</SelectItem></SelectGroup></SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="platform_purchase_rate">Cambio compra</FieldLabel>
                    <Input id="platform_purchase_rate" name="default_purchase_exchange_rate" type="number" step="0.000001" />
                  </Field>
                </div>
                <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
                  <Checkbox name="allow_account_reuse_on_cancel" value="1" />
                  <span>
                    <span className="font-medium">Permitir mantener la cuenta disponible al dar de baja</span>
                    <span className="block text-muted-foreground">Permite reutilizar esta cuenta privada en otra venta.</span>
                  </span>
                </label>
              </>
            ) : null}
            <Field>
              <FieldLabel>Datos solicitados al vender</FieldLabel>
              <AccessFieldsChecklist
                idPrefix="platform"
                includeTwoFactor={model === "private"}
              />
            </Field>
            <Button type="submit">Guardar plataforma</Button>
          </FieldGroup>
        </DialogForm>
      </DialogContent>
    </Dialog>
  )
}
