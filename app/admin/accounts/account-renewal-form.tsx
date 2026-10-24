"use client"

import { createCost, renewMotherAccount } from "@/app/actions"
import { DialogForm } from "@/components/ui/dialog"
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
import { nextRenewalSuggestion } from "@/app/admin/subscriptions/mother-access"

import { FormSubmitButton } from "./form-submit-button"

export function AccountRenewalForm({
  accountId,
  providerId,
  renewalDueOn,
  isMother,
}: {
  accountId: string
  providerId: string | null
  renewalDueOn: string | null
  isMother: boolean
}) {
  return (
    <DialogForm action={isMother ? renewMotherAccount : createCost}>
      <FieldGroup>
        <input name="service_account_id" type="hidden" value={accountId} />
        <input name="provider_id" type="hidden" value={providerId ?? "none"} />
        <input name="cost_type" type="hidden" value="renewal" />
        {isMother ? (
          <Field>
            <FieldLabel htmlFor={`next_renewal_${accountId}`}>
              Próximo pago
            </FieldLabel>
            <Input
              defaultValue={nextRenewalSuggestion(renewalDueOn)}
              id={`next_renewal_${accountId}`}
              name="next_renewal_on"
              required
              type="date"
            />
          </Field>
        ) : null}
        <div className="grid gap-3 md:grid-cols-3">
          <Field>
            <FieldLabel htmlFor={`amount_${accountId}`}>Monto</FieldLabel>
            <Input
              id={`amount_${accountId}`}
              name="amount"
              required
              step="0.01"
              type="number"
            />
          </Field>
          <Field>
            <FieldLabel>Moneda</FieldLabel>
            <Select defaultValue="USDT" name="currency">
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
            <FieldLabel htmlFor={`rate_${accountId}`}>Cambio</FieldLabel>
            <Input
              id={`rate_${accountId}`}
              name="exchange_rate"
              step="0.000001"
              type="number"
            />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor={`notes_${accountId}`}>Notas</FieldLabel>
          <Textarea id={`notes_${accountId}`} name="notes" />
        </Field>
        <FormSubmitButton pendingLabel="Guardando...">
          Guardar renovación
        </FormSubmitButton>
      </FieldGroup>
    </DialogForm>
  )
}
