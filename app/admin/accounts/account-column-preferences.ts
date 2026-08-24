export const ACCOUNT_COLUMN_OPTIONS = [
  { id: "account", label: "Cuenta", hideable: false },
  { id: "platform", label: "Plataforma", hideable: true },
  { id: "provider", label: "Proveedor", hideable: true },
  { id: "purchase", label: "Compra", hideable: true },
  { id: "renewal", label: "Próximo pago", hideable: true },
  { id: "duration", label: "Duración", hideable: true },
  { id: "status", label: "Estado", hideable: true },
  { id: "actions", label: "Acciones", hideable: false },
] as const

export type AccountColumnId = (typeof ACCOUNT_COLUMN_OPTIONS)[number]["id"]
export type AccountModel = "mother" | "private"

export const DEFAULT_ACCOUNT_COLUMNS: AccountColumnId[] = ACCOUNT_COLUMN_OPTIONS.map(
  (column) => column.id
)

const REQUIRED_ACCOUNT_COLUMNS: AccountColumnId[] = ["account", "actions"]
const knownColumnIds = new Set<AccountColumnId>(DEFAULT_ACCOUNT_COLUMNS)
const listeners = new Map<string, Set<() => void>>()

export function accountColumnsStorageKey(accountModel: AccountModel) {
  return `keybusy:accounts-columns:v1:${accountModel}`
}

export function sanitizeAccountColumns(value: unknown): AccountColumnId[] {
  const selected = Array.isArray(value)
    ? value.filter(
        (column): column is AccountColumnId =>
          typeof column === "string" && knownColumnIds.has(column as AccountColumnId)
      )
    : []
  const unique = new Set(selected)

  for (const required of REQUIRED_ACCOUNT_COLUMNS) {
    unique.add(required)
  }

  return DEFAULT_ACCOUNT_COLUMNS.filter((column) => unique.has(column))
}

export function parseAccountColumns(value: string | null | undefined) {
  if (!value) return [...DEFAULT_ACCOUNT_COLUMNS]

  try {
    return sanitizeAccountColumns(JSON.parse(value))
  } catch {
    return [...DEFAULT_ACCOUNT_COLUMNS]
  }
}

export function serializeAccountColumns(columns: readonly AccountColumnId[]) {
  return JSON.stringify(sanitizeAccountColumns(columns))
}

export function readAccountColumns(accountModel: AccountModel) {
  if (typeof window === "undefined") return [...DEFAULT_ACCOUNT_COLUMNS]

  try {
    return parseAccountColumns(window.localStorage.getItem(accountColumnsStorageKey(accountModel)))
  } catch {
    return [...DEFAULT_ACCOUNT_COLUMNS]
  }
}

function notify(accountModel: AccountModel) {
  for (const listener of listeners.get(accountColumnsStorageKey(accountModel)) ?? []) {
    listener()
  }
}

export function subscribeAccountColumns(accountModel: AccountModel, listener: () => void) {
  if (typeof window === "undefined") return () => {}

  const key = accountColumnsStorageKey(accountModel)
  const keyListeners = listeners.get(key) ?? new Set<() => void>()
  keyListeners.add(listener)
  listeners.set(key, keyListeners)

  const handleStorage = (event: StorageEvent) => {
    if (event.key === key) listener()
  }
  window.addEventListener("storage", handleStorage)

  return () => {
    keyListeners.delete(listener)
    window.removeEventListener("storage", handleStorage)
    if (keyListeners.size === 0) listeners.delete(key)
  }
}

export function getAccountColumnsSnapshot(accountModel: AccountModel) {
  return serializeAccountColumns(readAccountColumns(accountModel))
}

export function getAccountColumnsServerSnapshot() {
  return serializeAccountColumns(DEFAULT_ACCOUNT_COLUMNS)
}

export function setAccountColumns(
  accountModel: AccountModel,
  columns: readonly AccountColumnId[]
) {
  const serialized = serializeAccountColumns(columns)

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(accountColumnsStorageKey(accountModel), serialized)
    } catch {
      // Storage can be unavailable in private browsing; the in-memory UI still updates.
    }
  }

  notify(accountModel)
}
