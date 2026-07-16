import { PlusIcon } from "lucide-react"

import { createPayment } from "@/app/actions"
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

export default async function PaymentsPage() {
  const { supabase } = await requireAdmin()
  const [{ data: payments }, { data: customers }, { data: subscriptions }, { data: cycles }] =
    await Promise.all([
      supabase
        .from("payments")
        .select("id, paid_at, amount_bob, amount_usdt, payment_type, customers(display_name)")
        .order("paid_at", { ascending: false }),
      supabase.from("customers").select("id, display_name").order("display_name"),
      supabase
        .from("subscriptions")
        .select("id, customers(display_name), products(name)")
        .order("created_at", { ascending: false }),
      supabase
        .from("billing_cycles")
        .select("id, subscription_id, due_on, expected_bob, status")
        .eq("status", "pending")
        .order("due_on"),
    ])

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Pagos</CardTitle>
          <CardDescription>Clientes nuevos, renovaciones y ajustes.</CardDescription>
        </div>
        <Dialog>
          <DialogTrigger
            render={
              <Button>
                <PlusIcon data-icon="inline-start" />
                Nuevo pago
              </Button>
            }
          />
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Registrar pago</DialogTitle>
              <DialogDescription>Usa tipo de cambio histórico del pago.</DialogDescription>
            </DialogHeader>
            <form action={createPayment}>
              <FieldGroup>
                <Field>
                  <FieldLabel>Cliente</FieldLabel>
                  <Select name="customer_id" required>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccionar cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {(customers ?? []).map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.display_name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>Acceso</FieldLabel>
                  <Select name="subscription_id" defaultValue="">
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Sin acceso" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="">Sin acceso</SelectItem>
                        {(subscriptions ?? []).map((sub) => (
                          <SelectItem key={sub.id} value={sub.id}>
                            {one(sub.customers)?.display_name} - {one(sub.products)?.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>Ciclo pendiente</FieldLabel>
                  <Select name="billing_cycle_id" defaultValue="">
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Ninguno" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="">Ninguno</SelectItem>
                        {(cycles ?? []).map((cycle) => (
                          <SelectItem key={cycle.id} value={cycle.id}>
                            {formatDate(cycle.due_on)} - {money(cycle.expected_bob, "BOB")}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <div className="grid gap-3 md:grid-cols-3">
                  <Field>
                    <FieldLabel htmlFor="amount">Monto</FieldLabel>
                    <Input id="amount" name="amount" type="number" step="0.01" required />
                  </Field>
                  <Field>
                    <FieldLabel>Moneda</FieldLabel>
                    <Select name="currency" defaultValue="BOB">
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
                  <Field>
                    <FieldLabel htmlFor="exchange_rate">Cambio</FieldLabel>
                    <Input id="exchange_rate" name="exchange_rate" type="number" step="0.000001" />
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="notes">Notas</FieldLabel>
                  <Textarea id="notes" name="notes" />
                </Field>
                <Button type="submit">Guardar pago</Button>
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
              <TableHead>Cliente</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>BOB</TableHead>
              <TableHead>USDT</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(payments ?? []).map((payment) => (
              <TableRow key={payment.id}>
                <TableCell>{formatDate(payment.paid_at)}</TableCell>
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
  )
}
