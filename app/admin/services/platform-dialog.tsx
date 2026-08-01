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
  const [mode, setMode] = useState<"inventory" | "individual">("inventory")

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>
        <PlusIcon data-icon="inline-start" />
        Nueva plataforma
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nueva plataforma</DialogTitle>
          <DialogDescription>Crea la plataforma y su primer ítem vendible.</DialogDescription>
        </DialogHeader>
        <DialogForm action={createPlatformWithProduct}>
          <FieldGroup>
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
                <FieldLabel htmlFor="first_product_name">Primer ítem</FieldLabel>
                <Input id="first_product_name" name="product_name" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="first_product_slug">Código opcional</FieldLabel>
                <Input id="first_product_slug" name="product_slug" placeholder="youtube_private" />
              </Field>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <Field>
                <FieldLabel>Modelo</FieldLabel>
                <Select
                  name="purchase_mode"
                  value={mode === "individual" ? "Cuenta privada" : "Cuenta madre"}
                  onValueChange={(value) => setMode(value === "Cuenta privada" ? "individual" : "inventory")}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="Cuenta madre">Cuenta madre</SelectItem>
                      <SelectItem value="Cuenta privada">Cuenta privada</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
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
            <div className="grid gap-3 md:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="platform_sale_price">Precio de venta</FieldLabel>
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
            {mode === "individual" ? (
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
                includeTwoFactor={mode === "individual"}
              />
            </Field>
            <Button type="submit">Guardar plataforma</Button>
          </FieldGroup>
        </DialogForm>
      </DialogContent>
    </Dialog>
  )
}
