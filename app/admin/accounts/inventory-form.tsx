"use client"

import { useMemo, useState } from "react"
import { useFormStatus } from "react-dom"
import { LoaderCircleIcon } from "lucide-react"

import {
  createServiceAccount,
  getBinancePurchaseRate,
  updateServiceAccount,
} from "@/app/actions"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DialogForm } from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ManagedEmailPicker } from "@/components/managed-email-picker"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  isMotherService,
  nextRenewalSuggestion,
} from "@/app/admin/subscriptions/mother-access"

type ServiceOption = {
  id: string
  name: string
  slug: string
}

type ProviderOption = {
  id: string
  name: string
  serviceIds: string[]
}

type InventoryFormProps = {
  services: ServiceOption[]
  providers: ProviderOption[]
  account?: InventoryAccount
}

type SpotifyPlanDefaults = {
  invite_url: string | null
  address: string | null
  seats_total: number | null
}

type InventoryAccount = {
  id: string
  service_id: string | null
  provider_id: string | null
  email_address_id: string | null
  label: string | null
  login_email: string | null
  base_cost_amount: number | null
  base_cost_currency: string | null
  base_cost_exchange_rate: number | null
  renewal_due_on: string | null
  two_factor_url: string | null
  notes: string | null
  email_addresses?:
    | {
        email: string
        email_password: string | null
        origin: string
        provider_id: string | null
      }
    | Array<{
        email: string
        email_password: string | null
        origin: string
        provider_id: string | null
      }>
    | null
  spotify_family_plans?: SpotifyPlanDefaults | SpotifyPlanDefaults[] | null
}

function serviceLabel(service: ServiceOption) {
  return `${service.name} · ${service.slug}`
}

function one<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()

  return (
    <Button disabled={pending} type="submit">
      {pending ? (
        <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />
      ) : null}
      {pending ? "Guardando..." : label}
    </Button>
  )
}

