"use client"

import { useActionState, useState, type ReactNode } from "react"

import { cancelSubscription } from "@/app/actions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FieldGroup } from "@/components/ui/field"

import { FormSubmitButton } from "./form-submit-button"

export function CancelSaleAction({
  subscriptionId,
  saleLabel,
  accountIsMother,
  allowAccountReuseOnCancel,
  trigger,
}: {
  subscriptionId: string
  saleLabel: string
  accountIsMother: boolean
  allowAccountReuseOnCancel: boolean
  trigger?: (open: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [state, action] = useActionState(
    async (previousState: { error?: string }, formData: FormData) => {
      try {
        await cancelSubscription(formData)
        setOpen(false)
        return {}
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : "No se pudo dar de baja la venta",
        }
      }
    },
    {}
  )
  const canKeepAccountAvailable =
    accountIsMother || allowAccountReuseOnCancel

  return (
    <>
      {trigger ? trigger(() => setOpen(true)) : (
        <Button onClick={() => setOpen(true)} size="sm" type="button" variant="outline">
          Dar de baja venta
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dar de baja venta</DialogTitle>
            <DialogDescription>
              Se cancelará la venta de {saleLabel} y se conservará su historial.
            </DialogDescription>
          </DialogHeader>
          <form action={action}>
            <FieldGroup>
              <input name="id" type="hidden" value={subscriptionId} />
              {accountIsMother ? (
                <>
                  <input name="keep_account_available" type="hidden" value="1" />
                  <p className="rounded-lg border p-3 text-sm text-muted-foreground">
                    La cuenta madre se mantendrá activa para sus otros miembros y futuras asignaciones.
                  </p>
                </>
              ) : canKeepAccountAvailable ? (
                <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
                  <Checkbox defaultChecked name="keep_account_available" value="1" />
                  <span>
                    <span className="font-medium">Mantener cuenta disponible</span>
                    <span className="block text-muted-foreground">
                      Si se desmarca, la cuenta quedará inactiva cuando no tenga otra venta activa.
                    </span>
                  </span>
                </label>
              ) : null}
              {state.error ? (
                <Alert variant="destructive">
                  <AlertTitle>No se pudo dar de baja</AlertTitle>
                  <AlertDescription>{state.error}</AlertDescription>
                </Alert>
              ) : null}
              <div className="flex justify-end gap-2">
                <Button onClick={() => setOpen(false)} type="button" variant="outline">
                  Cancelar
                </Button>
                <FormSubmitButton pendingLabel="Dando de baja...">
                  Confirmar baja
                </FormSubmitButton>
              </div>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
