import { createSubscription } from "@/app/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { requireAdmin } from "@/lib/auth"
import { money } from "@/lib/money"

export default async function SubscriptionsPage() {
  const { supabase } = await requireAdmin()
  const [
    { data: subscriptions },
    { data: customers },
    { data: products },
    { data: accounts },
  ] = await Promise.all([
    supabase.from("subscription_status_view").select("*").order("ends_on"),
    supabase.from("customers").select("id, display_name").order("display_name"),
    supabase.from("products").select("id, name").order("name"),
    supabase.from("service_accounts").select("id, label").order("label"),
  ])

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Vender acceso</CardTitle>
          <CardDescription>Crea suscripción, ciclo de cobro y pago inicial opcional.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createSubscription}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="customer_id">Cliente</FieldLabel>
                <select className="h-8 rounded-lg border bg-background px-2 text-sm" id="customer_id" name="customer_id" required>
                  {(customers ?? []).map((customer) => (
                    <option key={customer.id} value={customer.id}>{customer.display_name}</option>
                  ))}
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="product_id">Producto</FieldLabel>
                <select className="h-8 rounded-lg border bg-background px-2 text-sm" id="product_id" name="product_id" required>
                  {(products ?? []).map((product) => (
                    <option key={product.id} value={product.id}>{product.name}</option>
                  ))}
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="service_account_id">Cuenta base</FieldLabel>
                <select className="h-8 rounded-lg border bg-background px-2 text-sm" id="service_account_id" name="service_account_id">
                  <option value="">Sin cuenta</option>
                  {(accounts ?? []).map((account) => (
                    <option key={account.id} value={account.id}>{account.label}</option>
                  ))}
                </select>
              </Field>
              <div className="grid gap-3 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="slot_label">Perfil/asiento</FieldLabel>
                  <Input id="slot_label" name="slot_label" placeholder="Principal, Codex, Perfil 1" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="starts_on">Inicio</FieldLabel>
                  <Input id="starts_on" name="starts_on" type="date" />
                </Field>
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <Field>
                  <FieldLabel htmlFor="duration_months">Meses</FieldLabel>
                  <Input id="duration_months" name="duration_months" type="number" min="1" defaultValue="1" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="current_price_amount">Precio</FieldLabel>
                  <Input id="current_price_amount" name="current_price_amount" type="number" step="0.01" required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="current_price_currency">Moneda</FieldLabel>
                  <select className="h-8 rounded-lg border bg-background px-2 text-sm" id="current_price_currency" name="current_price_currency">
                    <option value="BOB">BOB</option>
                    <option value="USDT">USDT</option>
                  </select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="current_exchange_rate">Cambio</FieldLabel>
                  <Input id="current_exchange_rate" name="current_exchange_rate" type="number" step="0.000001" />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="notes">Notas</FieldLabel>
                <Textarea id="notes" name="notes" />
              </Field>
              <Field orientation="horizontal">
                <input id="paid_now" name="paid_now" type="checkbox" />
                <FieldLabel htmlFor="paid_now">Pagó al crear</FieldLabel>
              </Field>
              <Button type="submit">Guardar acceso</Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Accesos</CardTitle>
          <CardDescription>Activos, vencidos y pendientes de renovar.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Cuenta</TableHead>
                <TableHead>Fin</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(subscriptions ?? []).map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.customer_name}</TableCell>
                  <TableCell>{item.product_name}</TableCell>
                  <TableCell>{item.account_label ?? item.slot_label}</TableCell>
                  <TableCell>{item.ends_on}</TableCell>
                  <TableCell>{money(item.current_price_amount, item.current_price_currency ?? "BOB")}</TableCell>
                  <TableCell><Badge variant="secondary">{item.computed_status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
