import { claimFirstAdmin } from "@/app/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { requireUser } from "@/lib/auth"
import { money } from "@/lib/money"

export default async function AdminPage() {
  const { supabase, profile } = await requireUser()

  if (profile?.role !== "admin") {
    return (
      <div className="mx-auto flex min-h-[70svh] max-w-md items-center">
        <Card>
          <CardHeader>
            <CardTitle>Crear primer administrador</CardTitle>
            <CardDescription>
              Esta acción solo funciona mientras no exista otro admin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={claimFirstAdmin}>
              <Button type="submit">Convertirme en admin</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  const [{ data: summary }, { data: renewals }, { count: customers }] =
    await Promise.all([
      supabase
        .from("monthly_revenue_summary")
        .select("*")
        .order("month", { ascending: false })
        .limit(6),
      supabase
        .from("subscription_status_view")
        .select("*")
        .order("ends_on", { ascending: true })
        .limit(8),
      supabase.from("customers").select("*", { count: "exact", head: true }),
    ])

  const current = summary?.[0]

  return (
    <>
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Cobrado</CardDescription>
            <CardTitle>{money(current?.collected_bob, "BOB")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {money(current?.collected_usdt, "USDT")}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Pendiente</CardDescription>
            <CardTitle>{money(current?.pending_bob, "BOB")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {money(current?.pending_usdt, "USDT")}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Proyectado</CardDescription>
            <CardTitle>{money(current?.projected_bob, "BOB")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {money(current?.projected_usdt, "USDT")}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Clientes</CardDescription>
            <CardTitle>{customers ?? 0}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            registrados
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Próximas renovaciones</CardTitle>
          <CardDescription>Accesos vencidos o por vencer primero.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Cuenta</TableHead>
                <TableHead>Finaliza</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(renewals ?? []).map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.customer_name}</TableCell>
                  <TableCell>{item.product_name}</TableCell>
                  <TableCell>{item.account_label ?? item.slot_label}</TableCell>
                  <TableCell>{item.ends_on}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{item.computed_status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  )
}
