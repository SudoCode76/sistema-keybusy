"use client"

import { useActionState, useCallback, useEffect, useRef, useState } from "react"
import { PlusIcon } from "lucide-react"

import {
  createQuickProvider,
  createSale,
  updateSubscription,
  type SaleState,
} from "@/app/actions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CountrySelect } from "@/components/country-select"
import { ManagedEmailPicker } from "@/components/managed-email-picker"
import { Spinner } from "@/components/ui/spinner"
import { money } from "@/lib/money"
import { formatDate } from "@/lib/date"
import {
  isValidTelegramUsername,
  normalizeTelegramUsername,
} from "@/lib/phone"
import { cn } from "@/lib/utils"

import type { DuplicateCheck } from "./duplicate-check"
import {
  SPOTIFY_MEMBER,
  SPOTIFY_OWNER,
  spotifyPlanUnavailable as isSpotifyPlanUnavailable,
  type SpotifySeatType,
} from "./spotify-seats"
export type ProductOption = {
  id: string
  serviceId: string
  slug: string
  name: string
  serviceName: string
  serviceSlug: string
  defaultDurationMonths: number
  defaultPriceAmount: number
  defaultPriceCurrency: "BOB" | "USDT"
  defaultExchangeRate: number | null
  purchaseMode: "inventory" | "individual" | "linked"
  accessFields: string[]
  defaultPurchaseAmount: number
  defaultPurchaseCurrency: "BOB" | "USDT"
  defaultPurchaseExchangeRate: number | null
  isDefault: boolean
}

export type AccountOption = {
  id: string
  label: string
  serviceSlug: string
  availableForSale: boolean
  seatsTotal: number | null
  seatsUsed: number
  ownerAssigned: boolean
}

export type ProviderOption = {
  id: string
  name: string
  phoneE164: string | null
  serviceIds: string[]
  serviceNames: string[]
}

export type CountryOption = {
  id: string
  iso2: string
  name: string
  dial_code: string
}

export type SaleFormProps = {
  products: ProductOption[]
  accounts: AccountOption[]
  providers: ProviderOption[]
  countries: CountryOption[]
  defaultCountryId?: string
  defaultProductSlug?: string
  onSaved?: () => void
}

export type SaleFormInitialValues = {
  subscriptionId: string
  customerId: string
  countryId: string
  phone: string
  telegramUsername: string
  productSlug: string
  serviceAccountId: string | null
  providerId: string | null
  accountLabel: string
  managedEmailId: string | null
  loginEmail: string
  loginPassword: string
  emailPassword: string
  invitationEmail: string
  profileLabel: string
  twoFactorUrl: string
  startsOn: string
  durationMonths: number
  priceAmount: number
  priceCurrency: "BOB" | "USDT"
  purchaseAmount: number
  purchaseCurrency: "BOB" | "USDT"
  notes: string
  accessNotes: string
}

export type EditSaleFormProps = SaleFormProps & {
  initialValues: SaleFormInitialValues
}

type SaleFormBodyProps = SaleFormProps & {
  initialValues?: SaleFormInitialValues
  submitAction: (
    state: SaleState,
    formData: FormData
  ) => Promise<SaleState>
  submitLabel: string
}

const productCopy: Record<
  string,
  {
    accountLabel?: string
    loginEmailLabel?: string
    loginPasswordLabel?: string
    emailPasswordLabel?: string
    invitationEmailLabel?: string
    profileLabel?: string
    accountLabelField?: string
    provider?: boolean
  }
> = {
  chatgpt_shared: {
    accountLabel: "Inventario ChatGPT compartido",
  },
  spotify_family_member: {
    accountLabel: "Inventario Spotify familiar",
    loginEmailLabel: "Correo Spotify",
    loginPasswordLabel: "Contrasena Spotify",
    emailPasswordLabel: "Contrasena del correo",
  },
  netflix_profile: {
    accountLabel: "Inventario Netflix",
    profileLabel: "Perfil asignado",
  },
  canva_profile: {
    invitationEmailLabel: "Correo invitado",
  },
  chatgpt_private: {
    loginEmailLabel: "Correo de la cuenta",
    loginPasswordLabel: "Contrasena de la cuenta",
    accountLabelField: "Nombre interno de la cuenta",
    provider: true,
  },
  chatgpt_codex: {
    accountLabel: "Inventario ChatGPT privado",
  },
  disney_profile: {
    loginEmailLabel: "Correo Disney+",
    loginPasswordLabel: "Contrasena Disney+",
  },
}

const accountModeLabels = {
  new: "Crear cuenta nueva",
  existing: "Usar cuenta disponible",
} as const

const accessStatusLabels = {
  active: "Activo",
  expired: "Vencido",
} as const

function todayDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function QuickProviderDialog({
  countries,
  defaultCountryId,
  onOpenChange,
  onSaved,
  open,
  product,
}: {
  countries: CountryOption[]
  defaultCountryId: string
  onOpenChange: (open: boolean) => void
  onSaved: (provider: ProviderOption) => void
  open: boolean
  product: ProductOption | undefined
}) {
  const [state, action, pending] = useActionState(createQuickProvider, {})
  const handledProviderId = useRef<string | null>(null)

  useEffect(() => {
    if (
      state.provider &&
      product &&
      handledProviderId.current !== state.provider.id
    ) {
      handledProviderId.current = state.provider.id
      onSaved({
        ...state.provider,
        serviceIds: [product.serviceId],
        serviceNames: [product.serviceName],
      })
    }
  }, [onSaved, product, state.provider])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button type="button" variant="outline" />}>
        <PlusIcon data-icon="inline-start" />
        Nuevo
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo proveedor</DialogTitle>
          <DialogDescription>
            Se asociará a {product?.serviceName ?? "la plataforma actual"}.
          </DialogDescription>
        </DialogHeader>
        <form action={action}>
          <FieldGroup>
            <input
              name="service_id"
              type="hidden"
              value={product?.serviceId ?? ""}
            />
            <Field>
              <FieldLabel>País</FieldLabel>
              <CountrySelect
                countries={countries}
                defaultValue={defaultCountryId}
                key={`provider-country-${defaultCountryId}`}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="quick_provider_phone">Teléfono</FieldLabel>
              <Input
                id="quick_provider_phone"
                name="phone"
                placeholder="Ej. 76543210"
                required
              />
            </Field>
            {state.error ? (
              <Alert variant="destructive">
                <AlertTitle>No se pudo guardar</AlertTitle>
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            ) : null}
            <Button disabled={pending || !product?.serviceId} type="submit">
              {pending ? <Spinner data-icon="inline-start" /> : null}
              {pending ? "Guardando..." : "Guardar proveedor"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function SaleFormBody({
  products,
  accounts,
  providers,
  countries,
  defaultCountryId,
  defaultProductSlug,
  onSaved,
  initialValues,
  submitAction,
  submitLabel,
}: SaleFormBodyProps) {
  const initialProduct =
    products.find(
      (product) =>
        product.slug === (initialValues?.productSlug ?? defaultProductSlug)
    ) ??
    products[0]
  const [state, action, pending] = useActionState(submitAction, {})
  const [productSlug, setProductSlug] = useState(initialProduct?.slug ?? "")
  const [countryId, setCountryId] = useState(
    initialValues?.countryId ?? defaultCountryId ?? countries[0]?.id ?? ""
  )
  const [phone, setPhone] = useState(initialValues?.phone ?? "")
  const [telegramUsername, setTelegramUsername] = useState(
    initialValues?.telegramUsername ? `@${initialValues.telegramUsername}` : ""
  )
  const [loginEmail, setLoginEmail] = useState(initialValues?.loginEmail ?? "")
  const [invitationEmail, setInvitationEmail] = useState(
    initialValues?.invitationEmail ?? ""
  )
  const [emailPassword, setEmailPassword] = useState(
    initialValues?.emailPassword ?? ""
  )
  const [duplicateCheck, setDuplicateCheck] = useState<DuplicateCheck | null>(
    null
  )
  const selectedProduct = products.find(
    (product) => product.slug === productSlug
  )
  const initialSharedAccount =
    initialValues?.serviceAccountId
      ? accounts.find(
          (account) => account.id === initialValues.serviceAccountId
        )
      : initialProduct?.serviceSlug === "chatgpt-shared"
      ? accounts.find((account) => account.serviceSlug === "chatgpt-shared")
      : undefined
  const [productLabel, setProductLabel] = useState(
    initialProduct
      ? `${initialProduct.name} · ${initialProduct.serviceName}`
      : ""
  )
  const [accountId, setAccountId] = useState(initialSharedAccount?.id ?? "")
  const [accountLabel, setAccountLabel] = useState(
    initialSharedAccount?.label ?? ""
  )
  const [providerId, setProviderId] = useState(
    initialValues?.providerId ?? "none"
  )
  const [providerOptions, setProviderOptions] = useState(providers)
  const [providerDialogOpen, setProviderDialogOpen] = useState(false)
  const [accountMode, setAccountMode] = useState<"new" | "existing">("new")
  const [managedEmailMode, setManagedEmailMode] = useState<"new" | "existing">(
    "new"
  )
  const [linkInventory, setLinkInventory] = useState(
    Boolean(
      initialValues?.serviceAccountId &&
        initialProduct?.purchaseMode === "inventory"
    )
  )
  const [spotifySeatType, setSpotifySeatType] =
    useState<SpotifySeatType>(
      initialValues?.profileLabel === SPOTIFY_OWNER
        ? SPOTIFY_OWNER
        : SPOTIFY_MEMBER
    )
  const [duration, setDuration] = useState(
    String(
      initialValues?.durationMonths ?? selectedProduct?.defaultDurationMonths ?? 1
    )
  )
  const [price, setPrice] = useState(
    String(initialValues?.priceAmount ?? selectedProduct?.defaultPriceAmount ?? 0)
  )
  const [priceCurrency, setPriceCurrency] = useState<"BOB" | "USDT">(
    initialValues?.priceCurrency ?? selectedProduct?.defaultPriceCurrency ?? "BOB"
  )
  const [purchaseAmount, setPurchaseAmount] = useState(
    String(
      initialValues?.purchaseAmount ??
        selectedProduct?.defaultPurchaseAmount ??
        0
    )
  )
  const [purchaseCurrency, setPurchaseCurrency] = useState<"BOB" | "USDT">(
    initialValues?.purchaseCurrency ??
      selectedProduct?.defaultPurchaseCurrency ??
      "USDT"
  )
  const configuredFields = new Set(selectedProduct?.accessFields ?? [])
  const productLabels = productCopy[productSlug] ?? {}
  const copy = {
    ...productLabels,
    loginEmailLabel: configuredFields.has("login_email")
      ? (productLabels.loginEmailLabel ?? "Correo de acceso")
      : undefined,
    loginPasswordLabel: configuredFields.has("login_password")
      ? (productLabels.loginPasswordLabel ?? "Contraseña de plataforma")
      : undefined,
    emailPasswordLabel: configuredFields.has("email_password")
      ? (productLabels.emailPasswordLabel ?? "Contraseña del correo")
      : undefined,
    invitationEmailLabel: configuredFields.has("invitation_email")
      ? (productLabels.invitationEmailLabel ?? "Correo de invitación")
      : undefined,
    profileLabel: configuredFields.has("profile_label")
      ? (productLabels.profileLabel ?? "Perfil asignado")
      : undefined,
  }
  const isSpotify = selectedProduct?.slug === "spotify_family_member"
  const editing = Boolean(initialValues)
  const canReuseIndividual = selectedProduct?.purchaseMode === "individual"
  const usesOptionalInventory =
    selectedProduct?.purchaseMode === "inventory" && !isSpotify
  const requiredAccountService = isSpotify
    ? selectedProduct?.serviceSlug
    : usesOptionalInventory
      ? linkInventory
        ? selectedProduct?.serviceSlug
        : undefined
      : selectedProduct?.purchaseMode === "individual" && accountMode === "new"
        ? undefined
        : selectedProduct?.serviceSlug
  const accountOptions = requiredAccountService
    ? accounts.filter(
        (account) =>
          account.serviceSlug === requiredAccountService &&
          (!isSpotify || account.seatsTotal !== null) &&
          (accountMode === "new" ||
            account.availableForSale ||
            account.id === initialValues?.serviceAccountId)
      )
    : []
  const selectedAccount = accountOptions.find(
    (account) => account.id === accountId
  )
  const spotifyPlanUnavailable = Boolean(
    isSpotify &&
    selectedAccount &&
    isSpotifyPlanUnavailable(selectedAccount, spotifySeatType)
  )
  const spotifySelectionInvalid =
    isSpotify && (!accountId || spotifyPlanUnavailable)
  const createsInventoryOnSale =
    selectedProduct?.purchaseMode === "individual" && accountMode === "new"
  const showsProvider =
    createsInventoryOnSale ||
    Boolean(
      copy.loginEmailLabel &&
      (!isSpotify || spotifySeatType === SPOTIFY_MEMBER) &&
      accountMode === "new" &&
      managedEmailMode === "new"
    )
  const defaultStartDate = initialValues?.startsOn ?? todayDate()
  const accountEmail = loginEmail.trim() || invitationEmail.trim()
  const normalizedTelegram = normalizeTelegramUsername(telegramUsername)
  const telegramInvalid =
    Boolean(telegramUsername.trim()) &&
    !isValidTelegramUsername(telegramUsername)
  const contactInvalid = !phone.trim() && !normalizedTelegram
  const matchingProviderOptions = providerOptions.filter((provider) =>
    provider.serviceIds.includes(selectedProduct?.serviceId ?? "")
  )
  const currentConflict =
    state.conflict?.productSlug === productSlug &&
    state.conflict.phone === phone.trim() &&
    state.conflict.telegramUsername === normalizedTelegram &&
    state.conflict.countryId === countryId &&
    (state.conflict.kind !== "private_account" || accountMode === "new") &&
    (!state.conflict.loginEmail ||
      state.conflict.loginEmail === accountEmail.toLowerCase())
      ? state.conflict
      : null
  const currentDuplicateCheck = duplicateCheck ?? currentConflict?.check ?? null
  const liveActiveMatches =
    currentDuplicateCheck?.matchingSales.filter(
      (sale) => sale.status === "active"
    ) ?? []
  const liveExpiredMatch =
    liveActiveMatches.length === 0
      ? currentDuplicateCheck?.matchingSales.find(
          (sale) => sale.status === "expired"
        )
      : undefined
  const liveAccountConflict =
    accountMode === "new"
      ? (currentDuplicateCheck?.privateAccount ?? null)
      : null

  useEffect(() => {
    if (state.message) {
      onSaved?.()
    }
  }, [onSaved, state.message])

  const handleProviderSaved = useCallback(
    (provider: ProviderOption) => {
      setProviderOptions((current) =>
        [...current.filter((item) => item.id !== provider.id), provider].sort(
          (a, b) =>
            (a.phoneE164 ?? a.name).localeCompare(b.phoneE164 ?? b.name)
        )
      )
      setProviderId(provider.id)
      setProviderDialogOpen(false)
    },
    [setProviderDialogOpen, setProviderId, setProviderOptions]
  )

  useEffect(() => {
    const hasPhone = Boolean(
      countryId && phone.replace(/\D/g, "").length >= 4
    )
    const hasTelegram = isValidTelegramUsername(telegramUsername)
    if (!hasPhone && !hasTelegram) {
      return
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      const params = new URLSearchParams({ productSlug })
      if (hasPhone) {
        params.set("countryId", countryId)
        params.set("phone", phone)
      }
      if (hasTelegram) {
        params.set("telegramUsername", normalizedTelegram)
      }
      if (initialValues) {
        params.set("excludeSubscriptionId", initialValues.subscriptionId)
        if (initialValues.serviceAccountId) {
          params.set(
            "excludeServiceAccountId",
            initialValues.serviceAccountId
          )
        }
      }
      if (canReuseIndividual && accountMode === "new" && accountEmail) {
        params.set("loginEmail", accountEmail)
      }

      try {
        const response = await fetch(
          `/admin/subscriptions/duplicate-check?${params}`,
          {
            signal: controller.signal,
          }
        )
        if (!response.ok) return
        setDuplicateCheck((await response.json()) as DuplicateCheck)
      } catch {
        // A server validation runs again when the form is submitted.
      }
    }, 300)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [
    accountMode,
    accountEmail,
    canReuseIndividual,
    countryId,
    normalizedTelegram,
    phone,
    productSlug,
    telegramUsername,
    initialValues,
  ])

  function selectProduct(slug: string) {
    const product = products.find((item) => item.slug === slug)
    const firstSharedAccount =
      editing && initialValues?.serviceAccountId
        ? accounts.find(
            (account) =>
              account.id === initialValues.serviceAccountId &&
              account.serviceSlug === product?.serviceSlug
          )
        : product?.serviceSlug === "chatgpt-shared"
        ? accounts.find((account) => account.serviceSlug === "chatgpt-shared")
        : undefined

    setProductSlug(slug)
    setProductLabel(product ? `${product.name} · ${product.serviceName}` : "")
    setAccountId(firstSharedAccount?.id ?? "")
    setAccountLabel(firstSharedAccount?.label ?? "")
    setAccountMode("new")
    setLinkInventory(
      Boolean(firstSharedAccount && product?.purchaseMode === "inventory")
    )
    setSpotifySeatType(SPOTIFY_MEMBER)
    setDuplicateCheck(null)
    if (!editing) {
      setLoginEmail("")
      setInvitationEmail("")
      setEmailPassword("")
      setProviderId("none")
    }
    setManagedEmailMode("new")
    setDuration(String(product?.defaultDurationMonths ?? 1))
    setPrice(String(product?.defaultPriceAmount ?? 0))
    setPriceCurrency(product?.defaultPriceCurrency ?? "BOB")
    setPurchaseAmount(String(product?.defaultPurchaseAmount ?? 0))
    setPurchaseCurrency(product?.defaultPurchaseCurrency ?? "USDT")
  }

  const salePricingFields = (
    <>
      <Field>
        <FieldLabel htmlFor="current_price_amount">Precio mensual</FieldLabel>
        <Input
          id="current_price_amount"
          name="current_price_amount"
          type="number"
          step="0.01"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
        />
        <FieldDescription>
          Total:{" "}
          {money(Number(price || 0) * Number(duration || 0), priceCurrency)}
        </FieldDescription>
      </Field>
      <Field>
        <FieldLabel>Moneda</FieldLabel>
        <Select
          name="current_price_currency"
          value={priceCurrency}
          onValueChange={(value) => {
            if (value === "BOB" || value === "USDT") {
              setPriceCurrency(value)
            }
          }}
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
    </>
  )

  return (
    <form action={action}>
      <FieldGroup>
        {initialValues ? (
          <>
            <input
              name="id"
              type="hidden"
              value={initialValues.subscriptionId}
            />
            <input
              name="customer_id"
              type="hidden"
              value={initialValues.customerId}
            />
            <input
              name="current_email_address_id"
              type="hidden"
              value={initialValues.managedEmailId ?? ""}
            />
          </>
        ) : null}
        <input name="service_account_id" type="hidden" value={accountId} />
        {state.error ? (
          <Alert variant="destructive">
            <AlertTitle>No se pudo guardar</AlertTitle>
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}
        {!onSaved && state.message ? (
          <Alert>
            <AlertTitle>Listo</AlertTitle>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}

        {currentDuplicateCheck?.customer ? (
          <Alert>
            <AlertTitle>
              Cliente existente: {currentDuplicateCheck.customer.name} ·{" "}
              {currentDuplicateCheck.customer.contact}
            </AlertTitle>
            <AlertDescription className="flex flex-col gap-2">
              {currentDuplicateCheck.customer.accesses.length > 0 ? (
                currentDuplicateCheck.customer.accesses.map((access) => (
                  <div
                    className="flex flex-wrap items-center gap-2"
                    key={access.id}
                  >
                    <span>
                      {access.serviceName} · {access.productName}
                    </span>
                    <Badge variant="secondary">
                      {accessStatusLabels[access.status]}
                    </Badge>
                    <span>
                      {formatDate(access.startsOn)} –{" "}
                      {formatDate(access.endsOn)}
                    </span>
                  </div>
                ))
              ) : (
                <span>El cliente no tiene accesos activos ni vencidos.</span>
              )}
            </AlertDescription>
          </Alert>
        ) : null}

        {liveActiveMatches.length > 0 ? (
          <Alert variant="destructive">
            <AlertTitle>
              El contacto {currentDuplicateCheck?.customer?.contact ??
                (phone || `@${normalizedTelegram}`)} ya
              tiene {currentDuplicateCheck?.target.serviceName}
            </AlertTitle>
            <AlertDescription className="flex flex-col gap-2">
              {liveActiveMatches.map((sale) => (
                <span key={sale.id}>
                  {sale.productName} · Activo · {formatDate(sale.startsOn)} –{" "}
                  {formatDate(sale.endsOn)}
                </span>
              ))}
              <span>
                Continúa únicamente si el cliente compró otro acceso del mismo
                servicio.
              </span>
            </AlertDescription>
          </Alert>
        ) : null}

        {liveExpiredMatch ? (
          <Alert variant="destructive">
            <AlertTitle>
              El contacto {currentDuplicateCheck?.customer?.contact ??
                (phone || `@${normalizedTelegram}`)} ya
              tiene {currentDuplicateCheck?.target.serviceName} vencido
            </AlertTitle>
            <AlertDescription className="flex flex-col gap-2">
              <span>
                {liveExpiredMatch.productName} ·{" "}
                {formatDate(liveExpiredMatch.startsOn)} –{" "}
                {formatDate(liveExpiredMatch.endsOn)}
              </span>
              <span>
                Renueva el registro existente desde Opciones para conservar su
                historial.
              </span>
            </AlertDescription>
          </Alert>
        ) : null}

        <FieldSet>
          <FieldLegend>Cliente y producto</FieldLegend>
          <FieldGroup className="grid gap-3 lg:grid-cols-[8rem_minmax(11rem,1fr)_minmax(12rem,1fr)_minmax(20rem,2fr)]">
            <Field>
              <FieldLabel>País</FieldLabel>
              <CountrySelect
                compact
                countries={countries}
                defaultValue={defaultCountryId}
                onValueChange={(value) => {
                  setCountryId(value)
                  setDuplicateCheck(null)
                }}
                required={Boolean(phone.trim())}
              />
            </Field>
            <Field data-invalid={contactInvalid}>
              <FieldLabel htmlFor="phone">Teléfono</FieldLabel>
              <Input
                id="phone"
                name="phone"
                onChange={(event) => {
                  setPhone(event.target.value)
                  setDuplicateCheck(null)
                }}
                placeholder="Ej. 76543210"
                aria-invalid={contactInvalid}
                value={phone}
              />
            </Field>
            <Field data-invalid={telegramInvalid || contactInvalid}>
              <FieldLabel htmlFor="telegram_username">Telegram</FieldLabel>
              <Input
                aria-invalid={telegramInvalid || contactInvalid}
                id="telegram_username"
                name="telegram_username"
                onChange={(event) => {
                  setTelegramUsername(event.target.value)
                  setDuplicateCheck(null)
                }}
                placeholder="@usuario"
                value={telegramUsername}
              />
              {telegramInvalid ? (
                <FieldDescription>
                  Usa 5–32 letras, números o guion bajo.
                </FieldDescription>
              ) : null}
            </Field>
            <Field>
              <FieldLabel>Ítem vendible</FieldLabel>
              <input name="product_slug" type="hidden" value={productSlug} />
              <Select
                value={productLabel}
                onValueChange={(value) => {
                  const product = products.find(
                    (item) => `${item.name} · ${item.serviceName}` === value
                  )

                  if (product) {
                    selectProduct(product.slug)
                  }
                }}
                required
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar ítem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {products.map((product) => (
                      <SelectItem
                        key={product.id}
                        value={`${product.name} · ${product.serviceName}`}
                      >
                        {product.name} · {product.serviceName}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
        </FieldSet>

        <FieldSet>
          <FieldLegend>Acceso</FieldLegend>
          <FieldGroup
            className={cn(
              canReuseIndividual && "grid gap-3 md:grid-cols-2",
              isSpotify &&
                "grid gap-3 lg:grid-cols-[minmax(10rem,0.8fr)_minmax(18rem,1.6fr)_minmax(18rem,1.2fr)]"
            )}
          >
            {usesOptionalInventory ? (
              <Field orientation="horizontal">
                <Checkbox
                  checked={linkInventory}
                  id="link_inventory"
                  onCheckedChange={(checked) => {
                    const next = checked === true
                    setLinkInventory(next)

                    if (!next) {
                      setAccountId("")
                      setAccountLabel("")
                      return
                    }

                    if (
                      selectedProduct?.serviceSlug === "chatgpt-shared"
                    ) {
                      const account = accounts.find(
                        (item) => item.serviceSlug === "chatgpt-shared"
                      )
                      setAccountId(account?.id ?? "")
                      setAccountLabel(account?.label ?? "")
                    }
                  }}
                />
                <FieldLabel htmlFor="link_inventory">
                  Vincular inventario
                </FieldLabel>
              </Field>
            ) : null}

            {isSpotify ? (
              <Field>
                <FieldLabel>Tipo de cupo Spotify</FieldLabel>
                <input
                  name="profile_label"
                  type="hidden"
                  value={spotifySeatType}
                />
                <Select
                  value={spotifySeatType}
                  onValueChange={(value) => {
                    const next =
                      value === SPOTIFY_OWNER ? SPOTIFY_OWNER : SPOTIFY_MEMBER
                    setSpotifySeatType(next)

                    if (
                      selectedAccount &&
                      isSpotifyPlanUnavailable(selectedAccount, next)
                    ) {
                      setAccountId("")
                      setAccountLabel("")
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
                <FieldDescription>
                  El titular usa la cuenta madre y ocupa uno de los cupos del
                  plan.
                </FieldDescription>
              </Field>
            ) : null}

            {canReuseIndividual && !editing ? (
              <Field>
                <FieldLabel>Cuenta privada</FieldLabel>
                <Select
                  value={accountModeLabels[accountMode]}
                  onValueChange={(value) => {
                    const mode =
                      value === accountModeLabels.existing ? "existing" : "new"
                    if (mode !== accountMode) {
                      setAccountMode(mode)
                      setAccountId("")
                      setAccountLabel("")
                      setDuplicateCheck(null)
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value={accountModeLabels.new}>
                        {accountModeLabels.new}
                      </SelectItem>
                      <SelectItem value={accountModeLabels.existing}>
                        {accountModeLabels.existing}
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            ) : null}

            {requiredAccountService ? (
              <Field>
                <FieldLabel>
                  {isSpotify
                    ? "Plan familiar Spotify"
                    : accountMode === "existing"
                      ? "Cuenta disponible"
                      : (copy.accountLabel ?? "Inventario enlazado")}
                </FieldLabel>
                <Select
                  key={productSlug}
                  value={accountLabel}
                  onValueChange={(value) => {
                    const account = accountOptions.find(
                      (item) => item.label === value
                    )

                    setAccountId(account?.id ?? "")
                    setAccountLabel(account?.label ?? "")
                  }}
                  required
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar cuenta o plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {accountOptions.map((account) => {
                        const unavailable =
                          isSpotify &&
                          isSpotifyPlanUnavailable(account, spotifySeatType)

                        return (
                          <SelectItem
                            disabled={unavailable}
                            key={account.id}
                            value={account.label}
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
                {isSpotify &&
                selectedAccount &&
                selectedAccount.seatsTotal !== null ? (
                  <FieldDescription>
                    {selectedAccount.seatsUsed}/{selectedAccount.seatsTotal}{" "}
                    cupos ocupados
                    {selectedAccount.ownerAssigned ? " · titular asignado" : ""}
                  </FieldDescription>
                ) : null}
                {accountOptions.length === 0 ? (
                  <FieldDescription>
                    {isSpotify
                      ? "Primero crea un plan familiar Spotify activo."
                      : accountMode === "existing"
                        ? "No hay cuentas privadas disponibles."
                        : "Primero crea inventario activo para este ítem."}
                  </FieldDescription>
                ) : null}
              </Field>
            ) : null}

            {showsProvider ? (
              <Field>
                <FieldLabel>Proveedor</FieldLabel>
                <input name="provider_id" type="hidden" value={providerId} />
                <div className="flex gap-2">
                  <Select
                    value={providerId}
                    onValueChange={(value) => setProviderId(value ?? "none")}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccionar proveedor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="none">Ninguno</SelectItem>
                        {matchingProviderOptions.map((provider) => (
                          <SelectItem key={provider.id} value={provider.id}>
                            {provider.phoneE164 ?? provider.name} ·{" "}
                            {provider.serviceNames.join(", ")}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <QuickProviderDialog
                    countries={countries}
                    defaultCountryId={countryId}
                    onOpenChange={setProviderDialogOpen}
                    onSaved={handleProviderSaved}
                    open={providerDialogOpen}
                    product={selectedProduct}
                  />
                </div>
              </Field>
            ) : null}

            <FieldGroup
              className={cn(
                canReuseIndividual && "md:col-span-2",
                isSpotify && "lg:col-span-3"
              )}
            >
              {createsInventoryOnSale || copy.invitationEmailLabel ? (
                <FieldGroup className="grid gap-3 md:grid-cols-2">
                  {createsInventoryOnSale ? (
                    <Field>
                      <FieldLabel htmlFor="account_label">
                        {copy.accountLabelField ??
                          "Nombre interno de la cuenta"}
                      </FieldLabel>
                      <Input
                        defaultValue={initialValues?.accountLabel}
                        id="account_label"
                        name="account_label"
                        placeholder="Cuenta cliente X"
                      />
                    </Field>
                  ) : null}
                  {copy.invitationEmailLabel ? (
                    <Field>
                      <FieldLabel htmlFor="invitation_email">
                        {copy.invitationEmailLabel}
                      </FieldLabel>
                      <Input
                        id="invitation_email"
                        name="invitation_email"
                        onChange={(event) => {
                          setInvitationEmail(event.target.value)
                          setDuplicateCheck(null)
                        }}
                        type="email"
                        value={invitationEmail}
                      />
                    </Field>
                  ) : null}
                </FieldGroup>
              ) : null}

              {isSpotify && spotifySeatType === SPOTIFY_OWNER ? (
                <Alert>
                  <AlertTitle>Credenciales de la cuenta madre</AlertTitle>
                  <AlertDescription>
                    Se copiarán desde el inventario al guardar esta venta.
                  </AlertDescription>
                </Alert>
              ) : null}

              {copy.loginEmailLabel &&
              accountMode === "new" &&
              (!isSpotify || spotifySeatType === SPOTIFY_MEMBER) ? (
                <ManagedEmailPicker
                  email={loginEmail}
                  emailPassword={emailPassword}
                  initialEmailId={initialValues?.managedEmailId}
                  onEmailChange={(value) => {
                    setLoginEmail(value)
                    setDuplicateCheck(null)
                  }}
                  onEmailPasswordChange={setEmailPassword}
                  onModeChange={setManagedEmailMode}
                  platformPassword={
                    copy.loginPasswordLabel
                      ? {
                          defaultValue: initialValues?.loginPassword,
                          label: copy.loginPasswordLabel,
                          name: "login_password",
                        }
                      : undefined
                  }
                  providerId={providerId}
                  showPassword={configuredFields.has("email_password")}
                />
              ) : null}

              {copy.profileLabel ||
              (configuredFields.has("two_factor_url") &&
                createsInventoryOnSale) ? (
                <FieldGroup className="grid gap-3 md:grid-cols-2">
                  {copy.profileLabel && !isSpotify ? (
                    <Field>
                      <FieldLabel htmlFor="profile_label">
                        {copy.profileLabel}
                      </FieldLabel>
                      <Input
                        defaultValue={initialValues?.profileLabel}
                        id="profile_label"
                        name="profile_label"
                        placeholder="Perfil 1"
                      />
                    </Field>
                  ) : null}
                  {configuredFields.has("two_factor_url") &&
                  createsInventoryOnSale ? (
                    <Field>
                      <FieldLabel htmlFor="two_factor_url">Link 2FA</FieldLabel>
                      <Input
                        defaultValue={initialValues?.twoFactorUrl}
                        id="two_factor_url"
                        name="two_factor_url"
                      />
                    </Field>
                  ) : null}
                </FieldGroup>
              ) : null}

              {liveAccountConflict ? (
                <Alert
                  variant={
                    liveAccountConflict.available ? "default" : "destructive"
                  }
                >
                  <AlertTitle>
                    El correo {liveAccountConflict.loginEmail} ya está
                    registrado en {liveAccountConflict.serviceName}
                  </AlertTitle>
                  <AlertDescription className="flex flex-col gap-3">
                    <span>
                      {liveAccountConflict.available
                        ? `La cuenta ${liveAccountConflict.label} está disponible y debe reutilizarse.`
                        : liveAccountConflict.sale
                          ? `Cliente: ${liveAccountConflict.sale.customerName}${liveAccountConflict.sale.customerPhone ? ` · ${liveAccountConflict.sale.customerPhone}` : ""}`
                          : `Estado de la cuenta: ${liveAccountConflict.status}.`}
                    </span>
                    {liveAccountConflict.sale ? (
                      <span>
                        {liveAccountConflict.sale.productName} ·{" "}
                        {accessStatusLabels[liveAccountConflict.sale.status]} ·{" "}
                        {formatDate(liveAccountConflict.sale.startsOn)} –{" "}
                        {formatDate(liveAccountConflict.sale.endsOn)}
                      </span>
                    ) : null}
                    {liveAccountConflict.available ? (
                      <Button
                        onClick={() => {
                          const account = accounts.find(
                            (item) => item.id === liveAccountConflict.id
                          )
                          setAccountMode("existing")
                          setAccountId(liveAccountConflict.id)
                          setAccountLabel(
                            account?.label ?? liveAccountConflict.label
                          )
                          setDuplicateCheck(null)
                        }}
                        type="button"
                        variant="outline"
                      >
                        Usar cuenta disponible
                      </Button>
                    ) : null}
                  </AlertDescription>
                </Alert>
              ) : null}
            </FieldGroup>
          </FieldGroup>
        </FieldSet>

        {createsInventoryOnSale ? (
          <FieldSet>
            <FieldLegend>Compra de la cuenta</FieldLegend>
            <FieldGroup className="grid gap-3 md:grid-cols-4">
              <Field>
                <FieldLabel htmlFor="purchase_amount">
                  Precio de compra
                </FieldLabel>
                <Input
                  id="purchase_amount"
                  name="purchase_amount"
                  type="number"
                  step="0.01"
                  value={purchaseAmount}
                  onChange={(event) => setPurchaseAmount(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel>Moneda compra</FieldLabel>
                <Select
                  name="purchase_currency"
                  value={purchaseCurrency}
                  onValueChange={(value) => {
                    if (value === "BOB" || value === "USDT") {
                      setPurchaseCurrency(value)
                    }
                  }}
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
              {salePricingFields}
            </FieldGroup>
          </FieldSet>
        ) : null}

        <FieldSet>
          <FieldLegend>Venta</FieldLegend>
          <FieldGroup
            className={cn(
              "grid gap-3",
              createsInventoryOnSale ? "md:grid-cols-2" : "md:grid-cols-4"
            )}
          >
            <Field>
              <FieldLabel htmlFor="starts_on">Inicio</FieldLabel>
              <Input
                defaultValue={defaultStartDate}
                id="starts_on"
                name="starts_on"
                type="date"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="duration_months">Meses</FieldLabel>
              <Input
                id="duration_months"
                name="duration_months"
                type="number"
                min="1"
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
              />
            </Field>
            {createsInventoryOnSale ? null : salePricingFields}
          </FieldGroup>
        </FieldSet>

        <FieldSet>
          <FieldLegend>Notas</FieldLegend>
          <FieldGroup
            className={cn("grid gap-3", initialValues && "md:grid-cols-2")}
          >
            <Field>
              <FieldLabel htmlFor="notes">Notas venta</FieldLabel>
              <Input
                defaultValue={initialValues?.notes}
                id="notes"
                name="notes"
              />
            </Field>
            {initialValues ? (
              <Field>
                <FieldLabel htmlFor="access_notes">Notas acceso</FieldLabel>
                <Input
                  defaultValue={initialValues.accessNotes}
                  id="access_notes"
                  name="access_notes"
                />
              </Field>
            ) : null}
          </FieldGroup>
        </FieldSet>

        {currentConflict?.kind === "active_sale" ||
        liveActiveMatches.length > 0 ? (
          <Button
            disabled={
              pending ||
              contactInvalid ||
              telegramInvalid ||
              spotifySelectionInvalid ||
              !!liveAccountConflict ||
              !!liveExpiredMatch
            }
            name="confirm_duplicate"
            type="submit"
            value="1"
            variant="destructive"
          >
            {pending ? "Guardando..." : `${submitLabel} de todos modos`}
          </Button>
        ) : (
          <Button
            type="submit"
            disabled={
              pending ||
              contactInvalid ||
              telegramInvalid ||
              spotifySelectionInvalid ||
              !!liveAccountConflict ||
              !!liveExpiredMatch ||
              currentConflict?.kind === "expired_sale" ||
              currentConflict?.kind === "private_account"
            }
          >
            {pending ? "Guardando..." : submitLabel}
          </Button>
        )}
      </FieldGroup>
    </form>
  )
}

export function SaleForm(props: SaleFormProps) {
  return (
    <SaleFormBody
      {...props}
      submitAction={createSale}
      submitLabel="Guardar venta"
    />
  )
}

export function EditSaleForm({
  initialValues,
  ...props
}: EditSaleFormProps) {
  return (
    <SaleFormBody
      {...props}
      initialValues={initialValues}
      submitAction={updateSubscription}
      submitLabel="Guardar cambios"
    />
  )
}
