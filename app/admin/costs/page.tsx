import { createCost } from "@/app/actions"
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

export default async function CostsPage() {
  const { supabase } = await requireAdmin()
  const [{ data: costs }, { data: accounts }, { data: providers }] =
    await Promise.all([
      supabase.from("costs").select("id, paid_at, cost_type, amount_bob, amount_usdt, service_accounts(label), providers(name)").order("paid_at", { ascending: false }),
      supabase.from("service_accounts").select("id, label").order("label"),
      supabase.from("providers").select("id, name").order("name"),
    ])

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Registrar costo</CardTitle>
          <CardDescription>Compra o renovación de cuenta/plan.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createCost}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="service_account_id">Cuenta</FieldLabel>
                <select className="h-8 rounded-lg border bg-background px-2 text-sm" id="service_account_id" name="service_account_id">
                  <option value="">Sin cuenta</option>
                  {(accounts ?? []).map((account) => <option key={account.id} value={account.id}>{account.label}</option>)}
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="provider_id">Proveedor</FieldLabel>
                <select className="h-8 rounded-lg border bg-background px-2 text-sm" id="provider_id" name="provider_id">
                  <option value="">Sin proveedor</option>
                  {(providers ?? []).map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
                </select>
              </Field>
              <div className="grid gap-3 md:grid-cols-4">
                <Field>
                  <FieldLabel htmlFor="cost_type">Tipo</FieldLabel>
                  <select className="h-8 rounded-lg border bg-background px-2 text-sm" id="cost_type" name="cost_type">
                    <option value="renewal">Renovación</option>
                    <option value="purchase">Compra</option>
                  </select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="amount">Monto</FieldLabel>
                  <Input id="amount" name="amount" type="number" step="0.01" required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="currency">Moneda</FieldLabel>
                  <select className="h-8 rounded-lg border bg-background px-2 text-sm" id="currency" name="currency">
                    <option value="USDT">USDT</option>
                    <option value="BOB">BOB</option>
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
              <Button type="submit">Registrar costo</Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Costos</CardTitle>
          <CardDescription>Se restan de la ganancia mensual.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Cuenta</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>BOB</TableHead>
                <TableHead>USDT</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(costs ?? []).map((cost) => (
                <TableRow key={cost.id}>
                  <TableCell>{new Date(cost.paid_at).toLocaleDateString("es-BO")}</TableCell>
                  <TableCell>{one(cost.service_accounts)?.label}</TableCell>
                  <TableCell>{one(cost.providers)?.name}</TableCell>
                  <TableCell>{cost.cost_type}</TableCell>
                  <TableCell>{money(cost.amount_bob, "BOB")}</TableCell>
                  <TableCell>{money(cost.amount_usdt, "USDT")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
