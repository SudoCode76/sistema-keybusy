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

export function SaleDialog({
  defaultOpen = false,
  ...props
}: SaleFormProps & { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)

  function clearAssignmentUrl() {
    if (!defaultOpen) return

    const url = new URL(window.location.href)
    url.searchParams.delete("new")
    url.searchParams.delete("product")
    url.searchParams.delete("account")
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`)
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) clearAssignmentUrl()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger className={buttonVariants()}>
        <PlusIcon data-icon="inline-start" />
        Nueva venta
      </DialogTrigger>
      <DialogContent
        className="max-h-[92vh] overflow-y-auto sm:max-w-5xl"
        initialFocus={() => document.getElementById("phone")}
      >
        <DialogHeader>
          <DialogTitle>Nueva venta</DialogTitle>
          <DialogDescription>
            Empieza por teléfono y guarda solo los datos que pide cada ítem.
          </DialogDescription>
        </DialogHeader>
        <SaleForm
          {...props}
          onSaved={() => {
            setOpen(false)
            clearAssignmentUrl()
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
