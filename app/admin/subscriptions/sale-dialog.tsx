"use client"

import { useState } from "react"
import { PlusIcon } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

import { SaleForm, type SaleFormProps } from "./sale-form"

export function SaleDialog(props: SaleFormProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={buttonVariants()}>
        <PlusIcon data-icon="inline-start" />
        Nueva venta
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Nueva venta</DialogTitle>
          <DialogDescription>
            Empieza por teléfono y guarda solo los datos que pide cada ítem.
          </DialogDescription>
        </DialogHeader>
        <SaleForm {...props} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}
