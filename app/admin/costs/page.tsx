import { PlusIcon } from "lucide-react"

import { createCost } from "@/app/actions"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { formatDate } from "@/lib/date"
import { money } from "@/lib/money"

function one<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function CostsPage() {
  const { supabase } = await requireAdmin()
  const [{ data: costs }, { data: accounts }, { data: providers }] =
    await Promise.all([
      supabase
        .from("costs")
        .select(
          "id, paid_at, cost_type, amount_bob, amount_usdt, service_accounts(label), providers(name)"
        )
        .order("paid_at", { ascending: false }),
      supabase.from("service_accounts").select("id, label").order("label"),
      supabase.from("providers").select("id, name").order("name"),
    ])

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Compras y renovaciones</CardTitle>
          <CardDescription>Costos reales que se restan de la ganancia mensual.</CardDescription>
        </div>
        <Dialog>
          <DialogTrigger
            render={
              <Button>
              <PlusIcon data-icon="inline-start" />
              Nuevo registro
              </Button>
            }
          />
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Registrar compra o renovación</DialogTitle>
              <DialogDescription>Costo real de inventario o proveedor.</DialogDescription>
            </DialogHeader>
            <form action={createCost}>
              <FieldGroup>
                <Field>
                  <FieldLabel>Inventario</FieldLabel>
                  <Select name="service_account_id" defaultValue="none">
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="none">Sin inventario</SelectItem>
                        {(accounts ?? []).map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>Proveedor</FieldLabel>
                  <Select name="provider_id" defaultValue="none">
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="none">Sin proveedor</SelectItem>
                        {(providers ?? []).map((provider) => (
                          <SelectItem key={provider.id} value={provider.id}>
                            {provider.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <div className="grid gap-3 md:grid-cols-3">
                  <Field>
                    <FieldLabel>Tipo</FieldLabel>
                    <Select name="cost_type" defaultValue="renewal">
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="renewal">Renovación</SelectItem>
                          <SelectItem value="purchase">Compra</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="amount">Monto</FieldLabel>
                    <Input id="amount" name="amount" type="number" step="0.01" required />
                  </Field>
                  <Field>
                    <FieldLabel>Moneda</FieldLabel>
                    <Select name="currency" defaultValue="USDT">
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
                </div>
                <Field>
                  <FieldLabel htmlFor="exchange_rate">Cambio</FieldLabel>
                  <Input id="exchange_rate" name="exchange_rate" type="number" step="0.000001" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="notes">Notas</FieldLabel>
                  <Textarea id="notes" name="notes" />
                </Field>
                <Button type="submit">Guardar registro</Button>
              </FieldGroup>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Inventario</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>BOB</TableHead>
              <TableHead>USDT</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(costs ?? []).map((cost) => (
              <TableRow key={cost.id}>
                <TableCell>{formatDate(cost.paid_at)}</TableCell>
                <TableCell>{one(cost.service_accounts)?.label}</TableCell>
                <TableCell>{one(cost.providers)?.name}</TableCell>
                <TableCell>
                  {cost.cost_type === "renewal" ? "Renovación" : "Compra"}
                </TableCell>
                <TableCell>{money(cost.amount_bob, "BOB")}</TableCell>
                <TableCell>{money(cost.amount_usdt, "USDT")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
