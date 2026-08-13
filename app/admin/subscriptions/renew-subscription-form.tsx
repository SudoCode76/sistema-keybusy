"use client"

import { useState, useTransition } from "react"
import { LoaderCircleIcon } from "lucide-react"
import { useRouter } from "next/navigation"

import { renewSubscription } from "@/app/actions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
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
import { Textarea } from "@/components/ui/textarea"

export type RenewalFormValues = {
  id: string
  endsOn: string
  durationMonths: number
  currentPriceAmount: number
  currentPriceCurrency: "BOB" | "USDT"
  currentExchangeRate: number | null
}

export function RenewSubscriptionForm({
  subscription,
  onSaved,
}: {
  subscription: RenewalFormValues
  onSaved: () => void
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      try {
        await renewSubscription(formData)
        onSaved()
        router.refresh()
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "No se pudo registrar la renovación")
      }
    })
  }

  return (
    <form action={submit}>
      <FieldGroup>
        <input name="id" type="hidden" value={subscription.id} />
        <div className="grid gap-3 md:grid-cols-3">
          <Field>
            <FieldLabel htmlFor={`renew_months_${subscription.id}`}>Meses</FieldLabel>
            <Input
              defaultValue={subscription.durationMonths}
              id={`renew_months_${subscription.id}`}
              min="1"
              name="duration_months"
              required
              type="number"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`renew_amount_${subscription.id}`}>Precio mensual</FieldLabel>
            <Input
              defaultValue={subscription.currentPriceAmount}
              id={`renew_amount_${subscription.id}`}
              min="0"
              name="amount"
              required
              step="0.01"
              type="number"
            />
          </Field>
          <Field>
            <FieldLabel>Moneda</FieldLabel>
            <Select name="currency" defaultValue={subscription.currentPriceCurrency}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="BOB">BOB</SelectItem>
                  <SelectItem value="USDT">USDT</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor={`renew_rate_${subscription.id}`}>Tipo de cambio (Binance P2P)</FieldLabel>
          <Input
            defaultValue={subscription.currentExchangeRate ?? ""}
            id={`renew_rate_${subscription.id}`}
            name="exchange_rate"
            step="0.000001"
            type="number"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`renew_notes_${subscription.id}`}>Notas</FieldLabel>
          <Textarea id={`renew_notes_${subscription.id}`} name="notes" />
        </Field>
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>No se pudo renovar</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <Button disabled={pending} type="submit">
          {pending ? <LoaderCircleIcon data-icon="inline-start" className="animate-spin" /> : null}
          {pending ? "Renovando..." : "Guardar renovación"}
        </Button>
      </FieldGroup>
    </form>
  )
}
