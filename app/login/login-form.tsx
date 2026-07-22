"use client"

import { useActionState, useState } from "react"
import {
  ArrowLeftIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  KeyRoundIcon,
  UserPlusIcon,
} from "lucide-react"

import { authenticate } from "@/app/actions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"

type AuthMode = "signin" | "signup"

function AuthForm({
  mode,
  onModeChange,
}: {
  mode: AuthMode
  onModeChange: (mode: AuthMode) => void
}) {
  const [state, action, pending] = useActionState(authenticate, {})
  const isSignup = mode === "signup"

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardDescription>
          {isSignup ? "Empieza con Keybusy" : "Acceso a Keybusy"}
        </CardDescription>
        <CardTitle role="heading" aria-level={1}>
          {isSignup ? "Crea tu cuenta" : "Bienvenido de vuelta"}
        </CardTitle>
        <CardDescription>
          {isSignup
            ? "Regístrate con tu correo para comenzar."
            : "Ingresa tus datos para continuar."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`${mode}-email`}>Correo</FieldLabel>
              <Input
                id={`${mode}-email`}
                name="email"
                type="email"
                placeholder="tu@correo.com"
                autoComplete="email"
                disabled={pending}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${mode}-password`}>Contraseña</FieldLabel>
              <Input
                id={`${mode}-password`}
                name="password"
                type="password"
                autoComplete={isSignup ? "new-password" : "current-password"}
                disabled={pending}
                required
              />
            </Field>
            {state.error ? (
              <Alert variant="destructive" aria-live="assertive">
                <CircleAlertIcon />
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            ) : null}
            {state.message ? (
              <Alert role="status" aria-live="polite">
                <CircleCheckIcon />
                <AlertDescription>{state.message}</AlertDescription>
              </Alert>
            ) : null}
            <Button
              type="submit"
              name="intent"
              value={mode}
              size="lg"
              className="w-full"
              disabled={pending}
            >
              {pending ? (
                <Spinner
                  data-icon="inline-start"
                  aria-label={isSignup ? "Creando cuenta" : "Iniciando sesión"}
                />
              ) : isSignup ? (
                <UserPlusIcon data-icon="inline-start" />
              ) : (
                <KeyRoundIcon data-icon="inline-start" />
              )}
              {pending
                ? isSignup
                  ? "Creando cuenta..."
                  : "Entrando..."
                : isSignup
                  ? "Registrarme"
                  : "Entrar"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-3">
        <p className="text-center text-sm text-muted-foreground">
          {isSignup ? "¿Ya tienes una cuenta?" : "¿Aún no tienes una cuenta?"}
        </p>
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={pending}
          onClick={() => onModeChange(isSignup ? "signin" : "signup")}
        >
          {isSignup ? (
            <ArrowLeftIcon data-icon="inline-start" />
          ) : (
            <UserPlusIcon data-icon="inline-start" />
          )}
          {isSignup ? "Volver a iniciar sesión" : "Crear cuenta"}
        </Button>
      </CardFooter>
    </Card>
  )
}

export function LoginForm() {
  const [mode, setMode] = useState<AuthMode>("signin")

  return <AuthForm key={mode} mode={mode} onModeChange={setMode} />
}
