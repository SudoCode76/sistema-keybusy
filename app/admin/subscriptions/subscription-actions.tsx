"use client"

import { useActionState, useMemo, useState } from "react"
import { CheckIcon, CopyIcon, MoreHorizontalIcon } from "lucide-react"

import {
  cancelSubscription,
  deleteSubscription,
  reactivateSubscription,
  registerMissingPurchaseCost,
  replaceSubscriptionAccount,
  renewSubscription,
  updateSubscription,
} from "@/app/actions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button, buttonVariants } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import { formatDate } from "@/lib/date"
import { money } from "@/lib/money"
import { telegramUrl, whatsappUrl } from "@/lib/phone"

import { FormSubmitButton } from "../accounts/form-submit-button"
import type { AccountOption, ProductOption, ProviderOption } from "./sale-form"
import {
  SPOTIFY_MEMBER,
  SPOTIFY_OWNER,
  spotifyPlanUnavailable,
  type SpotifySeatType,
} from "./spotify-seats"

type SubscriptionRow = {
  id: string
  customerName: string
  customerPhoneE164: string | null
  customerTelegram: string | null
  productId: string
  serviceSlug: string
  serviceAccountId: string | null
  slotLabel: string | null
  startsOn: string
  durationMonths: number
  currentPriceAmount: number
  currentPriceCurrency: "BOB" | "USDT"
  currentExchangeRate: number | null
  hasPurchaseCost: boolean
  notes: string | null
  productName: string
  status: string
  endsOn: string
  account: {
    login_email: string | null
    username: string | null
    two_factor_url: string | null
    account_credentials?: { secret_payload: string | null } | null
    spotify_family_plans?: {
      invite_url: string | null
      address: string | null
    } | null
  } | null
  detail: {
    login_email: string | null
    login_password: string | null
    email_password: string | null
    invitation_email: string | null
    profile_label: string | null
    notes: string | null
    visible_to_customer: boolean
    visible_fields: string[]
  } | null
}

const visibleFields = [
  ["login_email", "Correo"],
  ["login_password", "Contrasena"],
  ["email_password", "Contrasena correo"],
  ["invitation_email", "Correo invitado"],
  ["profile_label", "Perfil"],
  ["notes", "Notas"],
] as const

