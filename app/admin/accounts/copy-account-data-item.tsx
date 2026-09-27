"use client"

import { toast } from "sonner"

import { accountDeliveryText } from "@/lib/account-delivery"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"

export function CopyAccountDataItem({
  platform,
  email,
  password,
  cutoffDate,
}: {
  platform: string
  email: string | null | undefined
  password: string | null | undefined
  cutoffDate: string | null | undefined
}) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        accountDeliveryText({ platform, email, password, cutoffDate })
      )
      toast.success("Datos de cuenta copiados al portapapeles")
    } catch {
      toast.error("No se pudieron copiar los datos de cuenta")
    }
  }

  return (
    <DropdownMenuItem onClick={copy}>
      Copiar datos cuenta
    </DropdownMenuItem>
  )
}
