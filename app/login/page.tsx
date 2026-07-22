import Image from "next/image"
import { KeyRoundIcon } from "lucide-react"

import { LoginForm } from "@/app/login/login-form"
import loginIllustration from "@/public/images/keybusy-login-illustration.png"

export default function LoginPage() {
  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-muted/40 p-3 sm:p-6 lg:p-8">
      <div
        aria-hidden="true"
        className="absolute -top-32 left-1/4 size-80 rounded-full bg-background/80 blur-3xl"
      />
      <section className="relative grid w-full max-w-6xl overflow-hidden rounded-3xl border bg-background shadow-2xl shadow-foreground/10 lg:min-h-[42rem] lg:grid-cols-[1.08fr_0.92fr]">
        <div className="relative min-h-56 overflow-hidden bg-black sm:min-h-64 lg:min-h-full">
          <Image
            src={loginIllustration}
            alt="Ilustración de una llave rodeada de cuentas, renovaciones y ganancias"
            fill
            preload
            sizes="(min-width: 1024px) 55vw, 100vw"
            className="object-cover object-center"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-linear-to-b from-black/35 via-transparent to-black/80"
          />
          <div className="absolute inset-0 flex flex-col justify-between p-5 text-white sm:p-8 lg:p-10">
            <div className="flex items-center gap-2 text-sm font-medium tracking-wide">
              <span className="flex size-9 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm">
                <KeyRoundIcon aria-hidden="true" className="size-4" />
              </span>
              Keybusy
            </div>
            <div className="max-w-md">
              <p className="text-2xl leading-tight font-medium tracking-tight text-balance sm:text-3xl">
                Tu operación digital, bajo una sola llave.
              </p>
              <p className="mt-2 hidden max-w-sm text-sm leading-relaxed text-white/75 sm:block">
                Organiza cuentas, renovaciones y ganancias sin perder de vista
                lo importante.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center p-5 sm:p-10 lg:p-14">
          <LoginForm />
        </div>
      </section>
    </main>
  )
}
