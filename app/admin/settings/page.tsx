import Link from "next/link"
import { ArrowLeftIcon, EyeIcon, Settings2Icon } from "lucide-react"

import {
  setProductAccountReuse,
  setServiceInventoryTabVisibility,
} from "@/app/actions"
import { FormSubmitButton } from "@/app/admin/accounts/form-submit-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { requireAdmin } from "@/lib/auth"

export default async function SettingsPage() {
  const { supabase } = await requireAdmin()
  const { data: services, error } = await supabase
    .from("services")
    .select(
      "id, name, slug, status, show_in_inventory_tabs, products(id, name, purchase_mode, allow_account_reuse_on_cancel, status)"
    )
    .eq("status", "active")
    .order("name")

  if (error) throw error

  const privateProducts = (services ?? []).flatMap((service) =>
    (service.products ?? [])
      .filter((product) => product.purchase_mode === "individual")
      .map((product) => ({ ...product, serviceName: service.name }))
  )

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Settings2Icon className="size-5 text-muted-foreground" />
            <h1 className="text-2xl font-semibold tracking-tight">Configuración</h1>
          </div>
          <p className="text-muted-foreground">
            Define qué cuentas se pueden reutilizar y qué plataformas aparecen en Inventario.
          </p>
        </div>
        <Button
          nativeButton={false}
          variant="outline"
          render={<Link href="/admin/accounts" />}
        >
          <ArrowLeftIcon data-icon="inline-start" />
          Volver al inventario
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Conservar cuentas al dar de baja</CardTitle>
          <CardDescription>
            Activa esta opción para que una cuenta privada quede disponible para otra venta al cancelar su acceso.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y rounded-xl border">
            {privateProducts.map((product) => {
              const enabled = product.allow_account_reuse_on_cancel ?? false
              return (
                <div key={product.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium">{product.name}</p>
                    <p className="text-sm text-muted-foreground">{product.serviceName}</p>
                  </div>
                  <form action={setProductAccountReuse} className="flex shrink-0 items-center gap-3">
                    <input name="id" type="hidden" value={product.id} />
                    <input name="enabled" type="hidden" value={enabled ? "0" : "1"} />
                    <Badge variant={enabled ? "secondary" : "outline"}>
                      {enabled ? "Permitida" : "Desactivada"}
                    </Badge>
                    <FormSubmitButton pendingLabel="Guardando..." size="sm" variant="outline">
                      {enabled ? "Desactivar" : "Activar"}
                    </FormSubmitButton>
                  </form>
                </div>
              )
            })}
            {privateProducts.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                No hay productos privados individuales configurados.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Plataformas visibles en Inventario</CardTitle>
          <CardDescription>
            Las plataformas activas aparecen como pestañas solo cuando tienen cuentas físicas. Esta opción no elimina cuentas ni cambia sus ventas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y rounded-xl border">
            {(services ?? []).map((service) => {
              const visible = service.show_in_inventory_tabs !== false
              return (
                <div key={service.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium">{service.name}</p>
                    <p className="text-sm text-muted-foreground">/{service.slug}</p>
                  </div>
                  <form action={setServiceInventoryTabVisibility} className="flex shrink-0 items-center gap-3">
                    <input name="id" type="hidden" value={service.id} />
                    <input name="visible" type="hidden" value={visible ? "0" : "1"} />
                    <Badge variant={visible ? "secondary" : "outline"}>
                      {visible ? "Visible" : "Oculta"}
                    </Badge>
                    <FormSubmitButton pendingLabel="Guardando..." size="sm" variant="outline">
                      <EyeIcon data-icon="inline-start" />
                      {visible ? "Ocultar pestaña" : "Mostrar pestaña"}
                    </FormSubmitButton>
                  </form>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
