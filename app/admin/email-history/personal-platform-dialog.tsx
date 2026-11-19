"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { EyeIcon, EyeOffIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import {
  removeEmailPersonalPlatform,
  saveEmailPersonalPlatform,
} from "@/app/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

import type { EmailHistoryEntry, PersonalPlatformOption } from "./data"

export function PersonalPlatformDialog({
  entry,
  options,
  open,
  onOpenChange,
  onPlatformsChange,
}: {
  entry: EmailHistoryEntry | null
  options: PersonalPlatformOption[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onPlatformsChange: (platforms: EmailHistoryEntry["personalPlatforms"]) => void
}) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState("")
  const [newName, setNewName] = useState("")
  const [notes, setNotes] = useState("")
  const [password, setPassword] = useState("")
  const [isPending, startTransition] = useTransition()
  if (!entry) return null

  const save = async (name: string, value: string, secret: string) => {
    const formData = new FormData()
    formData.set("email_address_id", entry.id)
    formData.set("name", name)
    formData.set("notes", value)
    formData.set("password", secret)
    return saveEmailPersonalPlatform(formData)
  }

  const handleSave = (name: string, value: string, secret: string) => {
    startTransition(async () => {
      try {
        const saved = await save(name, value, secret)
        if (saved) {
          onPlatformsChange(
            [
              ...entry.personalPlatforms.filter((item) => item.id !== saved.id),
              {
                id: saved.id,
                name: saved.name,
                notes: saved.notes,
                password: saved.password,
              },
            ].sort((left, right) => left.name.localeCompare(right.name))
          )
        }
        router.refresh()
        toast.success("Uso personal guardado")
        setSelectedId("")
        setNewName("")
        setNotes("")
        setPassword("")
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "No se pudo guardar"
        )
      }
    })
  }

  const handleRemove = (platformId: string) => {
    startTransition(async () => {
      try {
        const formData = new FormData()
        formData.set("email_address_id", entry.id)
        formData.set("platform_id", platformId)
        await removeEmailPersonalPlatform(formData)
        onPlatformsChange(
          entry.personalPlatforms.filter(
            (platform) => platform.id !== platformId
          )
        )
        router.refresh()
        toast.success("Asignación eliminada")
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "No se pudo eliminar"
        )
      }
    })
  }

  const assignedIds = new Set(
    entry.personalPlatforms.map((platform) => platform.id)
  )
  const availableOptions = options.filter(
    (option) => !assignedIds.has(option.id)
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Uso personal</DialogTitle>
          <DialogDescription className="break-all">
            {entry.email}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {entry.personalPlatforms.length ? (
            <div className="space-y-3">
              {entry.personalPlatforms.map((platform) => (
                <PersonalPlatformNote
                  key={platform.id}
                  platform={platform}
                  disabled={isPending}
                  onSave={(value, secret) =>
                    handleSave(platform.name, value, secret)
                  }
                  onRemove={() => handleRemove(platform.id)}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
              Todavía no hay plataformas personales para este correo.
            </p>
          )}

          <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
            <Label htmlFor="personal-platform-select">Añadir plataforma</Label>
            <Select
              value={selectedId}
              onValueChange={(value) => setSelectedId(value ?? "")}
            >
              <SelectTrigger id="personal-platform-select" className="w-full">
                <SelectValue placeholder="Elegir plataforma guardada" />
              </SelectTrigger>
              <SelectContent>
                {availableOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.name}
                  </SelectItem>
                ))}
                {!availableOptions.length && (
                  <SelectItem value="__empty" disabled>
                    No hay más plataformas guardadas
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            <div className="text-center text-xs text-muted-foreground">
              o crea una nueva
            </div>
            <Input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Nombre de la plataforma"
              aria-label="Nombre de la nueva plataforma"
              maxLength={80}
            />
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Nota para este correo (opcional)"
              aria-label="Nota de la plataforma"
              maxLength={1000}
            />
            <PasswordInput
              value={password}
              onChange={setPassword}
              label="Contraseña de la plataforma"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cerrar
          </Button>
          <Button
            type="button"
            onClick={() =>
              handleSave(
                options.find((option) => option.id === selectedId)?.name ??
                  newName.trim(),
                notes,
                password
              )
            }
            disabled={isPending || (!selectedId && !newName.trim())}
          >
            <PlusIcon />
            {isPending ? "Guardando..." : "Añadir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PersonalPlatformNote({
  platform,
  disabled,
  onSave,
  onRemove,
}: {
  platform: EmailHistoryEntry["personalPlatforms"][number]
  disabled: boolean
  onSave: (notes: string, password: string) => void
  onRemove: () => void
}) {
  const [notes, setNotes] = useState(platform.notes ?? "")
  const [password, setPassword] = useState(platform.password ?? "")

  return (
    <section className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <Badge variant="secondary">{platform.name}</Badge>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          title={`Quitar ${platform.name}`}
          onClick={onRemove}
          disabled={disabled}
        >
          <Trash2Icon />
          <span className="sr-only">Quitar asignación</span>
        </Button>
      </div>
      <PasswordInput
        value={password}
        onChange={setPassword}
        label={`Contraseña de ${platform.name}`}
      />
      <Textarea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Añade una nota"
        aria-label={`Nota para ${platform.name}`}
        maxLength={1000}
      />
      <div className="flex justify-end">
        <Button
          type="button"
          size="xs"
          variant="outline"
          onClick={() => onSave(notes, password)}
          disabled={
            disabled ||
            (notes === (platform.notes ?? "") &&
              password === (platform.password ?? ""))
          }
        >
          Guardar cambios
        </Button>
      </div>
    </section>
  )
}

function PasswordInput({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (value: string) => void
  label: string
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Contraseña (opcional)"
        aria-label={label}
        autoComplete="new-password"
        maxLength={1000}
        className="pr-10"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="absolute top-1/2 right-2 -translate-y-1/2"
        onClick={() => setVisible(!visible)}
        title={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
        <span className="sr-only">
          {visible ? "Ocultar" : "Mostrar"} {label.toLowerCase()}
        </span>
      </Button>
    </div>
  )
}
