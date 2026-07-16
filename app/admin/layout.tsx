import Link from "next/link"
import {
  DatabaseIcon,
  LogOutIcon,
} from "lucide-react"

import { signOut } from "@/app/actions"
import { AdminNav, AdminPageTitle } from "@/app/admin/admin-nav"
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
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { requireUser } from "@/lib/auth"

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
    <SidebarProvider
      style={
        {
          "--sidebar-width": "13rem",
        } as React.CSSProperties
      }
    >
      <Sidebar collapsible="icon" variant="floating">
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
              <AdminNav />
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <form action={signOut}>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton type="submit">
                  <LogOutIcon />
                  <span>Salir</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </form>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur">
          <SidebarTrigger />
          <AdminPageTitle />
        </header>
        <main className="flex flex-1 flex-col gap-6 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