function parseSecretPayload(payload: string | null | undefined) {
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

function CopyLine({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}) {
  const [copied, setCopied] = useState(false)

  if (!value) {
    return null
  }

  async function copy() {
    await navigator.clipboard.writeText(value ?? "")
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-2">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm">{value}</p>
      </div>
      <Button type="button" variant="ghost" size="icon-sm" onClick={copy}>
        {copied ? <CheckIcon /> : <CopyIcon />}
        <span className="sr-only">Copiar</span>
      </Button>
    </div>
  )
}

export function SubscriptionActions({
  subscription,
  products,
  accounts,
  providers,
}: {
  subscription: SubscriptionRow
  products: ProductOption[]
  accounts: AccountOption[]
  providers: ProviderOption[]
}) {
  const [viewOpen, setViewOpen] = useState(false)
  const [open, setOpen] = useState(false)
  const [renewOpen, setRenewOpen] = useState(false)
  const [replaceOpen, setReplaceOpen] = useState(false)
  const [costOpen, setCostOpen] = useState(false)
  const [editState, action] = useActionState(
    async (previousState: object, formData: FormData) => {
      const result = await updateSubscription(previousState, formData)
      if (result.message) {
        setOpen(false)
      }
      return result
    },
    {}
  )
  const [, replaceAction] = useActionState(
    async (previousState: object, formData: FormData) => {
      const result = await replaceSubscriptionAccount(previousState, formData)
      if (result.message) {
        setReplaceOpen(false)
      }
      return result
    },
    {}
  )
  const [costState, costAction] = useActionState(
    async (previousState: object, formData: FormData) => {
      const result = await registerMissingPurchaseCost(previousState, formData)
      if (result.message) setCostOpen(false)
      return result
    },
    {}
  )
  const [productId, setProductId] = useState(subscription.productId)
  const subscriptionProduct = products.find(
    (product) => product.id === subscription.productId
  )
  const selectedProduct = products.find((product) => product.id === productId)
  const isSpotify = selectedProduct?.slug === "spotify_family_member"
  const canRegisterPurchaseCost =
    !subscription.hasPurchaseCost &&
    Boolean(subscription.serviceAccountId) &&
    subscriptionProduct?.purchaseMode === "individual" &&
    subscriptionProduct.defaultPurchaseAmount > 0
  const [slotLabel, setSlotLabel] = useState<SpotifySeatType>(
    subscription.slotLabel === SPOTIFY_OWNER
      ? SPOTIFY_OWNER
      : SPOTIFY_MEMBER
  )
  const accountOptions = useMemo(
    () =>
      selectedProduct?.purchaseMode === "individual"
        ? []
        : accounts.filter(
            (account) =>
              account.serviceSlug === selectedProduct?.serviceSlug &&
              (!isSpotify || account.seatsTotal !== null)
          ),
    [accounts, isSpotify, selectedProduct]
  )
  const [accountId, setAccountId] = useState(
    subscription.serviceAccountId ?? "none"
  )
  const [currency, setCurrency] = useState(subscription.currentPriceCurrency)
  const [replaceCurrency, setReplaceCurrency] = useState<"BOB" | "USDT">("USDT")
  const [replaceProviderId, setReplaceProviderId] = useState("none")
  const [replaceEmail, setReplaceEmail] = useState("")
  const [replaceEmailPassword, setReplaceEmailPassword] = useState("")
  const accountSecrets = parseSecretPayload(
    subscription.account?.account_credentials?.secret_payload
  )
  const platformPassword =
    accountSecrets.platform_password ?? accountSecrets.password
  const extraPasswords = Object.entries(accountSecrets).filter(
    ([key]) =>
      key.toLowerCase().includes("password") &&
      !["password", "platform_password", "email_password"].includes(key)
  )
  const renewalMessage = `Hola ${subscription.customerName}, ¿desea renovar ${subscription.productName} que vence el ${formatDate(subscription.endsOn)}?`
  const whatsapp = whatsappUrl(subscription.customerPhoneE164, renewalMessage)
  const telegram = telegramUrl(subscription.customerTelegram, renewalMessage)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <MoreHorizontalIcon data-icon="inline-start" />
          Opciones
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setViewOpen(true)}>
              Ver cuenta
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setOpen(true)}>
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setRenewOpen(true)}>
              Renovar
            </DropdownMenuItem>
            {whatsapp ? (
              <DropdownMenuItem
                render={
                  <a href={whatsapp} rel="noreferrer" target="_blank" />
                }
              >
                WhatsApp
              </DropdownMenuItem>
            ) : null}
            {telegram ? (
              <DropdownMenuItem
                render={
                  <a href={telegram} rel="noreferrer" target="_blank" />
                }
              >
                Telegram
              </DropdownMenuItem>
            ) : null}
            {subscription.serviceAccountId &&
            selectedProduct?.purchaseMode === "individual" ? (
              <DropdownMenuItem onClick={() => setReplaceOpen(true)}>
                Cambiar cuenta
              </DropdownMenuItem>
            ) : null}
            {canRegisterPurchaseCost ? (
              <DropdownMenuItem onClick={() => setCostOpen(true)}>
                Registrar costo de compra
              </DropdownMenuItem>
            ) : null}
            {subscription.status === "canceled" ? (
              <form action={reactivateSubscription}>
                <input name="id" type="hidden" value={subscription.id} />
                <FormSubmitButton
                  pendingLabel="Reactivando..."
                  size="sm"
                  variant="ghost"
                >
                  Reactivar
                </FormSubmitButton>
              </form>
            ) : (
              <form action={cancelSubscription}>
                <input name="id" type="hidden" value={subscription.id} />
                <FormSubmitButton
                  pendingLabel="Dando de baja..."
                  size="sm"
                  variant="ghost"
                >
                  Dar de baja
                </FormSubmitButton>
              </form>
            )}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <form action={deleteSubscription}>
            <input name="id" type="hidden" value={subscription.id} />
            <FormSubmitButton
              pendingLabel="Eliminando..."
              size="sm"
              variant="ghost"
            >
              Eliminar
            </FormSubmitButton>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={costOpen} onOpenChange={setCostOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar costo de compra</DialogTitle>
            <DialogDescription>
              Se registrará{" "}
              {money(
                subscriptionProduct?.defaultPurchaseAmount,
                subscriptionProduct?.defaultPurchaseCurrency ?? "USDT"
              )}{" "}
              con la cotización Binance BUY actual y la fecha original de la
              venta.
            </DialogDescription>
          </DialogHeader>
          <form action={costAction}>
            <FieldGroup>
              <input
                name="subscription_id"
                type="hidden"
                value={subscription.id}
              />
              {costState.error ? (
                <Alert variant="destructive">
                  <AlertTitle>No se pudo registrar</AlertTitle>
                  <AlertDescription>{costState.error}</AlertDescription>
                </Alert>
              ) : null}
              <FormSubmitButton pendingLabel="Registrando...">
                Confirmar costo
              </FormSubmitButton>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Cuenta del usuario</DialogTitle>
            <DialogDescription>{subscription.productName}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <CopyLine
              label="Correo venta"
              value={subscription.detail?.login_email}
            />
            <CopyLine
              label="Correo inventario"
              value={
                subscription.account?.login_email ??
                subscription.account?.username
              }
            />
            <CopyLine
              label="Contrasena venta"
              value={subscription.detail?.login_password}
            />
            <CopyLine label="Contrasena inventario" value={platformPassword} />
            <CopyLine
              label="Contrasena correo venta"
              value={subscription.detail?.email_password}
            />
            <CopyLine
              label="Contrasena correo inventario"
              value={accountSecrets.email_password}
            />
            {extraPasswords.map(([key, value]) => (
              <CopyLine key={key} label={key} value={value} />
            ))}
            <CopyLine
              label="Correo invitado"
              value={subscription.detail?.invitation_email}
            />
            <CopyLine
              label="Perfil"
              value={subscription.detail?.profile_label}
            />
            <CopyLine
              label="Link plan familiar"
              value={subscription.account?.spotify_family_plans?.invite_url}
            />
            <CopyLine
              label="Direccion plan familiar"
              value={subscription.account?.spotify_family_plans?.address}
            />
            <CopyLine
              label="Link 2FA"
              value={subscription.account?.two_factor_url}
            />
            <CopyLine label="Notas" value={subscription.detail?.notes} />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar venta</DialogTitle>
            <DialogDescription>{subscription.productName}</DialogDescription>
          </DialogHeader>
          <form action={action}>
            <FieldGroup>
              {editState.error ? (
                <Alert variant="destructive">
                  <AlertTitle>No se pudo actualizar</AlertTitle>
                  <AlertDescription>{editState.error}</AlertDescription>
                </Alert>
              ) : null}
              <input name="id" type="hidden" value={subscription.id} />
              <input name="product_id" type="hidden" value={productId} />
              <input
                name="service_account_id"
                type="hidden"
                value={accountId}
              />

              <Field>
                <FieldLabel>Ítem vendible</FieldLabel>
                <Select
                  value={productId}
                  onValueChange={(value) => {
                    if (value) {
                      setProductId(value)
                      setAccountId("none")
                      if (
                        products.find((product) => product.id === value)?.slug ===
                        "spotify_family_member"
                      ) {
                        setSlotLabel(SPOTIFY_MEMBER)
                      }
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} · {product.serviceName}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              {isSpotify ? (
                <Field>
                  <FieldLabel>Tipo de cupo Spotify</FieldLabel>
                  <input name="profile_label" type="hidden" value={slotLabel} />
                  <Select
                    value={slotLabel}
                    onValueChange={(value) => {
                      const next =
                        value === SPOTIFY_OWNER
                          ? SPOTIFY_OWNER
                          : SPOTIFY_MEMBER
                      setSlotLabel(next)

                      const account = accountOptions.find(
                        (item) => item.id === accountId
                      )
                      if (
                        account &&
                        spotifyPlanUnavailable(account, next, {
                          accountId: subscription.serviceAccountId,
                          seatType: subscription.slotLabel,
                        })
                      ) {
                        setAccountId("none")
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value={SPOTIFY_MEMBER}>
                          {SPOTIFY_MEMBER}
                        </SelectItem>
                        <SelectItem value={SPOTIFY_OWNER}>
                          {SPOTIFY_OWNER}
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              ) : null}

              {accountOptions.length > 0 ? (
                <Field>
                  <FieldLabel>
                    {isSpotify ? "Plan familiar Spotify" : "Inventario"}
                  </FieldLabel>
                  <Select
                    value={accountId}
                    onValueChange={(value) => {
                      if (value) setAccountId(value)
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccionar inventario" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {!isSpotify ? (
                          <SelectItem value="none">Sin inventario</SelectItem>
                        ) : null}
                        {accountOptions.map((account) => {
                          const unavailable =
                            isSpotify &&
                            spotifyPlanUnavailable(account, slotLabel, {
                              accountId: subscription.serviceAccountId,
                              seatType: subscription.slotLabel,
                            })

                          return (
                            <SelectItem
                              disabled={unavailable}
                              key={account.id}
                              value={account.id}
                            >
                              {account.label}
                              {isSpotify && account.seatsTotal !== null
                                ? ` · ${account.seatsUsed}/${account.seatsTotal} cupos`
                                : ""}
                              {isSpotify && account.ownerAssigned
                                ? " · titular asignado"
                                : ""}
                            </SelectItem>
                          )
                        })}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              ) : null}

              <div className="grid gap-3 md:grid-cols-4">
                <Field>
                  <FieldLabel htmlFor={`starts_on_${subscription.id}`}>
                    Inicio
                  </FieldLabel>
                  <Input
                    defaultValue={subscription.startsOn}
                    id={`starts_on_${subscription.id}`}
                    name="starts_on"
                    type="date"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`duration_${subscription.id}`}>
                    Meses
                  </FieldLabel>
                  <Input
                    defaultValue={subscription.durationMonths}
                    id={`duration_${subscription.id}`}
                    min="1"
                    name="duration_months"
                    type="number"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`price_${subscription.id}`}>
                    Precio mensual
                  </FieldLabel>
                  <Input
                    defaultValue={subscription.currentPriceAmount}
                    id={`price_${subscription.id}`}
                    name="current_price_amount"
                    step="0.01"
                    type="number"
                  />
                </Field>
                <Field>
                  <FieldLabel>Moneda</FieldLabel>
                  <Select
                    value={currency}
                    onValueChange={(value) =>
                      setCurrency(value as "BOB" | "USDT")
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="BOB">BOB</SelectItem>
                        <SelectItem value="USDT">USDT</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <input
                    name="current_price_currency"
                    type="hidden"
                    value={currency}
                  />
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor={`rate_${subscription.id}`}>
                  Tipo de cambio
                </FieldLabel>
                <Input
                  defaultValue={subscription.currentExchangeRate ?? ""}
                  id={`rate_${subscription.id}`}
                  name="current_exchange_rate"
                  step="0.000001"
                  type="number"
                />
              </Field>

              <div className="grid gap-3 md:grid-cols-2">
                {isSpotify && slotLabel === SPOTIFY_OWNER ? (
                  <Alert className="md:col-span-2">
                    <AlertTitle>Credenciales de la cuenta madre</AlertTitle>
                    <AlertDescription>
                      Se volverán a copiar desde el inventario al actualizar.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    <Field>
                      <FieldLabel htmlFor={`login_email_${subscription.id}`}>
                        Correo
                      </FieldLabel>
                      <Input
                        defaultValue={subscription.detail?.login_email ?? ""}
                        id={`login_email_${subscription.id}`}
                        name="login_email"
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor={`login_password_${subscription.id}`}>
                        Contrasena
                      </FieldLabel>
                      <Input
                        defaultValue={subscription.detail?.login_password ?? ""}
                        id={`login_password_${subscription.id}`}
                        name="login_password"
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor={`email_password_${subscription.id}`}>
                        Contrasena correo
                      </FieldLabel>
                      <Input
                        defaultValue={subscription.detail?.email_password ?? ""}
                        id={`email_password_${subscription.id}`}
                        name="email_password"
                      />
                    </Field>
                  </>
                )}
                <Field>
                  <FieldLabel htmlFor={`invitation_email_${subscription.id}`}>
                    Correo invitado
                  </FieldLabel>
                  <Input
                    defaultValue={subscription.detail?.invitation_email ?? ""}
                    id={`invitation_email_${subscription.id}`}
                    name="invitation_email"
                  />
                </Field>
                {!isSpotify ? (
                  <Field>
                    <FieldLabel htmlFor={`profile_${subscription.id}`}>
                      Perfil
                    </FieldLabel>
                    <Input
                      defaultValue={subscription.detail?.profile_label ?? ""}
                      id={`profile_${subscription.id}`}
                      name="profile_label"
                    />
                  </Field>
                ) : null}
              </div>

              <Field>
                <FieldLabel htmlFor={`notes_${subscription.id}`}>
                  Notas venta
                </FieldLabel>
                <Textarea
                  defaultValue={subscription.notes ?? ""}
                  id={`notes_${subscription.id}`}
                  name="notes"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`access_notes_${subscription.id}`}>
                  Notas acceso
                </FieldLabel>
                <Textarea
                  defaultValue={subscription.detail?.notes ?? ""}
                  id={`access_notes_${subscription.id}`}
                  name="access_notes"
                />
              </Field>

              <div className="grid gap-3 rounded-lg border p-3">
                <Field orientation="horizontal">
                  <Checkbox
                    defaultChecked={
                      subscription.detail?.visible_to_customer ?? false
                    }
                    id={`visible_to_customer_${subscription.id}`}
                    name="visible_to_customer"
                  />
                  <FieldLabel
                    htmlFor={`visible_to_customer_${subscription.id}`}
                  >
                    Mostrar en portal
                  </FieldLabel>
                </Field>
                <div className="grid gap-2 sm:grid-cols-2">
                  {visibleFields.map(([field, label]) => (
                    <Field key={field} orientation="horizontal">
                      <Checkbox
                        defaultChecked={subscription.detail?.visible_fields?.includes(
                          field
                        )}
                        id={`${field}_${subscription.id}`}
                        name="visible_fields"
                        value={field}
                      />
                      <FieldLabel htmlFor={`${field}_${subscription.id}`}>
                        {label}
                      </FieldLabel>
                    </Field>
                  ))}
                </div>
              </div>

              <FormSubmitButton pendingLabel="Guardando...">
                Guardar cambios
              </FormSubmitButton>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={replaceOpen} onOpenChange={setReplaceOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Cambiar cuenta</DialogTitle>
            <DialogDescription>
              Marca la cuenta actual como muerta y enlaza una cuenta nueva.
            </DialogDescription>
          </DialogHeader>
          <form action={replaceAction}>
            <FieldGroup>
              <input
                name="subscription_id"
                type="hidden"
                value={subscription.id}
              />
              <input
                name="old_account_id"
                type="hidden"
                value={subscription.serviceAccountId ?? ""}
              />
              <input
                name="provider_id"
                type="hidden"
                value={replaceProviderId}
              />
              <input name="currency" type="hidden" value={replaceCurrency} />

              <ManagedEmailPicker
                email={replaceEmail}
                emailPassword={replaceEmailPassword}
                onEmailChange={setReplaceEmail}
                onEmailPasswordChange={setReplaceEmailPassword}
                platformPassword={{
                  label: "Contraseña",
                  name: "login_password",
                  required: true,
                }}
                providerId={replaceProviderId}
              />

              <Field>
                <FieldLabel>Proveedor</FieldLabel>
                <Select
                  value={replaceProviderId}
                  onValueChange={(value) =>
                    setReplaceProviderId(value ?? "none")
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sin proveedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="none">Sin proveedor</SelectItem>
                      {providers.map((provider) => (
                        <SelectItem key={provider.id} value={provider.id}>
                          {provider.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel htmlFor={`replace_label_${subscription.id}`}>
                  Etiqueta
                </FieldLabel>
                <Input
                  id={`replace_label_${subscription.id}`}
                  name="label"
                  placeholder="Opcional"
                />
              </Field>

              <div className="grid gap-3 md:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor={`replace_amount_${subscription.id}`}>
                    Precio de compra
                  </FieldLabel>
                  <Input
                    id={`replace_amount_${subscription.id}`}
                    name="amount"
                    step="0.01"
                    type="number"
                  />
                </Field>
                <Field>
                  <FieldLabel>Moneda</FieldLabel>
                  <Select
                    value={replaceCurrency}
                    onValueChange={(value) =>
                      setReplaceCurrency(value as "BOB" | "USDT")
                    }
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
                <Field>
                  <FieldLabel htmlFor={`replace_rate_${subscription.id}`}>
                    Cambio
                  </FieldLabel>
                  <Input
                    id={`replace_rate_${subscription.id}`}
                    name="exchange_rate"
                    step="0.000001"
                    type="number"
                  />
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor={`replace_2fa_${subscription.id}`}>
                  Link 2FA
                </FieldLabel>
                <Input
                  id={`replace_2fa_${subscription.id}`}
                  name="two_factor_url"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`replace_notes_${subscription.id}`}>
                  Notas
                </FieldLabel>
                <Textarea
                  id={`replace_notes_${subscription.id}`}
                  name="notes"
                />
              </Field>

              <FormSubmitButton pendingLabel="Cambiando...">
                Guardar cambio
              </FormSubmitButton>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={renewOpen} onOpenChange={setRenewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar renovación</DialogTitle>
            <DialogDescription>
              Renueva desde {formatDate(subscription.endsOn)}
            </DialogDescription>
          </DialogHeader>
          <DialogForm action={renewSubscription}>
            <FieldGroup>
              <input name="id" type="hidden" value={subscription.id} />
              <div className="grid gap-3 md:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor={`renew_months_${subscription.id}`}>
                    Meses
                  </FieldLabel>
                  <Input
                    defaultValue={subscription.durationMonths}
                    id={`renew_months_${subscription.id}`}
                    min="1"
                    name="duration_months"
                    type="number"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`renew_amount_${subscription.id}`}>
                    Precio mensual
                  </FieldLabel>
                  <Input
                    defaultValue={subscription.currentPriceAmount}
                    id={`renew_amount_${subscription.id}`}
                    name="amount"
                    step="0.01"
                    type="number"
                  />
                </Field>
                <Field>
                  <FieldLabel>Moneda</FieldLabel>
                  <Select
                    name="currency"
                    defaultValue={subscription.currentPriceCurrency}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="BOB">BOB</SelectItem>
                        <SelectItem value="USDT">USDT</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor={`renew_rate_${subscription.id}`}>
                  Tipo de cambio
                </FieldLabel>
                <Input
                  defaultValue={subscription.currentExchangeRate ?? ""}
                  id={`renew_rate_${subscription.id}`}
                  name="exchange_rate"
                  step="0.000001"
                  type="number"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`renew_notes_${subscription.id}`}>
                  Notas
                </FieldLabel>
                <Textarea id={`renew_notes_${subscription.id}`} name="notes" />
              </Field>
              <FormSubmitButton pendingLabel="Renovando...">
                Guardar renovación
              </FormSubmitButton>
            </FieldGroup>
          </DialogForm>
        </DialogContent>
      </Dialog>
    </>
  )
}
