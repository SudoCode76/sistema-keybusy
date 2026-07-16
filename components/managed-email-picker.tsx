"use client"

import { useEffect, useState } from "react"

import type { EmailRow } from "@/app/admin/emails/data"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function ManagedEmailPicker({
  email,
  emailPassword,
  onEmailChange,
  onEmailPasswordChange,
  initialEmailId,
  onModeChange,
  platformPassword,
  providerId = "none",
  showPassword = true,
}: {
  email: string
  emailPassword: string
  onEmailChange: (value: string) => void
  onEmailPasswordChange: (value: string) => void
  initialEmailId?: string | null
  onModeChange?: (mode: "new" | "existing") => void
  platformPassword?: {
    defaultValue?: string
    label: string
    name: string
    placeholder?: string
    required?: boolean
  }
  providerId?: string
  showPassword?: boolean
}) {
  const [mode, setMode] = useState<"new" | "existing">(
    initialEmailId ? "existing" : "new"
  )
  const [emailId, setEmailId] = useState(initialEmailId ?? "")
  const [search, setSearch] = useState(initialEmailId ? email : "")
  const [options, setOptions] = useState<EmailRow[]>([])
  const [loading, setLoading] = useState(false)
  const optionQuery = mode === "existing" ? search : email
  const visibleOptions = optionQuery.trim().length >= 3 ? options : []
  const selected = visibleOptions.find((option) => option.id === emailId)
  const exactMatch = visibleOptions.find(
    (option) => option.email.trim().toLowerCase() === email.trim().toLowerCase()
  )

  useEffect(() => {
    const value = optionQuery
    if (value.trim().length < 3) return

    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ options: "1", q: value.trim() })
        const response = await fetch(`/admin/emails/data?${params}`, {
          signal: controller.signal,
        })
        if (!response.ok) return
        const result = (await response.json()) as { rows: EmailRow[] }
        setOptions(result.rows)
      } catch {
        if (!controller.signal.aborted) setOptions([])
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 250)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [optionQuery])

  function choose(option: EmailRow) {
    setMode("existing")
    onModeChange?.("existing")
    setEmailId(option.id)
    setSearch(option.email)
    onEmailChange(option.email)
    onEmailPasswordChange(option.emailPassword ?? "")
  }

  function changeMode(next: "new" | "existing") {
    setMode(next)
    setEmailId("")
    if (next === "new") setSearch("")
    onModeChange?.(next)
  }

  return (
    <div className="grid gap-3 rounded-lg border p-3">
      <input name="managed_email_mode" type="hidden" value={mode} />
      <input name="email_address_id" type="hidden" value={emailId} />
      <input
        name="email_origin"
        type="hidden"
        value={providerId === "none" ? "self" : "provider"}
      />
      <input name="email_provider_id" type="hidden" value={providerId} />
      <input name="login_email" type="hidden" value={email} />
      <input name="email_password" type="hidden" value={emailPassword} />

      <Tabs
        value={mode}
        onValueChange={(value) =>
          changeMode(value === "existing" ? "existing" : "new")
        }
      >
        <TabsList className="grid h-auto w-full grid-cols-2">
          <TabsTrigger value="new">Crear correo nuevo</TabsTrigger>
          <TabsTrigger value="existing">Usar correo existente</TabsTrigger>
        </TabsList>

        {mode === "new" ? (
          <TabsContent className="flex flex-col gap-3" value="new">
            <FieldGroup className="grid gap-3 md:grid-cols-2">
              <Field>
                <FieldLabel>Dirección de correo</FieldLabel>
                <Input
                  onChange={(event) => onEmailChange(event.target.value)}
                  type="email"
                  value={email}
                />
              </Field>
              {platformPassword ? (
                <Field>
                  <FieldLabel>{platformPassword.label}</FieldLabel>
                  <Input
                    autoComplete="new-password"
                    defaultValue={platformPassword.defaultValue}
                    name={platformPassword.name}
                    placeholder={platformPassword.placeholder}
                    required={platformPassword.required}
                    type="text"
                  />
                </Field>
              ) : null}
            </FieldGroup>
            {showPassword ? (
              <Field>
                <FieldLabel>Contraseña del correo</FieldLabel>
                <Input
                  autoComplete="new-password"
                  onChange={(event) =>
                    onEmailPasswordChange(event.target.value)
                  }
                  type="text"
                  value={emailPassword}
                />
              </Field>
            ) : null}
            {exactMatch ? (
              <Alert>
                <AlertTitle>Este correo ya existe</AlertTitle>
                <AlertDescription className="flex flex-col gap-2">
                  <span>Reutilízalo para no crear un registro duplicado.</span>
                  <Button
                    onClick={() => choose(exactMatch)}
                    type="button"
                    variant="outline"
                  >
                    Usar correo existente
                  </Button>
                </AlertDescription>
              </Alert>
            ) : null}
          </TabsContent>
        ) : (
          <TabsContent className="flex flex-col gap-3" value="existing">
            <FieldGroup className="grid gap-3 md:grid-cols-2">
              <Field>
                <FieldLabel>Buscar correo propio</FieldLabel>
                <Input
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Escribe parte del correo"
                  value={search}
                />
                <FieldDescription>
                  {loading
                    ? "Buscando..."
                    : "Puedes reutilizarlo aunque tenga otros usos activos."}
                </FieldDescription>
              </Field>
              {platformPassword ? (
                <Field>
                  <FieldLabel>{platformPassword.label}</FieldLabel>
                  <Input
                    autoComplete="new-password"
                    defaultValue={platformPassword.defaultValue}
                    name={platformPassword.name}
                    placeholder={platformPassword.placeholder}
                    required={platformPassword.required}
                    type="text"
                  />
                </Field>
              ) : null}
            </FieldGroup>
            <div className="grid max-h-48 gap-1 overflow-y-auto">
              {visibleOptions.map((option) => (
                <Button
                  className="h-auto justify-between py-2"
                  key={option.id}
                  onClick={() => choose(option)}
                  type="button"
                  variant={emailId === option.id ? "secondary" : "ghost"}
                >
                  <span className="truncate">{option.email}</span>
                  <Badge variant="secondary">
                    {option.activeUsageCount > 0
                      ? `${option.activeUsageCount} usos`
                      : "Disponible"}
                  </Badge>
                </Button>
              ))}
            </div>
            {selected?.activeUsageCount ? (
              <Alert>
                <AlertTitle>Correo actualmente en uso</AlertTitle>
                <AlertDescription>
                  {selected.usages
                    .filter((usage) => !usage.endedAt)
                    .map((usage) => usage.purpose)
                    .join(", ")}
                </AlertDescription>
              </Alert>
            ) : null}
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
