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

type ProviderOption = {
  id: string
  name: string
  provider_services?: Array<{ service_id: string }>
}

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>
}) {
  const params = await searchParams
  const { supabase } = await requireAdmin()
  const [{ data: accounts }, { data: services }, { data: providers }, { data: linkedSales }] =
    await Promise.all([
      supabase
        .from("service_accounts")
        .select("id, service_id, provider_id, email_address_id, label, login_email, username, status, started_at, dead_at, replacement_account_id, base_cost_amount, base_cost_currency, base_cost_exchange_rate, base_cost_usdt, base_cost_bob, renewal_due_on, two_factor_url, notes, services(name, slug), providers(name), email_addresses(email, email_password, origin, provider_id), spotify_family_plans(invite_url, address, seats_total), account_credentials(secret_payload)")
        .order("created_at", { ascending: false }),
      supabase.from("services").select("id, name, slug").eq("status", "active").order("name"),
      supabase
        .from("providers")
        .select("id, name, provider_services(service_id)")
        .eq("status", "active")
        .order("name"),
      supabase
        .from("subscriptions")
        .select("service_account_id, products(slug)")
        .neq("status", "canceled")
        .neq("status", "inactive")
        .not("service_account_id", "is", null),
    ])
  const linkedAccountIds = (linkedSales ?? [])
    .map((sale) => sale.service_account_id)
    .filter((id): id is string => Boolean(id))
  const spotifyUsage = new Map<string, number>()
  for (const sale of linkedSales ?? []) {
    if (
      !sale.service_account_id ||
      one(sale.products)?.slug !== "spotify_family_member"
    ) {
      continue
    }

    spotifyUsage.set(
      sale.service_account_id,
      (spotifyUsage.get(sale.service_account_id) ?? 0) + 1
    )
  }
  const accountRows = (accounts ?? []).map((account) => ({
    ...account,
    spotifySeatsUsed: spotifyUsage.get(account.id) ?? 0,
  }))
  const providerOptions = ((providers ?? []) as ProviderOption[]).map((provider) => ({
    id: provider.id,
    name: provider.name,
    serviceIds: (provider.provider_services ?? []).map((item) => item.service_id),
  }))

  return (
    <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
          <div className="flex items-center gap-2">
            <CardTitle>Inventario comprado</CardTitle>
            {params.saved ? <Badge variant="secondary">Guardado</Badge> : null}
          </div>
          <CardDescription>Cuentas completas, planes y perfiles comprados.</CardDescription>
          </div>
          <Dialog>
            <DialogTrigger className={buttonVariants()}>
              <PlusIcon data-icon="inline-start" />
              Nuevo ítem
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
              <DialogTitle className="sr-only">Nuevo ítem comprado</DialogTitle>
              <InventoryForm services={services ?? []} providers={providerOptions} />
            </DialogContent>
          </Dialog>
        </CardHeader>
        <AccountsTable
          accounts={accountRows}
          linkedAccountIds={linkedAccountIds}
          services={services ?? []}
          providers={providerOptions}
        />
      </Card>
  )
}
