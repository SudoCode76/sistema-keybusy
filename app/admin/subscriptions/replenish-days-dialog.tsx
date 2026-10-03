"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { replenishSubscriptionDays } from "@/app/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { formatDate } from "@/lib/date"

import { FormSubmitButton } from "../accounts/form-submit-button"

export function ReplenishDaysDialog({
  subscriptionId,
  customerName,
  endsOn,
  open,
  onOpenChange,
}: {
  subscriptionId: string
  customerName: string
  endsOn: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [days, setDays] = useState("5")
  const [error, setError] = useState("")
  const nextDate = new Date(`${endsOn}T00:00:00Z`)
  nextDate.setUTCDate(nextDate.getUTCDate() + (Number(days) || 0))
  const nextDateValue = nextDate.toISOString().slice(0, 10)

  async function submit(formData: FormData) {
    setError("")
    try {
      await replenishSubscriptionDays(formData)
      onOpenChange(false)
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron reponer los días")
    }
  }

  return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reponer días</DialogTitle>
            <DialogDescription>
              Se sumarán al vencimiento de {customerName}. Fecha actual: {formatDate(endsOn)}.
            </DialogDescription>
          </DialogHeader>
          <form action={submit}>
            <FieldGroup>
              <input name="id" type="hidden" value={subscriptionId} />
              <Field>
                <FieldLabel htmlFor={`replenish_days_${subscriptionId}`}>Días a reponer</FieldLabel>
                <Input
                  autoFocus
                  id={`replenish_days_${subscriptionId}`}
                  max="365"
                  min="1"
                  name="days"
                  onChange={(event) => setDays(event.target.value)}
                  required
                  type="number"
                  value={days}
                />
              </Field>
              <p className="text-sm text-muted-foreground">
                Nueva fecha de corte: <span className="font-medium text-foreground">{formatDate(nextDateValue)}</span>
              </p>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <div className="flex justify-end gap-2">
                <Button onClick={() => onOpenChange(false)} type="button" variant="outline">Cancelar</Button>
                <FormSubmitButton pendingLabel="Reponiendo...">Confirmar</FormSubmitButton>
              </div>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>
  )
}
