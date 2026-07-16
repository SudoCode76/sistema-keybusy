"use client"

import { useFormStatus } from "react-dom"
import { LoaderCircleIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

type FormSubmitButtonProps = React.ComponentProps<typeof Button> & {
  pendingLabel?: string
}

export function FormSubmitButton({
  children,
  disabled,
  pendingLabel = "Guardando...",
  ...props
}: FormSubmitButtonProps) {
  const { pending } = useFormStatus()

  return (
    <Button {...props} disabled={pending || disabled} type="submit">
      {pending ? <LoaderCircleIcon data-icon="inline-start" className="animate-spin" /> : null}
      {pending ? pendingLabel : children}
    </Button>
  )
}
