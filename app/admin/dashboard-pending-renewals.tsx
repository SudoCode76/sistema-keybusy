"use client"

import { useState } from "react"
import { MessageCircleIcon, RotateCcwIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
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

import { RenewSubscriptionForm, type RenewalFormValues } from "./subscriptions/renew-subscription-form"

type PendingRenewal = RenewalFormValues & {
  customerName: string
  customerPhoneE164: string | null
  productName: string
  serviceSlug: string | null
  accountLabel: string | null
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar renovación</DialogTitle>
            <DialogDescription>
              {item.customerName} · Renueva desde {formatDate(item.endsOn)}
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
                  <TableCell className="text-right"><RenewalButton item={item} /></TableCell>
                </TableRow>
              )
            }) : (
              <TableRow>
                <TableCell className="py-8 text-center text-muted-foreground" colSpan={7}>
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
