import { createPayment } from "@/app/actions"
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

function one<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function PaymentsPage() {
  const { supabase } = await requireAdmin()
  const [{ data: payments }, { data: customers }, { data: subscriptions }, { data: cycles }] =
    await Promise.all([
      supabase.from("payments").select("id, paid_at, amount_bob, amount_usdt, payment_type, customers(display_name)").order("paid_at", { ascending: false }),
      supabase.from("customers").select("id, display_name").order("display_name"),
      supabase.from("subscriptions").select("id, customers(display_name), products(name)").order("created_at", { ascending: false }),
      supabase.from("billing_cycles").select("id, subscription_id, due_on, expected_bob, status").eq("status", "pending").order("due_on"),
    ])

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Registrar pago</CardTitle>
          <CardDescription>Usa tipo de cambio histórico del pago.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createPayment}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="customer_id">Cliente</FieldLabel>
                <select className="h-8 rounded-lg border bg-background px-2 text-sm" id="customer_id" name="customer_id" required>
                  {(customers ?? []).map((customer) => <option key={customer.id} value={customer.id}>{customer.display_name}</option>)}
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="subscription_id">Acceso</FieldLabel>
                <select className="h-8 rounded-lg border bg-background px-2 text-sm" id="subscription_id" name="subscription_id">
                  <option value="">Sin acceso</option>
                  {(subscriptions ?? []).map((sub) => <option key={sub.id} value={sub.id}>{one(sub.customers)?.display_name} - {one(sub.products)?.name}</option>)}
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="billing_cycle_id">Ciclo pendiente</FieldLabel>
                <select className="h-8 rounded-lg border bg-background px-2 text-sm" id="billing_cycle_id" name="billing_cycle_id">
                  <option value="">Ninguno</option>
                  {(cycles ?? []).map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.due_on} - {money(cycle.expected_bob, "BOB")}</option>)}
                </select>
              </Field>
              <div className="grid gap-3 md:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor="amount">Monto</FieldLabel>
                  <Input id="amount" name="amount" type="number" step="0.01" required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="currency">Moneda</FieldLabel>
                  <select className="h-8 rounded-lg border bg-background px-2 text-sm" id="currency" name="currency">
                    <option value="BOB">BOB</option>
                    <option value="USDT">USDT</option>
                  </select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="exchange_rate">Cambio</FieldLabel>
                  <Input id="exchange_rate" name="exchange_rate" type="number" step="0.000001" />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="notes">Notas</FieldLabel>
                <Textarea id="notes" name="notes" />
              </Field>
              <Button type="submit">Registrar pago</Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Pagos</CardTitle>
          <CardDescription>Clientes nuevos, renovaciones y ajustes.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>BOB</TableHead>
                <TableHead>USDT</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(payments ?? []).map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>{new Date(payment.paid_at).toLocaleDateString("es-BO")}</TableCell>
                  <TableCell>{one(payment.customers)?.display_name}</TableCell>
                  <TableCell>{payment.payment_type}</TableCell>
                  <TableCell>{money(payment.amount_bob, "BOB")}</TableCell>
                  <TableCell>{money(payment.amount_usdt, "USDT")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
