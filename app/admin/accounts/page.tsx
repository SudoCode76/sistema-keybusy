import { createServiceAccount, markAccountDead } from "@/app/actions"
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

function one<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function AccountsPage() {
  const { supabase } = await requireAdmin()
  const [{ data: accounts }, { data: services }, { data: providers }] =
    await Promise.all([
      supabase
        .from("service_accounts")
        .select("id, label, login_email, username, status, started_at, dead_at, base_cost_usdt, base_cost_bob, two_factor_url, services(name), providers(name)")
        .order("created_at", { ascending: false }),
      supabase.from("services").select("id, name").order("name"),
      supabase.from("providers").select("id, name").order("name"),
    ])

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Nueva cuenta base</CardTitle>
          <CardDescription>ChatGPT, Spotify familiar, Netflix o perfiles.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createServiceAccount}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="service_id">Servicio</FieldLabel>
                <select className="h-8 rounded-lg border bg-background px-2 text-sm" id="service_id" name="service_id" required>
                  {(services ?? []).map((service) => (
                    <option key={service.id} value={service.id}>{service.name}</option>
                  ))}
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="provider_id">Proveedor</FieldLabel>
                <select className="h-8 rounded-lg border bg-background px-2 text-sm" id="provider_id" name="provider_id">
                  <option value="">Sin proveedor</option>
                  {(providers ?? []).map((provider) => (
                    <option key={provider.id} value={provider.id}>{provider.name}</option>
                  ))}
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="label">Etiqueta</FieldLabel>
                <Input id="label" name="label" placeholder="ChatGPT privado #1" required />
              </Field>
              <div className="grid gap-3 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="login_email">Email</FieldLabel>
                  <Input id="login_email" name="login_email" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="username">Usuario</FieldLabel>
                  <Input id="username" name="username" />
                </Field>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor="base_cost_amount">Costo</FieldLabel>
                  <Input id="base_cost_amount" name="base_cost_amount" type="number" step="0.01" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="base_cost_currency">Moneda</FieldLabel>
                  <select className="h-8 rounded-lg border bg-background px-2 text-sm" id="base_cost_currency" name="base_cost_currency">
                    <option value="USDT">USDT</option>
                    <option value="BOB">BOB</option>
                  </select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="base_cost_exchange_rate">Cambio</FieldLabel>
                  <Input id="base_cost_exchange_rate" name="base_cost_exchange_rate" type="number" step="0.000001" />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="two_factor_url">Link 2FA</FieldLabel>
                <Input id="two_factor_url" name="two_factor_url" />
              </Field>
              <Field>
                <FieldLabel htmlFor="secret_payload">Credenciales</FieldLabel>
                <Textarea id="secret_payload" name="secret_payload" />
              </Field>
              <div className="grid gap-3 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="invite_url">Invitación Spotify</FieldLabel>
                  <Input id="invite_url" name="invite_url" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="address">Dirección Spotify</FieldLabel>
                  <Input id="address" name="address" />
                </Field>
              </div>
              <Button type="submit">Guardar cuenta</Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Cuentas</CardTitle>
          <CardDescription>Incluye fecha de inicio y muerte/reemplazo.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cuenta</TableHead>
                <TableHead>Servicio</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Costo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(accounts ?? []).map((account) => (
                <TableRow key={account.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{account.label}</span>
                      <span className="text-xs text-muted-foreground">{account.login_email ?? account.username}</span>
                    </div>
                  </TableCell>
                  <TableCell>{one(account.services)?.name}</TableCell>
                  <TableCell>{one(account.providers)?.name}</TableCell>
                  <TableCell>{money(account.base_cost_usdt, "USDT")} / {money(account.base_cost_bob, "BOB")}</TableCell>
                  <TableCell><Badge variant="secondary">{account.status}</Badge></TableCell>
                  <TableCell>
                    {account.status === "active" ? (
                      <form action={markAccountDead}>
                        <input type="hidden" name="id" value={account.id} />
                        <Button type="submit" variant="outline" size="sm">Muerta</Button>
                      </form>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
