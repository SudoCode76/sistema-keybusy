"use client"

import { useActionState, useState } from "react"
import { MessageCircleIcon, RotateCcwIcon, XCircleIcon } from "lucide-react"
import { useRouter } from "next/navigation"

import { cancelSubscription } from "@/app/actions"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { FieldGroup } from "@/components/ui/field"
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
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDate } from "@/lib/date"
import { whatsappUrl } from "@/lib/phone"

import { canOfferAccountReuse } from "./accounts/account-availability"
import { FormSubmitButton } from "./accounts/form-submit-button"
import { RenewSubscriptionForm, type RenewalFormValues } from "./subscriptions/renew-subscription-form"

type PendingRenewal = RenewalFormValues & {
  customerName: string
  customerPhoneE164: string | null
  productName: string
  serviceSlug: string | null
  accountLabel: string | null
  accountEmail: string | null
  purchaseMode: string | null
  allowAccountReuseOnCancel: boolean
}

function CancelRenewalButton({ item }: { item: PendingRenewal }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [state, action] = useActionState(
    async (previousState: { error?: string }, formData: FormData) => {
      try {
        await cancelSubscription(formData)
        setOpen(false)
        router.refresh()
        return {}
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : "No se pudo dar de baja",
        }
      }
    },
    {}
  )
  const canKeepAccountAvailable = canOfferAccountReuse(
    item.purchaseMode,
    item.allowAccountReuseOnCancel
  )

  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm" variant="outline">
        <XCircleIcon data-icon="inline-start" />
        Dar de baja
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dar de baja</DialogTitle>
            <DialogDescription>
              La suscripción de {item.customerName} se cancelará y dejará de aparecer entre las renovaciones pendientes.
            </DialogDescription>
          </DialogHeader>
          <form action={action}>
            <FieldGroup>
              <input name="id" type="hidden" value={item.id} />
              {canKeepAccountAvailable ? (
                <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
                  <Checkbox name="keep_account_available" value="1" />
                  <span>
                    <span className="font-medium">Mantener cuenta disponible para otra venta</span>
                    <span className="block text-muted-foreground">Desmarcada, la cuenta quedará inactiva.</span>
                  </span>
                </label>
              ) : null}
              {state.error ? (
                <Alert variant="destructive">
                  <AlertTitle>No se pudo dar de baja</AlertTitle>
                  <AlertDescription>{state.error}</AlertDescription>
                </Alert>
              ) : null}
              <FormSubmitButton pendingLabel="Dando de baja...">
                Confirmar baja
              </FormSubmitButton>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

function RenewalButton({ item }: { item: PendingRenewal }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm" variant="outline">
        <RotateCcwIcon data-icon="inline-start" />
        Renovar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Registrar renovación</DialogTitle>
            <DialogDescription>
              {item.customerName} · Inicio sugerido: {formatDate(item.renewalStartOn)}
            </DialogDescription>
          </DialogHeader>
          <RenewSubscriptionForm subscription={item} onSaved={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  )
}

export function DashboardPendingRenewals({
  rows,
  today,
}: {
  rows: PendingRenewal[]
  today: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Renovaciones pendientes</CardTitle>
        <CardDescription>Accesos vencidos o que renuevan hoy.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Ítem vendido</TableHead>
              <TableHead>Inventario</TableHead>
              <TableHead>Correo de la cuenta</TableHead>
              <TableHead>Finaliza</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead className="text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? rows.map((item) => {
              const message = item.serviceSlug === "spotify"
                ? "Hola, ¿desea renovar su suscripción a Spotify?"
                : `Hola, ¿desea renovar ${item.productName}?`
              const whatsapp = whatsappUrl(item.customerPhoneE164, message)
              const overdue = item.endsOn < today

              return (
                <TableRow key={item.id}>
                  <TableCell>{item.customerName}</TableCell>
                  <TableCell>{item.productName}</TableCell>
                  <TableCell>{item.accountLabel ?? "-"}</TableCell>
                  <TableCell className="max-w-xs break-all">
                    {item.accountEmail ?? "-"}
                  </TableCell>
                  <TableCell>{formatDate(item.endsOn)}</TableCell>
                  <TableCell>
                    <Badge variant={overdue ? "destructive" : "secondary"}>
                      {overdue ? "Vencida" : "Renueva hoy"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {whatsapp ? (
                      <a className={buttonVariants({ size: "sm" })} href={whatsapp} rel="noreferrer" target="_blank">
                        <MessageCircleIcon data-icon="inline-start" />
                        Contactar
                      </a>
                    ) : <span className="text-sm text-muted-foreground">Sin teléfono</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <RenewalButton item={item} />
                      <CancelRenewalButton item={item} />
                    </div>
                  </TableCell>
                </TableRow>
              )
            }) : (
              <TableRow>
                <TableCell className="py-8 text-center text-muted-foreground" colSpan={8}>
                  No hay renovaciones pendientes.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
