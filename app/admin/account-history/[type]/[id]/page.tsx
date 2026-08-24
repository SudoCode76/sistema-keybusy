import Link from "next/link"
import { notFound } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDate } from "@/lib/date"
import { requireAdmin } from "@/lib/auth"

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid gap-1 border-b py-3 last:border-0 sm:grid-cols-[12rem_1fr] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm font-medium">{value || "No registrado"}</dd>
    </div>
  )
}

export default async function AccountHistoryDetailPage({
  params,
}: {
  params: Promise<{ type: string; id: string }>
}) {
  const { supabase } = await requireAdmin()
  const { type, id } = await params
  let title = "Detalle histórico"
  let description = ""
  let status = ""
  let rows: Array<{ label: string; value: string | null | undefined }> = []

  if (type === "service_account") {
    const { data } = await supabase
      .from("service_accounts")
      .select("label, login_email, username, status, started_at, dead_at, updated_at, services(name, slug), providers(name)")
      .eq("id", id)
      .maybeSingle()
    if (!data || data.status === "active") notFound()
    const service = one(data.services)
    const provider = one(data.providers)
    title = data.label
    description = "Cuenta madre archivada o dada de baja"
    status = data.status
    rows = [
      { label: "Plataforma", value: service?.name },
      { label: "Correo", value: data.login_email },
      { label: "Usuario", value: data.username },
      { label: "Proveedor", value: provider?.name },
      { label: "Inicio", value: formatDate(data.started_at) },
      { label: "Finalizó", value: formatDate(data.dead_at) },
      { label: "Última actualización", value: formatDate(data.updated_at) },
    ]
  } else if (type === "subscription") {
    const { data } = await supabase
      .from("subscriptions")
      .select("status, starts_on, ends_on, updated_at, customers(display_name, phone, email), products(name, slug, services(name)), service_accounts(label, login_email)")
      .eq("id", id)
      .maybeSingle()
    if (!data || !["canceled", "inactive"].includes(data.status)) notFound()
    const product = one(data.products)
    const service = one(product?.services)
    const customer = one(data.customers)
    const account = one(data.service_accounts)
    title = customer?.display_name ?? "Acceso sin cliente"
    description = product?.name ?? "Venta histórica"
    status = data.status
    rows = [
      { label: "Plataforma", value: service?.name },
      { label: "Producto", value: product?.name },
      { label: "Cuenta asociada", value: account?.label },
      { label: "Correo de cuenta", value: account?.login_email },
      { label: "Cliente", value: customer?.display_name },
      { label: "Contacto", value: customer?.phone ?? customer?.email },
      { label: "Inicio", value: formatDate(data.starts_on) },
      { label: "Finalizó", value: formatDate(data.ends_on) },
      { label: "Última actualización", value: formatDate(data.updated_at) },
    ]
  } else if (type === "family_member") {
    const { data } = await supabase
      .from("spotify_member_accounts")
      .select("login_email, member_name, status, removed_at, service_accounts(label, login_email), source_subscription:subscriptions!spotify_member_accounts_source_subscription_id_fkey(status, starts_on, ends_on, customers(display_name), products(name, services(name)), service_accounts(label, login_email))")
      .eq("id", id)
      .maybeSingle()
    if (!data || data.status !== "removed") notFound()
    const account = one(data.service_accounts)
    const source = one(data.source_subscription)
    const sourceProduct = one(source?.products)
    const sourceService = one(sourceProduct?.services)
    const sourceCustomer = one(source?.customers)
    title = data.member_name ?? data.login_email
    description = "Miembro Spotify eliminado o movido"
    status = "removed"
    rows = [
      { label: "Plataforma", value: sourceService?.name ?? "Spotify" },
      { label: "Correo del miembro", value: data.login_email },
      { label: "Nombre del miembro", value: data.member_name },
      { label: "Plan familiar", value: account?.label },
      { label: "Correo de la cuenta madre", value: account?.login_email },
      { label: "Cliente histórico", value: sourceCustomer?.display_name },
      { label: "Inicio de la venta", value: formatDate(source?.starts_on) },
      { label: "Finalizó la venta", value: formatDate(source?.ends_on) },
      { label: "Eliminado", value: formatDate(data.removed_at) },
    ]
  } else {
    notFound()
  }

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Badge variant={status === "removed" || status === "dead" ? "destructive" : "secondary"}>{status}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <dl>{rows.map((row) => <DetailRow key={row.label} {...row} />)}</dl>
        <Link className="mt-5 inline-flex rounded-md border px-3 py-2 text-sm hover:bg-muted" href="/admin/account-history">
          Volver al historial
        </Link>
      </CardContent>
    </Card>
  )
}
