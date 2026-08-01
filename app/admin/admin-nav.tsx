"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BadgeDollarSignIcon,
  CreditCardIcon,
  HomeIcon,
  KeyRoundIcon,
  MailIcon,
  PackageIcon,
  ReceiptTextIcon,
  RepeatIcon,
  Settings2Icon,
  WalletCardsIcon,
} from "lucide-react"

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const nav = [
  { href: "/admin", label: "Resumen", icon: HomeIcon },
  { href: "/admin/subscriptions", label: "Accesos", icon: RepeatIcon },
  { href: "/admin/services", label: "Catálogo", icon: PackageIcon },
  { href: "/admin/accounts", label: "Inventario", icon: KeyRoundIcon },
  { href: "/admin/emails", label: "Correos", icon: MailIcon },
  { href: "/admin/payments", label: "Pagos", icon: CreditCardIcon },
  { href: "/admin/costs", label: "Costos", icon: ReceiptTextIcon },
  { href: "/admin/providers", label: "Proveedores", icon: WalletCardsIcon },
  { href: "/admin/exchange-rates", label: "Cambio", icon: BadgeDollarSignIcon },
  { href: "/admin/settings", label: "Configuración", icon: Settings2Icon },
]

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === href : pathname.startsWith(href)
}

export function AdminNav() {
  const pathname = usePathname()

  return (
    <SidebarMenu>
      {nav.map((item) => (
        <SidebarMenuItem key={item.href}>
          <SidebarMenuButton
            isActive={isActive(pathname, item.href)}
            render={<Link href={item.href} />}
            tooltip={item.label}
          >
            <item.icon />
            <span>{item.label}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}

export function AdminPageTitle() {
  const pathname = usePathname()
  const current = nav.find((item) => isActive(pathname, item.href))

  return (
    <div>
      <p className="text-sm font-medium">{current?.label ?? "Panel admin"}</p>
      <p className="text-xs text-muted-foreground">
        Inventario, cobros, costos y renovaciones
      </p>
    </div>
  )
}
