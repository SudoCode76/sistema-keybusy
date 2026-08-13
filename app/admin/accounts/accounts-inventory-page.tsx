import { InventoryForm } from "@/app/admin/accounts/inventory-form"
import { AccountsTable } from "@/app/admin/accounts/accounts-table"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { requireAdmin } from "@/lib/auth"
import { PlusIcon } from "lucide-react"

export type AccountModel = "mother" | "private"

type ProviderOption = {
  id: string
  name: string
  provider_services?: Array<{ service_id: string }>
}

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export async function AccountsInventoryPage({
  accountModel,
  searchParams,
}: {
  accountModel: AccountModel
  searchParams: Promise<{ saved?: string }>
}) {
  const params = await searchParams
  const { supabase } = await requireAdmin()
  const [{ data: accounts }, { data: services }, { data: providers }, { data: linkedSales }, { data: spotifyMembers }] =
    await Promise.all([
      supabase
        .from("service_accounts")
        .select("id, service_id, provider_id, email_address_id, label, login_email, username, status, started_at, dead_at, replacement_account_id, base_cost_amount, base_cost_currency, base_cost_exchange_rate, base_cost_usdt, base_cost_bob, renewal_due_on, seat_capacity, two_factor_url, notes, services(name, slug, account_model, default_seat_capacity, products(slug, purchase_mode, is_default)), providers(name), email_addresses(email, email_password, origin, provider_id), spotify_family_plans(invite_url, address, seats_total), account_credentials(secret_payload)")
        .order("created_at", { ascending: false }),
      supabase
        .from("services")
        .select("id, name, slug, account_model, default_seat_capacity, show_in_inventory_tabs, products(slug, purchase_mode, is_default)")
        .eq("status", "active")
        .eq("account_model", accountModel)
        .order("name"),
      supabase
        .from("providers")
        .select("id, name, provider_services(service_id)")
        .eq("status", "active")
        .order("name"),
      supabase
        .from("subscriptions")
        .select("id, service_account_id, status, starts_on, ends_on, duration_months, slot_label, products(slug), customers(display_name, phone_e164), subscription_access_details(login_email, profile_label), service_accounts(label)")
        .eq("status", "active")
        .not("service_account_id", "is", null),
      supabase
        .from("spotify_member_accounts")
        .select("id, service_account_id, source_subscription_id, current_subscription_id, login_email, member_name, status, created_at, updated_at, source_subscription:subscriptions!spotify_member_accounts_source_subscription_id_fkey(customers(display_name), starts_on, ends_on, duration_months, status), current_subscription:subscriptions!spotify_member_accounts_current_subscription_id_fkey(customers(display_name), starts_on, ends_on, duration_months, status)")
        .order("created_at"),
    ])

  const selectedAccounts = (accounts ?? []).filter(
    (account) => one(account.services)?.account_model === accountModel
  )
  const activeAccountUses = (linkedSales ?? []).map((sale) => ({
    serviceAccountId: sale.service_account_id,
    productSlug: one(sale.products)?.slug ?? null,
  }))
  const accountLabels = new Map((accounts ?? []).map((account) => [account.id, account.label ?? "Plan Spotify"]))
  const activeAccountMembers = (linkedSales ?? []).flatMap((sale) => {
    if (!sale.service_account_id || one(sale.products)?.slug === "spotify_family_member") {
      return []
    }
    const customer = one(sale.customers)
    const access = one(sale.subscription_access_details)
    return [{
      id: sale.id,
      sourceSubscriptionId: null,
      currentSubscriptionId: sale.id,
      serviceAccountId: sale.service_account_id,
      serviceAccountLabel: one(sale.service_accounts)?.label ?? "Cuenta madre",
      customerName: customer?.display_name ?? "Cliente",
      contact: access?.login_email ?? customer?.phone_e164 ?? null,
      memberName: null,
      profileLabel: access?.profile_label ?? sale.slot_label,
      startsOn: sale.starts_on,
      endsOn: sale.ends_on,
      durationMonths: sale.duration_months,
      status: "assigned",
    }]
  })
  const accountMembers = (spotifyMembers ?? []).map((member) => {
    const currentSale = one(member.current_subscription)
    const sourceSale = one(member.source_subscription)
    const sale = currentSale ?? sourceSale
    return {
      id: member.id,
      sourceSubscriptionId: member.source_subscription_id,
      currentSubscriptionId: member.current_subscription_id,
      serviceAccountId: member.service_account_id,
      serviceAccountLabel: accountLabels.get(member.service_account_id) ?? "Plan Spotify",
      customerName: one(sale?.customers)?.display_name ?? "Sin cliente",
      contact: member.login_email,
      memberName: member.member_name,
      profileLabel: "Miembro familiar",
      startsOn: sale?.starts_on ?? null,
      endsOn: sale?.ends_on ?? null,
      durationMonths: sale?.duration_months ?? null,
      status: member.status,
    }
  })
  const accountUsage = new Map<string, number>()
  for (const sale of linkedSales ?? []) {
    if (!sale.service_account_id || one(sale.products)?.slug === "chatgpt_codex") continue
    if (one(sale.products)?.slug === "spotify_family_member") continue
    accountUsage.set(
      sale.service_account_id,
      (accountUsage.get(sale.service_account_id) ?? 0) + 1
    )
  }
  for (const member of spotifyMembers ?? []) {
    if (member.status !== "removed") {
      accountUsage.set(
        member.service_account_id,
        (accountUsage.get(member.service_account_id) ?? 0) + 1
      )
    }
  }
  for (const sale of linkedSales ?? []) {
    if (!sale.service_account_id) continue
    if (one(sale.products)?.slug === "spotify_family_member" && sale.slot_label === "Titular") {
      accountUsage.set(
        sale.service_account_id,
        (accountUsage.get(sale.service_account_id) ?? 0) + 1
      )
    }
  }
  const accountRows = selectedAccounts.map((account) => ({
    ...account,
    spotifySeatsUsed: accountUsage.get(account.id) ?? 0,
  }))
  const providerOptions = ((providers ?? []) as ProviderOption[]).map((provider) => ({
    id: provider.id,
    name: provider.name,
    serviceIds: (provider.provider_services ?? []).map((item) => item.service_id),
  }))
  const isMother = accountModel === "mother"
  const returnPath = isMother ? "/admin/accounts" : "/admin/personal-accounts"
  const title = isMother ? "Cuentas madre" : "Cuentas personales"
  const description = isMother
    ? "Cuentas compartidas, sus costos, cupos y miembros asignados."
    : "Cuentas compradas para un solo cliente, con sus credenciales y disponibilidad."

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CardTitle>{title}</CardTitle>
            {params.saved ? <Badge variant="secondary">Guardado</Badge> : null}
          </div>
          <CardDescription>{description}</CardDescription>
        </div>
        <Dialog>
          <DialogTrigger className={buttonVariants()}>
            <PlusIcon data-icon="inline-start" />
            {isMother ? "Registrar cuenta madre" : "Registrar cuenta personal"}
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogTitle className="sr-only">
              {isMother ? "Registrar cuenta madre" : "Registrar cuenta personal"}
            </DialogTitle>
            <InventoryForm
              accountModel={accountModel}
              returnPath={returnPath}
              services={services ?? []}
              providers={providerOptions}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <AccountsTable
        accountModel={accountModel}
        accounts={accountRows}
        activeAccountUses={activeAccountUses}
        accountMembers={isMother ? activeAccountMembers : []}
        spotifyClients={isMother ? accountMembers : []}
        returnPath={returnPath}
        services={services ?? []}
        providers={providerOptions}
      />
    </Card>
  )
}
