import { PlusIcon } from "lucide-react"

import {
  createProduct,
  setDefaultProduct,
  setProductStatus,
  updateProductPrice,
} from "@/app/actions"
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
import { requireAdmin } from "@/lib/auth"
import { money } from "@/lib/money"

import { AccessFieldsChecklist, NewPlatformDialog } from "./platform-dialog"

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value
}

const productTypeItems = {
  profile: "Perfil",
  seat: "Acceso",
  account: "Cuenta",
}

const purchaseModeItems = {
  inventory: "Cuenta madre",
  individual: "Cuenta privada",
  linked: "Solo enlazado",
}

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>
}) {
  const params = await searchParams
  const { supabase } = await requireAdmin()
  const [{ data: services }, { data: products }] = await Promise.all([
    supabase
      .from("services")
      .select("id, slug, name, description, status")
      .order("name"),
    supabase
      .from("products")
      .select("id, service_id, slug, name, product_type, default_duration_months, default_price_amount, default_price_currency, default_exchange_rate, purchase_mode, access_fields, default_purchase_amount, default_purchase_currency, default_purchase_exchange_rate, is_default, status, services(name)")
      .order("name"),
  ])
  const activeServices = (services ?? []).filter((service) => service.status === "active")
  const serviceItems = Object.fromEntries(activeServices.map((service) => [service.id, service.name]))

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle>Catálogo vendible</CardTitle>
              {params.saved ? <Badge variant="secondary">Guardado</Badge> : null}
            </div>
            <CardDescription>{products?.length ?? 0} ítems con precio de venta.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <NewPlatformDialog />
            <Dialog>
              <DialogTrigger render={<Button />}>
                <PlusIcon data-icon="inline-start" />
                Nuevo ítem
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Nuevo ítem vendible</DialogTitle>
                  <DialogDescription>Lo que vendes al cliente y su precio de venta.</DialogDescription>
                </DialogHeader>
                <DialogForm action={createProduct}>
                  <FieldGroup>
                    <Field>
                      <FieldLabel>Plataforma</FieldLabel>
                      <Select items={serviceItems} name="service_id" required>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Seleccionar plataforma" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {activeServices.map((service) => (
                              <SelectItem key={service.id} value={service.id}>
                                {service.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="product_name">Ítem vendible</FieldLabel>
                      <Input id="product_name" name="name" required />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="product_slug">Código opcional</FieldLabel>
                      <Input id="product_slug" name="slug" placeholder="netflix_profile" />
                    </Field>
                    <div className="grid gap-3 md:grid-cols-2">
                      <Field>
                        <FieldLabel>Tipo</FieldLabel>
                        <Select items={productTypeItems} name="product_type" defaultValue="profile">
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value="profile">Perfil</SelectItem>
                              <SelectItem value="seat">Acceso</SelectItem>
                              <SelectItem value="account">Cuenta</SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="default_duration_months">Meses</FieldLabel>
                        <Input
                          id="default_duration_months"
                          name="default_duration_months"
                          type="number"
                          min="1"
                          defaultValue="1"
                        />
                      </Field>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <Field>
                        <FieldLabel htmlFor="default_price_amount">Precio de venta</FieldLabel>
                        <Input
                          id="default_price_amount"
                          name="default_price_amount"
                          type="number"
                          step="0.01"
                        />
                      </Field>
                      <Field>
                        <FieldLabel>Moneda</FieldLabel>
                        <Select name="default_price_currency" defaultValue="BOB">
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
                        <FieldLabel htmlFor="default_exchange_rate">Cambio default</FieldLabel>
                        <Input
                          id="default_exchange_rate"
                          name="default_exchange_rate"
                          type="number"
                          step="0.000001"
                        />
                      </Field>
                    </div>
                    <div className="grid gap-3 rounded-lg border p-3 md:grid-cols-4">
                      <Field>
                        <FieldLabel>Compra</FieldLabel>
                        <Select items={purchaseModeItems} name="purchase_mode" defaultValue="inventory">
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value="inventory">Cuenta madre</SelectItem>
                              <SelectItem value="individual">Cuenta privada</SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="default_purchase_amount">Compra default</FieldLabel>
                        <Input
                          id="default_purchase_amount"
                          name="default_purchase_amount"
                          type="number"
                          step="0.01"
                        />
                      </Field>
                      <Field>
                        <FieldLabel>Moneda compra</FieldLabel>
                        <Select name="default_purchase_currency" defaultValue="USDT">
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
                      <Field>
                        <FieldLabel htmlFor="default_purchase_exchange_rate">Cambio compra</FieldLabel>
                        <Input
                          id="default_purchase_exchange_rate"
                          name="default_purchase_exchange_rate"
                          type="number"
                          step="0.000001"
                        />
                      </Field>
                    </div>
                    <Field>
                      <FieldLabel>Datos solicitados al vender</FieldLabel>
                      <AccessFieldsChecklist idPrefix="product-new" />
                    </Field>
                    <Button type="submit">Guardar ítem</Button>
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
                <TableHead>Ítem vendible</TableHead>
                <TableHead>Plataforma</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Venta</TableHead>
                <TableHead>Compra</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(products ?? []).map((product) => {
                const nextStatus = product.status === "active" ? "inactive" : "active"

                return (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {product.name}
                        {product.is_default ? (
                          <Badge variant="outline">Predeterminado</Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>{one(product.services)?.name}</TableCell>
                    <TableCell>{productTypeItems[product.product_type as keyof typeof productTypeItems] ?? product.product_type}</TableCell>
                    <TableCell>
                      {money(product.default_price_amount, product.default_price_currency ?? "BOB")}
                    </TableCell>
                    <TableCell>
                      {purchaseModeItems[product.purchase_mode as keyof typeof purchaseModeItems] ?? product.purchase_mode}
                      {product.purchase_mode === "individual" ? (
                        <span className="block text-muted-foreground">
                          {money(product.default_purchase_amount, product.default_purchase_currency ?? "USDT")}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell><Badge variant="secondary">{product.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {product.status === "active" && !product.is_default ? (
                          <form action={setDefaultProduct}>
                            <input name="id" type="hidden" value={product.id} />
                            <Button size="sm" variant="secondary">
                              Predeterminar
                            </Button>
                          </form>
                        ) : null}
                        <Dialog>
                          <DialogTrigger
                            render={<Button size="sm" variant="outline" />}
                          >
                            Editar
                          </DialogTrigger>
                          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
                            <DialogHeader>
                              <DialogTitle>Editar ítem</DialogTitle>
                              <DialogDescription>{product.name}</DialogDescription>
                            </DialogHeader>
                            <DialogForm action={updateProductPrice}>
                              <FieldGroup>
                                <input name="id" type="hidden" value={product.id} />
                                <div className="grid gap-3 md:grid-cols-3">
                                  <Field>
                                    <FieldLabel>Plataforma</FieldLabel>
                                    <Select items={serviceItems} name="service_id" defaultValue={product.service_id}>
                                      <SelectTrigger className="w-full">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectGroup>
                                          {activeServices.map((service) => (
                                            <SelectItem key={service.id} value={service.id}>
                                              {service.name}
                                            </SelectItem>
                                          ))}
                                        </SelectGroup>
                                      </SelectContent>
                                    </Select>
                                  </Field>
                                  <Field>
                                    <FieldLabel htmlFor={`name_${product.id}`}>Nombre</FieldLabel>
                                    <Input
                                      id={`name_${product.id}`}
                                      name="name"
                                      defaultValue={product.name}
                                      required
                                    />
                                  </Field>
                                  <Field>
                                    <FieldLabel htmlFor={`slug_${product.id}`}>Código</FieldLabel>
                                    <Input
                                      id={`slug_${product.id}`}
                                      name="slug"
                                      defaultValue={product.slug}
                                    />
                                  </Field>
                                </div>
                                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
                                  <Field>
                                    <FieldLabel>Tipo</FieldLabel>
                                    <Select
                                      items={productTypeItems}
                                      name="product_type"
                                      defaultValue={product.product_type ?? "profile"}
                                    >
                                      <SelectTrigger className="w-full">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectGroup>
                                          <SelectItem value="profile">Perfil</SelectItem>
                                          <SelectItem value="seat">Acceso</SelectItem>
                                          <SelectItem value="account">Cuenta</SelectItem>
                                        </SelectGroup>
                                      </SelectContent>
                                    </Select>
                                  </Field>
                                  <Field>
                                    <FieldLabel htmlFor={`duration_${product.id}`}>Meses</FieldLabel>
                                    <Input
                                      id={`duration_${product.id}`}
                                      name="default_duration_months"
                                      type="number"
                                      min="1"
                                      defaultValue={product.default_duration_months ?? 1}
                                    />
                                  </Field>
                                  <Field>
                                    <FieldLabel htmlFor={`price_${product.id}`}>Precio de venta</FieldLabel>
                                    <Input
                                      id={`price_${product.id}`}
                                      name="default_price_amount"
                                      type="number"
                                      step="0.01"
                                      defaultValue={product.default_price_amount ?? 0}
                                    />
                                  </Field>
                                  <Field>
                                    <FieldLabel>Moneda</FieldLabel>
                                    <Select
                                      name="default_price_currency"
                                      defaultValue={product.default_price_currency ?? "BOB"}
                                    >
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
                                    <FieldLabel htmlFor={`rate_${product.id}`}>Cambio default</FieldLabel>
                                    <Input
                                      id={`rate_${product.id}`}
                                      name="default_exchange_rate"
                                      type="number"
                                      step="0.000001"
                                      defaultValue={product.default_exchange_rate ?? ""}
                                    />
                                  </Field>
                                </div>
                                <div className="grid gap-3 rounded-lg border p-3 md:grid-cols-2 lg:grid-cols-4">
                                  <Field>
                                    <FieldLabel>Compra</FieldLabel>
                                    <Select
                                      items={purchaseModeItems}
                                      name="purchase_mode"
                                      defaultValue={product.purchase_mode ?? "inventory"}
                                    >
                                      <SelectTrigger className="w-full">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectGroup>
                                          <SelectItem value="inventory">Cuenta madre</SelectItem>
                                          <SelectItem value="individual">Cuenta privada</SelectItem>
                                          <SelectItem value="linked">Solo enlazado</SelectItem>
                                        </SelectGroup>
                                      </SelectContent>
                                    </Select>
                                  </Field>
                                  <Field>
                                    <FieldLabel htmlFor={`purchase_${product.id}`}>Compra default</FieldLabel>
                                    <Input
                                      id={`purchase_${product.id}`}
                                      name="default_purchase_amount"
                                      type="number"
                                      step="0.01"
                                      defaultValue={product.default_purchase_amount ?? 0}
                                    />
                                  </Field>
                                  <Field>
                                    <FieldLabel>Moneda compra</FieldLabel>
                                    <Select
                                      name="default_purchase_currency"
                                      defaultValue={product.default_purchase_currency ?? "USDT"}
                                    >
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
                                  <Field>
                                    <FieldLabel htmlFor={`purchase_rate_${product.id}`}>Cambio compra</FieldLabel>
                                    <Input
                                      id={`purchase_rate_${product.id}`}
                                      name="default_purchase_exchange_rate"
                                      type="number"
                                      step="0.000001"
                                      defaultValue={product.default_purchase_exchange_rate ?? ""}
                                    />
                                  </Field>
                                </div>
                                <Field>
                                  <FieldLabel>Datos solicitados al vender</FieldLabel>
                                  <AccessFieldsChecklist
                                    idPrefix={`product-${product.id}`}
                                    values={product.access_fields ?? []}
                                  />
                                </Field>
                                <Button type="submit">Guardar cambios</Button>
                              </FieldGroup>
                            </DialogForm>
                          </DialogContent>
                        </Dialog>
                        <form action={setProductStatus}>
                          <input name="id" type="hidden" value={product.id} />
                          <input name="status" type="hidden" value={nextStatus} />
                          <Button size="sm" variant={nextStatus === "inactive" ? "destructive" : "outline"}>
                            {nextStatus === "inactive" ? "Desactivar" : "Reactivar"}
                          </Button>
                        </form>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
