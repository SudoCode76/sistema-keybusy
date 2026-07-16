import { signOut } from "@/app/actions"
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
import { formatDate } from "@/lib/date"
import { money } from "@/lib/money"

function visibleDetails(item: {
  login_email?: string | null
  login_password?: string | null
  email_password?: string | null
  invitation_email?: string | null
  access_notes?: string | null
}) {
  return [
    item.login_email ? `Correo: ${item.login_email}` : null,
    item.login_password ? `Clave: ${item.login_password}` : null,
    item.email_password ? `Clave correo: ${item.email_password}` : null,
    item.invitation_email ? `Invitacion: ${item.invitation_email}` : null,
    item.access_notes ? `Notas: ${item.access_notes}` : null,
  ].filter(Boolean)
}

export default async function PortalPage() {
  const { supabase, profile } = await requireUser()
  const { data } = await supabase
    .from("customer_portal_orders_view")
    .select("*")
    .eq("profile_id", profile?.id)
    .order("ends_on", { ascending: false })

  return (
    <main className="min-h-svh bg-muted/30 p-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Mis accesos</h1>
            <p className="text-sm text-muted-foreground">
              Cuentas activas, finalización e historial.
            </p>
          </div>
          <form action={signOut}>
            <Button type="submit" variant="outline">Salir</Button>
          </form>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Historial</CardTitle>
            <CardDescription>{data?.length ?? 0} pedidos.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Servicio</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Datos visibles</TableHead>
                  <TableHead>Finaliza</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data ?? []).map((item) => {
                  const details = visibleDetails(item)

                  return (
                    <TableRow key={item.subscription_id}>
                      <TableCell>{item.service_name}</TableCell>
                      <TableCell>{item.product_name}</TableCell>
                      <TableCell>{item.profile_label ?? item.slot_label}</TableCell>
                      <TableCell>
                        {details.length > 0 ? (
                          <div className="grid gap-1 text-xs text-muted-foreground">
                            {details.map((detail) => (
                              <span key={detail}>{detail}</span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(item.ends_on)}</TableCell>
                      <TableCell>{money(item.current_price_amount, item.current_price_currency ?? "BOB")}</TableCell>
                      <TableCell><Badge variant="secondary">{item.status}</Badge></TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
