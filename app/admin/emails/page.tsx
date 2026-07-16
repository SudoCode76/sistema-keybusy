import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { requireAdmin } from "@/lib/auth"

import { getEmailsPage } from "./data"
import { NewEmailDialog } from "./email-dialogs"
import { EmailsTable } from "./emails-table"

export default async function EmailsPage() {
  const { supabase } = await requireAdmin()
  const [initialPage, { data: providers }] = await Promise.all([
    getEmailsPage(supabase),
    supabase.from("providers").select("id, name").eq("status", "active").order("name"),
  ])

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Correos</CardTitle>
          <CardDescription>Correos propios disponibles, usos e historial.</CardDescription>
        </div>
        <NewEmailDialog providers={providers ?? []} />
      </CardHeader>
      <CardContent>
        <EmailsTable
          key={initialPage.rows.map((row) => `${row.id}:${row.status}:${row.activeUsageCount}`).join("|")}
          initialRows={initialPage.rows}
          initialTotal={initialPage.total}
          providers={providers ?? []}
        />
      </CardContent>
    </Card>
  )
}
