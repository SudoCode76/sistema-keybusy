import Link from "next/link"
import {
  DatabaseIcon,
  LogOutIcon,
} from "lucide-react"

import { signOut } from "@/app/actions"
import { boliviaToday } from "@/app/admin/subscriptions/mother-access"
import { motherRenewalReminderCutoff } from "@/app/admin/subscriptions/renewal-dates"
import { AdminNav, AdminPageTitle } from "@/app/admin/admin-nav"
import { MotherRenewalReminder } from "@/app/admin/mother-renewal-reminder"
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

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null)
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { profile, supabase } = await requireUser()

  if (profile?.role !== "admin") {
    return <main className="min-h-svh bg-background p-6">{children}</main>
  }

  const today = boliviaToday()
  const { data: reminders, error } = await supabase
    .from("service_accounts")
    .select("id, label, login_email, provider_id, renewal_due_on, email_addresses(email), services!inner(account_model)")
    .eq("status", "active")
    .eq("services.account_model", "mother")
    .not("renewal_due_on", "is", null)
    .lte("renewal_due_on", motherRenewalReminderCutoff(today))
    .order("renewal_due_on")

  if (error) throw error

  const reminderDetails = (reminders ?? []).map((account) => ({
    id: account.id,
    label: account.label,
    providerId: account.provider_id,
    email: account.login_email ?? one(account.email_addresses)?.email ?? null,
    renewalDueOn: account.renewal_due_on,
  }))

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
        <MotherRenewalReminder reminders={reminderDetails} today={today} />
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur">
          <SidebarTrigger />
          <AdminPageTitle />
        </header>
        <main className="flex flex-1 flex-col gap-6 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
