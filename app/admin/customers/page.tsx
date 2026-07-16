import { PlusIcon } from "lucide-react"

import { createCustomer } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { CountrySelect } from "@/components/country-select"
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
  DialogForm,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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

export default async function CustomersPage() {
  const { supabase } = await requireAdmin()
  const [{ data }, { data: countries }] = await Promise.all([
    supabase
      .from("customers")
      .select("id, display_name, email, phone, phone_e164, telegram_username, status, notes")
      .order("created_at", { ascending: false }),
    supabase
      .from("countries")
      .select("id, iso2, name, dial_code")
      .eq("status", "active")
      .order("name"),
  ])
  const defaultCountryId = countries?.find((country) => country.iso2 === "BO")?.id

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Clientes</CardTitle>
          <CardDescription>{data?.length ?? 0} registrados.</CardDescription>
        </div>
        <Dialog>
          <DialogTrigger render={<Button />}>
            <PlusIcon data-icon="inline-start" />
            Nuevo cliente
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuevo cliente</DialogTitle>
              <DialogDescription>Un cliente puede tener varios accesos.</DialogDescription>
            </DialogHeader>
            <DialogForm action={createCustomer}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="display_name">Nombre</FieldLabel>
                  <Input id="display_name" name="display_name" required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input id="email" name="email" type="email" />
                </Field>
                <Field>
                  <FieldLabel>País</FieldLabel>
                  <CountrySelect
                    countries={countries ?? []}
                    defaultValue={defaultCountryId}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="phone">Teléfono</FieldLabel>
                  <Input id="phone" name="phone" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="telegram_username">Telegram</FieldLabel>
                  <Input
                    id="telegram_username"
                    name="telegram_username"
                    placeholder="@usuario"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="notes">Notas</FieldLabel>
                  <Textarea id="notes" name="notes" />
                </Field>
                <Button type="submit">Guardar</Button>
              </FieldGroup>
            </DialogForm>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Telegram</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).map((customer) => (
              <TableRow key={customer.id}>
                <TableCell>{customer.display_name}</TableCell>
                <TableCell>{customer.email}</TableCell>
                <TableCell>{customer.phone_e164 ?? customer.phone}</TableCell>
                <TableCell>
                  {customer.telegram_username
                    ? `@${customer.telegram_username}`
                    : null}
                </TableCell>
                <TableCell>{customer.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
