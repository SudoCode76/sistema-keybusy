import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { requireAdmin } from "@/lib/auth"

import { getEmailHistoryData } from "./data"
import { EmailHistoryTable } from "./email-history-table"

export default async function EmailHistoryPage() {
  const { supabase } = await requireAdmin()
  const entries = await getEmailHistoryData(supabase)

  const fullyFreeCount = entries.filter((e) => !e.hasActivePlatforms).length
  const mixedCount = entries.filter((e) => e.hasActivePlatforms).length

  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Historial de correos</CardTitle>
          <CardDescription>
            Correos guardados con al menos una plataforma inactiva, sus contraseñas e histórico de planes familiares.
          </CardDescription>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="rounded-md border bg-muted/30 px-2.5 py-1">
            Total: <strong className="text-foreground font-semibold">{entries.length}</strong>
          </span>
          <span className="rounded-md border bg-muted/30 px-2.5 py-1">
            Libres: <strong className="text-foreground font-semibold">{fullyFreeCount}</strong>
          </span>
          <span className="rounded-md border bg-muted/30 px-2.5 py-1">
            Uso mixto: <strong className="text-foreground font-semibold">{mixedCount}</strong>
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <EmailHistoryTable initialEntries={entries} />
      </CardContent>
    </Card>
  )
}
