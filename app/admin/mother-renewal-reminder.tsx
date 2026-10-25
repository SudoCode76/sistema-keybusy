"use client"

import { Fragment, useEffect, useState } from "react"
import Link from "next/link"
import {
  AlertTriangleIcon,
  CalendarClockIcon,
  CheckIcon,
  CopyIcon,
  EyeIcon,
  KeyRoundIcon,
  MailIcon,
  UsersIcon,
  RotateCcwIcon,
  LoaderCircleIcon,
} from "lucide-react"
import { MotionConfig, motion } from "motion/react"

import { getMotherAccountDetails } from "@/app/actions"
import { AccountRenewalForm } from "@/app/admin/accounts/account-renewal-form"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatDate } from "@/lib/date"

const dismissedKey = "mother-renewal-reminder-dismissed"

type Reminder = {
  id: string
  label: string
  providerId: string | null
  email: string | null
  renewalDueOn: string | null
}

type AccountDetails = Awaited<ReturnType<typeof getMotherAccountDetails>>

export function MotherRenewalReminder({
  reminders,
  today,
}: {
  reminders: Reminder[]
  today: string
}) {
  const [open, setOpen] = useState(false)
  const [detailsId, setDetailsId] = useState<string | null>(null)
  const [details, setDetails] = useState<AccountDetails | null>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailsError, setDetailsError] = useState("")
  const [copied, setCopied] = useState("")
  const [renewalId, setRenewalId] = useState<string | null>(null)

  useEffect(() => {
    setOpen(sessionStorage.getItem(dismissedKey) !== "1")
  }, [])

  if (!reminders.length) return null

  function dismiss() {
    sessionStorage.setItem(dismissedKey, "1")
    setOpen(false)
  }

  async function showDetails(id: string) {
    dismiss()
    setDetailsId(id)
    setDetails(null)
    setDetailsError("")
    setDetailsLoading(true)
    try {
      setDetails(await getMotherAccountDetails(id))
    } catch (error) {
      setDetailsError(error instanceof Error ? error.message : "No se pudieron cargar los detalles")
    } finally {
      setDetailsLoading(false)
    }
  }

  async function copyValue(label: string, value: string | null) {
    if (!value) return
    await navigator.clipboard.writeText(value)
    setCopied(label)
    window.setTimeout(() => setCopied(""), 1200)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && dismiss()}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <div className="mb-1 flex size-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <AlertTriangleIcon aria-hidden="true" />
            </div>
            <DialogTitle>Cuentas madre por vencer</DialogTitle>
            <DialogDescription>
              {reminders.length === 1
                ? "Esta cuenta necesita renovación."
                : `Estas ${reminders.length} cuentas necesitan renovación.`} A partir de dos días antes del vencimiento, este aviso aparecerá al entrar en una pestaña nueva hasta renovarlas o archivarlas.
            </DialogDescription>
          </DialogHeader>
          <ul className="grid gap-2">
            {reminders.map((account) => (
              <li
                className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3"
                key={account.id}
              >
                <div className="flex items-start gap-3">
                  <CalendarClockIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{account.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {account.renewalDueOn && account.renewalDueOn < today
                        ? "Vencida el"
                        : "Próximo pago"}{" "}
                      {formatDate(account.renewalDueOn)}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                      <MailIcon aria-hidden="true" className="size-3.5 shrink-0" />
                      {account.email ?? "Sin correo"}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <Button
                    onClick={() => void showDetails(account.id)}
                    size="sm"
                    variant="outline"
                  >
                    <EyeIcon data-icon="inline-start" />
                    Ver detalles
                  </Button>
                  <Button
                    onClick={() => {
                      dismiss()
                      setRenewalId(account.id)
                    }}
                    size="sm"
                  >
                    <RotateCcwIcon data-icon="inline-start" />
                    Renovar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <DialogFooter className="flex-col-reverse sm:flex-row">
            <Link
              className={buttonVariants({ variant: "outline" })}
              href="/admin/accounts"
              onClick={dismiss}
            >
              Cuentas madre
            </Link>
            <Button onClick={dismiss} type="button">Aceptar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {reminders.map((account) => (
        <Fragment key={account.id}>
          <Dialog
            onOpenChange={(nextOpen) => {
              if (!nextOpen) {
                setDetailsId(null)
                setDetails(null)
              }
            }}
            open={detailsId === account.id}
          >
            <DialogContent className="max-h-[88vh] gap-0 overflow-y-auto p-0 sm:max-w-2xl">
              <MotionConfig reducedMotion="user">
                <div className="relative overflow-hidden border-b bg-gradient-to-br from-amber-500/10 via-background to-background px-5 py-6 sm:px-7">
                  <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-16 size-48 rounded-full bg-amber-500/10 blur-3xl" />
                  <DialogHeader className="relative pr-8">
                    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-400">
                      <span className="size-2 rounded-full bg-amber-500" />
                      Cuenta madre · {details?.account.serviceName ?? "Acceso principal"}
                    </p>
                    <DialogTitle className="font-heading text-xl sm:text-2xl">{details?.account.label ?? account.label}</DialogTitle>
                    <DialogDescription>
                      Vencimiento {formatDate(details?.account.renewalDueOn ?? account.renewalDueOn)}
                    </DialogDescription>
                  </DialogHeader>
                </div>
                <div className="grid gap-5 px-5 py-5 sm:px-7 sm:py-6">
                  {detailsLoading ? (
                    <div aria-live="polite" className="flex items-center justify-center gap-2 rounded-2xl border bg-muted/30 py-12 text-sm text-muted-foreground">
                      <LoaderCircleIcon className="size-4 animate-spin" /> Cargando acceso y miembros...
                    </div>
                  ) : detailsError ? (
                    <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert">{detailsError}</p>
                  ) : details ? (
                    <>
                      <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
                        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><KeyRoundIcon className="size-4 text-amber-600 dark:text-amber-400" />Acceso principal</h3>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <CredentialCard label="Correo de la cuenta" value={details.account.email} icon={<MailIcon className="size-4" />} copied={copied === "email"} onCopy={() => void copyValue("email", details.account.email)} />
                          <CredentialCard label="Contraseña de plataforma" value={details.account.platformPassword} icon={<KeyRoundIcon className="size-4" />} copied={copied === "platform"} onCopy={() => void copyValue("platform", details.account.platformPassword)} />
                          {details.account.emailPassword ? <CredentialCard label="Contraseña del correo" value={details.account.emailPassword} icon={<MailIcon className="size-4" />} copied={copied === "email-password"} onCopy={() => void copyValue("email-password", details.account.emailPassword)} /> : null}
                        </div>
                      </motion.section>
                      <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, delay: 0.06 }}>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <h3 className="flex items-center gap-2 text-sm font-semibold"><UsersIcon className="size-4 text-amber-600 dark:text-amber-400" />Miembros activos</h3>
                          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">{details.members.length}</span>
                        </div>
                        {details.members.length ? (
                          <ul className="grid gap-2 sm:grid-cols-2">
                            {details.members.map((member, index) => (
                              <motion.li key={member.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, delay: Math.min(index * 0.035, 0.2) }} className="min-w-0 rounded-xl border bg-card p-3 shadow-sm shadow-black/[0.02]">
                                <p className="truncate text-sm font-medium">{member.name}</p>
                                <p className="mt-1 break-all text-xs text-muted-foreground">{member.email ?? "Sin correo registrado"}</p>
                                {member.endsOn ? <p className="mt-2 text-xs text-muted-foreground">Acceso hasta {formatDate(member.endsOn)}</p> : null}
                              </motion.li>
                            ))}
                          </ul>
                        ) : (
                          <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-7 text-center">
                            <UsersIcon className="mx-auto mb-2 size-5 text-muted-foreground" />
                            <p className="text-sm font-medium">Sin miembros activos</p>
                            <p className="mt-1 text-xs text-muted-foreground">Los accesos asignados aparecerán aquí.</p>
                          </div>
                        )}
                      </motion.section>
                    </>
                  ) : null}
                </div>
                <DialogFooter className="mx-0 mb-0 px-5 py-4 sm:px-7">
                  <Button onClick={() => { setDetailsId(null); setRenewalId(account.id) }} type="button"><RotateCcwIcon data-icon="inline-start" />Renovar cuenta</Button>
                </DialogFooter>
              </MotionConfig>
            </DialogContent>
          </Dialog>
          <Dialog
            onOpenChange={(nextOpen) => !nextOpen && setRenewalId(null)}
            open={renewalId === account.id}
          >
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Renovar cuenta madre</DialogTitle>
                <DialogDescription>
                  Registra el próximo pago y el costo de {account.label}.
                </DialogDescription>
              </DialogHeader>
              <AccountRenewalForm
                accountId={account.id}
                isMother
                providerId={account.providerId}
                renewalDueOn={account.renewalDueOn}
              />
            </DialogContent>
          </Dialog>
        </Fragment>
      ))}
    </>
  )
}

function CredentialCard({
  label,
  value,
  icon,
  copied,
  onCopy,
}: {
  label: string
  value: string | null
  icon: React.ReactNode
  copied: boolean
  onCopy: () => void
}) {
  return (
    <div className="min-w-0 rounded-xl border bg-card p-3 shadow-sm shadow-black/[0.02]">
      <p className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">{icon}{label}</p>
      <div className="flex min-w-0 items-center gap-2">
        <p className="min-w-0 flex-1 break-all text-sm font-medium">{value ?? "No registrada"}</p>
        {value ? <Button aria-label={`Copiar ${label}`} className="size-8 shrink-0" onClick={onCopy} size="icon" type="button" variant="ghost">{copied ? <CheckIcon /> : <CopyIcon />}</Button> : null}
      </div>
    </div>
  )
}
