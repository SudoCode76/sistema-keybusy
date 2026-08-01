"use client"

import { useActionState, useState } from "react"
import {
  BellIcon,
  CheckIcon,
  CopyIcon,
  MoreHorizontalIcon,
  RotateCcwIcon,
  XIcon,
} from "lucide-react"

import {
  cancelSubscription,
  deleteSubscription,
  markChatgptAccountBlocked,
  reactivateSubscription,
  registerMissingPurchaseCost,
  replaceSubscriptionAccount,
  resolveMotherAccessIssue,
  renewSubscription,
  setRenewalMessageSent,
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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
import { canOfferAccountReuse } from "../accounts/account-availability"
import {
  EditSaleForm,
  type AccountOption,
  type CountryOption,
  type ProductOption,
  type ProviderOption,
} from "./sale-form"

type SubscriptionRow = {
  id: string
  customerId: string
  customerCountryId: string
  customerName: string
  customerPhone: string | null
  customerPhoneE164: string | null
  customerTelegram: string | null
  productId: string
  serviceSlug: string
  serviceAccountId: string | null
  motherAccessIssueOn: string | null
  slotLabel: string | null
  startsOn: string
  durationMonths: number
  currentPriceAmount: number
  currentPriceCurrency: "BOB" | "USDT"
  currentExchangeRate: number | null
  renewalMessageSentAt: string | null
  renewalMessageDays: number | null
  hasPurchaseCost: boolean
  accountHistory: Array<{
    service_account_id: string
    assigned_at: string
    ended_at: string | null
    blocked_at: string | null
    block_reason: string | null
    purchase_cost_bob: number
    purchase_cost_usdt: number
    duration_days: number
    service_accounts: { label: string; created_at: string } | null
  }>
  accountCostBob: number
  accountCostUsdt: number
  managedEmailId: string | null
  purchaseCost: {
    providerId: string | null
    amount: number
    currency: "BOB" | "USDT"
  } | null
  accountLabel: string | null
  notes: string | null
  productName: string
  serviceName: string
  status: string
  endsOn: string
  account: {
    login_email: string | null
    username: string | null
    provider_id: string | null
    email_address_id: string | null
    base_cost_amount: number
    base_cost_currency: "BOB" | "USDT"
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
  countries,
  defaultCountryId,
}: {
  subscription: SubscriptionRow
  products: ProductOption[]
  accounts: AccountOption[]
  providers: ProviderOption[]
  countries: CountryOption[]
  defaultCountryId?: string
}) {
  const [viewOpen, setViewOpen] = useState(false)
  const [open, setOpen] = useState(false)
  const [renewOpen, setRenewOpen] = useState(false)
  const [replaceOpen, setReplaceOpen] = useState(false)
  const [costOpen, setCostOpen] = useState(false)
  const [blockOpen, setBlockOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [blockState, blockAction] = useActionState(
    async (previousState: object, formData: FormData) => {
      try {
        await markChatgptAccountBlocked(formData)
        setBlockOpen(false)
        return {}
      } catch (error) {
        return { error: error instanceof Error ? error.message : "No se pudo marcar el bloqueo" }
      }
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
  const [cancelState, cancelAction] = useActionState(
    async (previousState: object, formData: FormData) => {
      try {
        await cancelSubscription(formData)
        setCancelOpen(false)
        return {}
      } catch (error) {
        return { error: error instanceof Error ? error.message : "No se pudo dar de baja" }
      }
    },
    {}
  )
  const subscriptionProduct = products.find(
    (product) => product.id === subscription.productId
  )
  const canRegisterPurchaseCost =
    !subscription.hasPurchaseCost &&
    Boolean(subscription.serviceAccountId) &&
    subscriptionProduct?.purchaseMode === "individual" &&
    subscriptionProduct.defaultPurchaseAmount > 0
  const canKeepAccountAvailable = canOfferAccountReuse(
    subscriptionProduct?.purchaseMode,
    subscriptionProduct?.allowAccountReuseOnCancel ?? false
  )
  const [replaceCurrency, setReplaceCurrency] = useState<"BOB" | "USDT">("USDT")
  const [replaceProviderId, setReplaceProviderId] = useState("none")
  const [replaceEmail, setReplaceEmail] = useState("")
  const [replaceEmailPassword, setReplaceEmailPassword] = useState("")
  const accountSecrets = parseSecretPayload(
    subscription.account?.account_credentials?.secret_payload
  )
  const platformPassword =
    accountSecrets.platform_password ?? accountSecrets.password
  const editableProducts = products.filter(
    (product) => product.serviceSlug === subscription.serviceSlug
  )
  const editInitialValues = {
    subscriptionId: subscription.id,
    customerId: subscription.customerId,
    countryId: subscription.customerCountryId || defaultCountryId || "",
    phone: subscription.customerPhone ?? "",
    telegramUsername: subscription.customerTelegram ?? "",
    productSlug: subscriptionProduct?.slug ?? "",
    serviceAccountId: subscription.serviceAccountId,
    providerId:
      subscription.purchaseCost?.providerId ??
      subscription.account?.provider_id ??
      null,
    accountLabel: subscription.accountLabel ?? "",
    managedEmailId: subscription.managedEmailId,
    loginEmail:
      subscription.detail?.login_email ??
      subscription.account?.login_email ??
      "",
    loginPassword: subscription.detail?.login_password ?? platformPassword ?? "",
    emailPassword:
      subscription.detail?.email_password ?? accountSecrets.email_password ?? "",
    invitationEmail: subscription.detail?.invitation_email ?? "",
    profileLabel:
      subscription.detail?.profile_label ?? subscription.slotLabel ?? "",
    twoFactorUrl: subscription.account?.two_factor_url ?? "",
    startsOn: subscription.startsOn,
    durationMonths: subscription.durationMonths,
    priceAmount: subscription.currentPriceAmount,
    priceCurrency: subscription.currentPriceCurrency,
    purchaseAmount:
      subscription.purchaseCost?.amount ??
      subscription.account?.base_cost_amount ??
      0,
    purchaseCurrency:
      subscription.purchaseCost?.currency ??
      subscription.account?.base_cost_currency ??
      "USDT",
    notes: subscription.notes ?? "",
    accessNotes: subscription.detail?.notes ?? "",
  } as const
  const extraPasswords = Object.entries(accountSecrets).filter(
    ([key]) =>
      key.toLowerCase().includes("password") &&
      !["password", "platform_password", "email_password"].includes(key)
  )
  const customerEmail = subscription.detail?.login_email
  const customerPassword = subscription.detail?.login_password
  const customerEmailPassword = subscription.detail?.email_password
  const inventoryEmail =
    subscription.account?.login_email ?? subscription.account?.username
  const inventoryEmailPassword = accountSecrets.email_password
  const hasDifferentInventory = Boolean(
    (inventoryEmail && inventoryEmail !== customerEmail) ||
      (platformPassword && platformPassword !== customerPassword) ||
      (inventoryEmailPassword &&
        inventoryEmailPassword !== customerEmailPassword) ||
      extraPasswords.length ||
      subscription.account?.spotify_family_plans?.invite_url ||
      subscription.account?.spotify_family_plans?.address ||
      subscription.account?.two_factor_url
  )
  const platformPasswordLabel = `Contraseña de ${subscription.serviceName}`
  const renewalMessage =
    subscription.serviceSlug === "spotify"
      ? "Hola, ¿desea renovar su suscripcion a spotify?"
      : `Hola, ¿desea renovar ${subscription.productName}?`
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
            {subscription.motherAccessIssueOn ? (
              <form action={resolveMotherAccessIssue}>
                <input name="id" type="hidden" value={subscription.id} />
                <FormSubmitButton
                  pendingLabel="Marcando..."
                  size="sm"
                  variant="ghost"
                >
                  Marcar solucionado
                </FormSubmitButton>
              </form>
            ) : null}
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
            {!["canceled", "inactive"].includes(subscription.status) ? (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <BellIcon data-icon="inline-start" />
                  Aviso de renovación
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="min-w-56">
                  {subscription.renewalMessageSentAt ? (
                    <>
                      <p className="px-1.5 py-1 text-xs text-muted-foreground">
                        {subscription.renewalMessageDays === 0
                          ? "Último aviso: hoy"
                          : subscription.renewalMessageDays === 1
                            ? "Último aviso: hace 1 día"
                            : `Último aviso: hace ${subscription.renewalMessageDays} días`}
                      </p>
                      <form action={setRenewalMessageSent}>
                        <input name="id" type="hidden" value={subscription.id} />
                        <input name="sent" type="hidden" value="1" />
                        <FormSubmitButton
                          className="w-full justify-start"
                          pendingLabel="Registrando..."
                          size="sm"
                          variant="ghost"
                        >
                          <RotateCcwIcon data-icon="inline-start" />
                          Registrar otro aviso
                        </FormSubmitButton>
                      </form>
                      <DropdownMenuSeparator />
                      <form action={setRenewalMessageSent}>
                        <input name="id" type="hidden" value={subscription.id} />
                        <input name="sent" type="hidden" value="0" />
                        <FormSubmitButton
                          className="w-full justify-start text-muted-foreground"
                          pendingLabel="Quitando..."
                          size="sm"
                          variant="ghost"
                        >
                          <XIcon data-icon="inline-start" />
                          Quitar aviso
                        </FormSubmitButton>
                      </form>
                    </>
                  ) : (
                    <form action={setRenewalMessageSent}>
                      <input name="id" type="hidden" value={subscription.id} />
                      <input name="sent" type="hidden" value="1" />
                      <FormSubmitButton
                        className="w-full justify-start"
                        pendingLabel="Marcando..."
                        size="sm"
                        variant="ghost"
                      >
                        <BellIcon data-icon="inline-start" />
                        Marcar aviso enviado
                      </FormSubmitButton>
                    </form>
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ) : null}
            {subscription.serviceAccountId &&
            subscriptionProduct?.purchaseMode === "individual" ? (
              <DropdownMenuItem onClick={() => setReplaceOpen(true)}>
                Cambiar cuenta
              </DropdownMenuItem>
            ) : null}
            {subscription.serviceSlug === "chatgpt-private" && subscription.serviceAccountId ? (
              <DropdownMenuItem onClick={() => setBlockOpen(true)}>
                Marcar cuenta bloqueada
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
            ) : canKeepAccountAvailable ? (
              <DropdownMenuItem onClick={() => setCancelOpen(true)}>
                Dar de baja
              </DropdownMenuItem>
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

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dar de baja</DialogTitle>
            <DialogDescription>
              La venta se cancelará y podrás reutilizar la cuenta en otra venta.
            </DialogDescription>
          </DialogHeader>
          <form action={cancelAction}>
            <FieldGroup>
              <input name="id" type="hidden" value={subscription.id} />
              <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
                <Checkbox name="keep_account_available" value="1" />
                <span>
                  <span className="font-medium">Mantener cuenta disponible para otra venta</span>
                  <span className="block text-muted-foreground">Desmarcada, la cuenta quedará inactiva.</span>
                </span>
              </label>
              {"error" in cancelState && cancelState.error ? (
                <Alert variant="destructive">
                  <AlertTitle>No se pudo dar de baja</AlertTitle>
                  <AlertDescription>{String(cancelState.error)}</AlertDescription>
                </Alert>
              ) : null}
              <FormSubmitButton pendingLabel="Dando de baja...">
                Confirmar baja
              </FormSubmitButton>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={blockOpen} onOpenChange={setBlockOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar cuenta bloqueada</DialogTitle>
            <DialogDescription>
              La venta seguirá activa y estos días se repondrán al cambiar la cuenta.
            </DialogDescription>
          </DialogHeader>
          <form action={blockAction}>
            <FieldGroup>
              <input name="subscription_id" type="hidden" value={subscription.id} />
              <Field>
                <FieldLabel>Fecha de bloqueo</FieldLabel>
                <Input defaultValue={new Date().toISOString().slice(0, 10)} name="blocked_at" required type="date" />
              </Field>
              <Field>
                <FieldLabel>Motivo</FieldLabel>
                <Input name="block_reason" placeholder="Aviso del cliente" />
              </Field>
              {"error" in blockState && blockState.error ? (
                <Alert variant="destructive"><AlertDescription>{String(blockState.error)}</AlertDescription></Alert>
              ) : null}
              <FormSubmitButton pendingLabel="Marcando...">Marcar bloqueada</FormSubmitButton>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>

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
          <div className="grid gap-4">
            <section className="grid gap-2" aria-labelledby={`customer-account-${subscription.id}`}>
              <h3 className="text-sm font-medium" id={`customer-account-${subscription.id}`}>
                Cuenta del cliente
              </h3>
              <CopyLine label="Correo o usuario de acceso" value={customerEmail} />
              <CopyLine label={platformPasswordLabel} value={customerPassword} />
              <CopyLine label="Contraseña del correo" value={customerEmailPassword} />
              <CopyLine label="Correo invitado" value={subscription.detail?.invitation_email} />
              <CopyLine label="Perfil" value={subscription.detail?.profile_label} />
              <CopyLine label="Notas" value={subscription.detail?.notes} />
            </section>

            {hasDifferentInventory ? (
              <section className="grid gap-2 border-t pt-4" aria-labelledby={`inventory-account-${subscription.id}`}>
                <h3 className="text-sm font-medium" id={`inventory-account-${subscription.id}`}>
                  {subscription.serviceSlug === "spotify" ? "Cuenta madre Spotify" : "Cuenta de inventario"}
                </h3>
                <CopyLine label="Correo o usuario de acceso" value={inventoryEmail} />
                <CopyLine label={platformPasswordLabel} value={platformPassword} />
                <CopyLine label="Contraseña del correo" value={inventoryEmailPassword} />
                {extraPasswords.map(([key, value]) => (
                  <CopyLine key={key} label={key} value={value} />
                ))}
                <CopyLine label="Enlace del plan familiar" value={subscription.account?.spotify_family_plans?.invite_url} />
                <CopyLine label="Dirección del plan familiar" value={subscription.account?.spotify_family_plans?.address} />
                <CopyLine label="Enlace 2FA" value={subscription.account?.two_factor_url} />
              </section>
            ) : null}
            {subscription.serviceSlug === "chatgpt-private" ? (
              <>
                <div className="mt-4 rounded-lg border p-3 text-sm">
                  <div className="font-medium">Gasto del cliente</div>
                  <div>{money(subscription.accountCostBob, "BOB")} · {money(subscription.accountCostUsdt, "USDT")}</div>
                </div>
                <div className="mt-4 rounded-lg border p-3 text-sm">
                  <div className="mb-2 font-medium">Historial de cuentas</div>
                  <div className="grid gap-2">
                    {subscription.accountHistory.map((history) => {
                      return <div key={history.service_account_id + history.assigned_at} className="border-b pb-2 last:border-0">
                        <div>{history.service_accounts?.label ?? history.service_account_id} · {history.duration_days} días</div>
                        <div className="text-muted-foreground">Desde {formatDate(history.service_accounts?.created_at ?? history.assigned_at)}{history.ended_at ? ` hasta ${formatDate(history.ended_at)}` : " · actual"}</div>
                        {history.blocked_at ? <div className="text-destructive">Bloqueada {formatDate(history.blocked_at)}{history.block_reason ? ` · ${history.block_reason}` : ""}</div> : null}
                      </div>
                    })}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Editar venta</DialogTitle>
            <DialogDescription>{subscription.productName}</DialogDescription>
          </DialogHeader>
          <EditSaleForm
            accounts={accounts}
            countries={countries}
            defaultCountryId={defaultCountryId}
            initialValues={editInitialValues}
            onSaved={() => setOpen(false)}
            products={editableProducts}
            providers={providers}
          />
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
