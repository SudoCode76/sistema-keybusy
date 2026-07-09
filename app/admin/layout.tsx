import Link from "next/link"
import {
  BadgeDollarSignIcon,
  CreditCardIcon,
  DatabaseIcon,
  HomeIcon,
  KeyRoundIcon,
  ReceiptTextIcon,
  RepeatIcon,
  UsersIcon,
  WalletCardsIcon,
} from "lucide-react"

import { signOut } from "@/app/actions"
import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { requireUser } from "@/lib/auth"

const nav = [
  { href: "/admin", label: "Resumen", icon: HomeIcon },
  { href: "/admin/customers", label: "Clientes", icon: UsersIcon },
  { href: "/admin/accounts", label: "Cuentas", icon: KeyRoundIcon },
  { href: "/admin/subscriptions", label: "Accesos", icon: RepeatIcon },
  { href: "/admin/payments", label: "Pagos", icon: CreditCardIcon },
  { href: "/admin/costs", label: "Costos", icon: ReceiptTextIcon },
  { href: "/admin/providers", label: "Proveedores", icon: WalletCardsIcon },
  { href: "/admin/exchange-rates", label: "Cambio", icon: BadgeDollarSignIcon },
]

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { profile } = await requireUser()

  if (profile?.role !== "admin") {
    return <main className="min-h-svh bg-background p-6">{children}</main>
  }

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" render={<Link href="/admin" />}>
                <DatabaseIcon />
                <span>Keybusy</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Operación</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {nav.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton render={<Link href={item.href} />}>
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <form action={signOut}>
            <Button type="submit" className="w-full" variant="outline" size="sm">
              Salir
            </Button>
          </form>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center gap-3 border-b px-4">
          <SidebarTrigger />
          <div>
            <p className="text-sm font-medium">Panel admin</p>
            <p className="text-xs text-muted-foreground">
              Cuentas, cobros, costos y renovaciones
            </p>
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-6 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
