"use client"

import { useActionState } from "react"
import { KeyRoundIcon, UserPlusIcon } from "lucide-react"

import { authenticate } from "@/app/actions"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function LoginForm() {
  const [state, action, pending] = useActionState(authenticate, {})

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Keybusy</CardTitle>
        <CardDescription>Gestiona cuentas, renovaciones y ganancias.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="full_name">Nombre</FieldLabel>
              <Input id="full_name" name="full_name" placeholder="Miguel" />
              <FieldDescription>Solo se usa al crear cuenta.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input id="email" name="email" type="email" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input id="password" name="password" type="password" required />
            </Field>
            {state.error ? (
              <FieldDescription className="text-destructive">
                {state.error}
              </FieldDescription>
            ) : null}
            {state.message ? (
              <FieldDescription>{state.message}</FieldDescription>
            ) : null}
            <div className="flex gap-2">
              <Button
                type="submit"
                name="intent"
                value="signup"
                disabled={pending}
              >
                <UserPlusIcon data-icon="inline-start" />
                Crear cuenta
              </Button>
              <Button
                type="submit"
                name="intent"
                value="signin"
                variant="outline"
                disabled={pending}
              >
                <KeyRoundIcon data-icon="inline-start" />
                Entrar
              </Button>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
