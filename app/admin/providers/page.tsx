import { Globe2Icon, PlusIcon } from "lucide-react"

import { createCountry, createProvider } from "@/app/actions"
import { CountrySelect } from "@/components/country-select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
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
import { whatsappUrl } from "@/lib/phone"

type ProviderRow = {
  id: string
  name: string
  phone_e164: string | null
  notes: string | null
  status: string
  provider_services?: Array<{
    services?: { name: string } | { name: string }[] | null
  }>
}

function serviceNames(provider: ProviderRow) {
  return (provider.provider_services ?? [])
    .flatMap((item) => item.services ?? [])
    .map((service) => service.name)
}

export default async function ProvidersPage() {
  const { supabase } = await requireAdmin()
  const [{ data }, { data: countries }, { data: services }] = await Promise.all([
    supabase
      .from("providers")
      .select("id, name, phone_e164, notes, status, provider_services(services(name))")
      .order("name"),
    supabase
      .from("countries")
      .select("id, iso2, name, dial_code")
      .eq("status", "active")
      .order("name"),
    supabase
      .from("services")
      .select("id, name")
      .eq("status", "active")
      .order("name"),
  ])

  const bolivia = countries?.find((country) => country.iso2 === "BO")
  const providers = (data ?? []) as ProviderRow[]

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Proveedores</CardTitle>
          <CardDescription>{data?.length ?? 0} disponibles.</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Dialog>
            <DialogTrigger render={<Button />}>
              <PlusIcon data-icon="inline-start" />
              Nuevo proveedor
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Nuevo proveedor</DialogTitle>
                <DialogDescription>Para elegirlo al registrar inventario.</DialogDescription>
              </DialogHeader>
              <DialogForm action={createProvider}>
                <FieldGroup>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field>
                      <FieldLabel>País</FieldLabel>
                      <CountrySelect countries={countries ?? []} defaultValue={bolivia?.id} />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="phone">Teléfono</FieldLabel>
                      <Input id="phone" name="phone" />
                    </Field>
                  </div>
                  <FieldSet>
                    <FieldLegend variant="label">Servicios que ofrece</FieldLegend>
                    <FieldGroup data-slot="checkbox-group">
                      {(services ?? []).map((service) => (
                        <Field key={service.id} orientation="horizontal">
                          <Checkbox id={`service_${service.id}`} name="service_ids" value={service.id} />
                          <FieldLabel htmlFor={`service_${service.id}`}>
                            {service.name}
                          </FieldLabel>
                        </Field>
                      ))}
                    </FieldGroup>
                  </FieldSet>
                  <Field>
                    <FieldLabel htmlFor="name">Nombre opcional</FieldLabel>
                    <Input id="name" name="name" placeholder="Proveedor A" />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="notes">Notas</FieldLabel>
                    <Textarea id="notes" name="notes" />
                  </Field>
                  <Button type="submit">Guardar proveedor</Button>
                </FieldGroup>
              </DialogForm>
            </DialogContent>
          </Dialog>
          <Dialog>
            <DialogTrigger render={<Button variant="outline" />}>
              <Globe2Icon data-icon="inline-start" />
              Nuevo país
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nuevo país</DialogTitle>
                <DialogDescription>Agrega uno si no aparece en la lista.</DialogDescription>
              </DialogHeader>
              <DialogForm action={createCountry}>
                <FieldGroup>
                  <div className="grid gap-3 md:grid-cols-[80px_1fr]">
                    <Field>
                      <FieldLabel htmlFor="iso2">ISO</FieldLabel>
                      <Input id="iso2" name="iso2" maxLength={2} placeholder="BO" required />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="country_name">Nombre</FieldLabel>
                      <Input id="country_name" name="name" required />
                    </Field>
                  </div>
                  <Field>
                    <FieldLabel htmlFor="dial_code">Código WhatsApp</FieldLabel>
                    <Input id="dial_code" name="dial_code" placeholder="591" required />
                  </Field>
                  <Button type="submit">Guardar país</Button>
                </FieldGroup>
              </DialogForm>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>Servicios</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {providers.map((provider) => (
              <TableRow key={provider.id}>
                <TableCell>{provider.name}</TableCell>
                <TableCell>
                  {whatsappUrl(provider.phone_e164) ? (
                    <a className="text-sm underline underline-offset-4" href={whatsappUrl(provider.phone_e164) ?? undefined} target="_blank" rel="noreferrer">
                      {provider.phone_e164}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1.5">
                    {serviceNames(provider).map((serviceName) => (
                      <Badge key={serviceName} variant="secondary">
                        {serviceName}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>{provider.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
