import { captureBinanceRate } from "@/app/actions"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { requireAdmin } from "@/lib/auth"

export default async function ExchangeRatesPage() {
  const { supabase } = await requireAdmin()
  const { data } = await supabase
    .from("exchange_rate_snapshots")
    .select("id, average_price, rows_requested, trade_type, captured_at")
    .order("captured_at", { ascending: false })
    .limit(20)

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Binance P2P USDT/BOB</CardTitle>
          <CardDescription>Promedio de los primeros 20 anuncios no verificados.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={captureBinanceRate}>
            <Button type="submit">Capturar promedio actual</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Histórico de cambios</CardTitle>
          <CardDescription>Usa estos valores al registrar pagos y costos.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Anuncios</TableHead>
                <TableHead>Promedio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((rate) => (
                <TableRow key={rate.id}>
                  <TableCell>{new Date(rate.captured_at).toLocaleString("es-BO")}</TableCell>
                  <TableCell>{rate.trade_type}</TableCell>
                  <TableCell>{rate.rows_requested}</TableCell>
                  <TableCell>{Number(rate.average_price).toFixed(4)} BOB</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