export function InventoryForm({
  services,
  providers,
  account,
}: InventoryFormProps) {
  const firstService =
    services.find((service) => service.id === account?.service_id) ??
    services[0]
  const initialProvider = providers.find(
    (provider) => provider.id === account?.provider_id
  )
  const spotifyPlan = one(account?.spotify_family_plans)
  const managedAddress = one(account?.email_addresses)
  const [serviceId, setServiceId] = useState(firstService?.id ?? "")
  const [selectedServiceLabel, setSelectedServiceLabel] = useState(
    firstService ? serviceLabel(firstService) : ""
  )
  const [providerId, setProviderId] = useState(initialProvider?.id ?? "none")
  const [selectedProviderLabel, setSelectedProviderLabel] = useState(
    initialProvider?.name ?? "Sin proveedor"
  )
  const [costCurrency, setCostCurrency] = useState(
    account?.base_cost_currency ?? "USDT"
  )
  const [exchangeRate, setExchangeRate] = useState(
    account?.base_cost_exchange_rate
      ? String(account.base_cost_exchange_rate)
      : ""
  )
  const [isFetchingRate, setIsFetchingRate] = useState(false)
  const [rateError, setRateError] = useState("")
  const [loginEmail, setLoginEmail] = useState(
    managedAddress?.email ?? account?.login_email ?? ""
  )
  const [emailPassword, setEmailPassword] = useState(
    managedAddress?.email_password ?? ""
  )
  const selectedService = useMemo(
    () => services.find((service) => service.id === serviceId),
    [services, serviceId]
  )
  const isSpotify = selectedService?.slug === "spotify"
  const isMother = isMotherService(selectedService?.slug)
  const matchingProviders = useMemo(
    () =>
      providers.filter(
        (provider) =>
          provider.serviceIds.length === 0 ||
          provider.serviceIds.includes(serviceId)
      ),
    [providers, serviceId]
  )

  async function calculateExchangeRate() {
    setIsFetchingRate(true)
    setRateError("")

    try {
      const rate = await getBinancePurchaseRate()
      setExchangeRate(String(rate))
    } catch (error) {
      setRateError(
        error instanceof Error ? error.message : "No se pudo calcular el cambio"
      )
    } finally {
      setIsFetchingRate(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {account ? "Editar inventario" : "Nuevo ítem comprado"}
        </CardTitle>
        <CardDescription>
          {account
            ? account.label
            : "Cuenta completa, plan familiar o perfil comprado."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DialogForm action={account ? updateServiceAccount : createServiceAccount}>
          <FieldGroup>
            {account ? (
              <input name="id" type="hidden" value={account.id} />
            ) : null}
            <Field>
              <FieldLabel>Plataforma</FieldLabel>
              <input name="service_id" type="hidden" value={serviceId} />
              <Select
                onValueChange={(nextValue) => {
                  const service = services.find(
                    (item) => serviceLabel(item) === nextValue
                  )

                  if (service) {
                    setServiceId(service.id)
                    setSelectedServiceLabel(serviceLabel(service))
                    setProviderId("none")
                    setSelectedProviderLabel("Sin proveedor")
                  }
                }}
                required
                value={selectedServiceLabel}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar plataforma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {services.map((service) => (
                      <SelectItem
                        key={service.id}
                        value={serviceLabel(service)}
                      >
                        {serviceLabel(service)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Proveedor</FieldLabel>
              <input name="provider_id" type="hidden" value={providerId} />
              <Select
                key={serviceId}
                onValueChange={(nextValue) => {
                  const provider = matchingProviders.find(
                    (item) => item.name === nextValue
                  )

                  setProviderId(provider?.id ?? "none")
                  setSelectedProviderLabel(provider?.name ?? "Sin proveedor")
                }}
                value={selectedProviderLabel}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sin proveedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="Sin proveedor">Sin proveedor</SelectItem>
                    {matchingProviders.map((provider) => (
                      <SelectItem key={provider.id} value={provider.name}>
                        {provider.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="label">Etiqueta</FieldLabel>
              <Input
                defaultValue={account?.label ?? ""}
                id="label"
                name="label"
                placeholder="Netflix cuenta completa #1"
                required
              />
            </Field>
            <ManagedEmailPicker
              email={loginEmail}
              emailPassword={emailPassword}
              initialEmailId={account?.email_address_id}
              onEmailChange={setLoginEmail}
              onEmailPasswordChange={setEmailPassword}
              platformPassword={{
                label: "Contraseña plataforma",
                name: "platform_password",
                placeholder: account ? "Dejar vacío para no cambiar" : "",
              }}
              providerId={providerId}
            />
            <div className="grid gap-3 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="base_cost_amount">
                  Precio de compra
                </FieldLabel>
                <Input
                  defaultValue={account?.base_cost_amount ?? ""}
                  id="base_cost_amount"
                  name="base_cost_amount"
                  type="number"
                  step="0.01"
                />
              </Field>
              <Field>
                <FieldLabel>Moneda</FieldLabel>
                <Select
                  name="base_cost_currency"
                  onValueChange={(nextValue) => {
                    if (nextValue) {
                      setCostCurrency(nextValue)
                    }
                  }}
                  value={costCurrency}
                >
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
              <Field className="md:col-span-2">
                <FieldLabel htmlFor="base_cost_exchange_rate">
                  Cambio
                </FieldLabel>
                <div className="flex gap-2">
                  <Input
                    className="min-w-0"
                    id="base_cost_exchange_rate"
                    name="base_cost_exchange_rate"
                    onChange={(event) => setExchangeRate(event.target.value)}
                    type="number"
                    step="0.000001"
                    value={exchangeRate}
                  />
                  <Button
                    className="shrink-0"
                    disabled={isFetchingRate}
                    onClick={calculateExchangeRate}
                    type="button"
                    variant="outline"
                  >
                    {isFetchingRate ? "..." : "Binance"}
                  </Button>
                </div>
                {rateError ? (
                  <p className="text-sm text-destructive">{rateError}</p>
                ) : null}
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="two_factor_url">Link 2FA</FieldLabel>
              <Input
                defaultValue={account?.two_factor_url ?? ""}
                id="two_factor_url"
                name="two_factor_url"
              />
            </Field>
            {isMother ? (
              <Field>
                <FieldLabel htmlFor="renewal_due_on">Próximo pago</FieldLabel>
                <Input
                  defaultValue={
                    account?.renewal_due_on ?? nextRenewalSuggestion(null)
                  }
                  id="renewal_due_on"
                  name="renewal_due_on"
                  required
                  type="date"
                />
              </Field>
            ) : null}
            {isSpotify ? (
              <div className="grid gap-3 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="invite_url">
                    Invitación Spotify
                  </FieldLabel>
                  <Input
                    defaultValue={spotifyPlan?.invite_url ?? ""}
                    id="invite_url"
                    name="invite_url"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="address">Dirección Spotify</FieldLabel>
                  <Input
                    defaultValue={spotifyPlan?.address ?? ""}
                    id="address"
                    name="address"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="seats_total">Cupos</FieldLabel>
                  <Input
                    defaultValue={spotifyPlan?.seats_total ?? 6}
                    id="seats_total"
                    name="seats_total"
                    type="number"
                  />
                </Field>
              </div>
            ) : null}
            <Field>
              <FieldLabel htmlFor="notes">Notas</FieldLabel>
              <Textarea
                defaultValue={account?.notes ?? ""}
                id="notes"
                name="notes"
              />
            </Field>
            <SubmitButton
              label={account ? "Guardar cambios" : "Guardar inventario"}
            />
          </FieldGroup>
        </DialogForm>
      </CardContent>
    </Card>
  )
}
