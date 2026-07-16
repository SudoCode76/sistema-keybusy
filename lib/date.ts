function parts(value: string | null | undefined) {
  if (!value) return null

  const datePart = value.split("T")[0]
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart)
  if (match && !value.includes("T")) {
    return { day: match[3], month: match[2], year: match[1] }
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return {
    day: String(date.getDate()).padStart(2, "0"),
    month: String(date.getMonth() + 1).padStart(2, "0"),
    year: String(date.getFullYear()),
    time: `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`,
  }
}

export function formatDate(value: string | null | undefined) {
  const date = parts(value)
  return date ? `${date.day}/${date.month}/${date.year}` : "-"
}

export function formatDateTime(value: string | null | undefined) {
  const date = parts(value)
  return date ? `${date.day}/${date.month}/${date.year}${date.time ? ` ${date.time}` : ""}` : "-"
}
