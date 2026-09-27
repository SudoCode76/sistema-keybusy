export function accountDeliveryText({
  platform,
  email,
  password,
  cutoffDate,
}: {
  platform: string
  email: string | null | undefined
  password: string | null | undefined
  cutoffDate: string | null | undefined
}) {
  const date = cutoffDate ? cutoffDate.split("T")[0] : ""
  const formattedDate = /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`
    : "-"

  return [
    `*Plataforma:* ${platform || "-"}`,
    `*Correo:* ${email || "-"}`,
    `*Contraseña:* ${password || "-"}`,
    `*Fecha de corte:* ${formattedDate}`,
  ].join("\n")
}
