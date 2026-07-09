import { createProvider } from "@/app/actions"
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

export default async function ProvidersPage() {
  const { supabase } = await requireAdmin()
  const { data } = await supabase
    .from("providers")
    .select("id, name, contact, notes, status")
    .order("name")

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Proveedor</CardTitle>
          <CardDescription>Para elegirlo al registrar cuentas.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createProvider}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">Nombre</FieldLabel>
                <Input id="name" name="name" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="contact">Contacto</FieldLabel>
                <Input id="contact" name="contact" />
              </Field>
              <Field>
                <FieldLabel htmlFor="notes">Notas</FieldLabel>
                <Textarea id="notes" name="notes" />
              </Field>
              <Button type="submit">Guardar</Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Proveedores</CardTitle>
          <CardDescription>{data?.length ?? 0} disponibles.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((provider) => (
                <TableRow key={provider.id}>
                  <TableCell>{provider.name}</TableCell>
                  <TableCell>{provider.contact}</TableCell>
                  <TableCell>{provider.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
