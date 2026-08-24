import assert from "node:assert/strict"
import test from "node:test"

import {
  accountColumnsStorageKey,
  DEFAULT_ACCOUNT_COLUMNS,
  parseAccountColumns,
  sanitizeAccountColumns,
} from "./account-column-preferences.ts"

test("usa todas las columnas por defecto y separa cada inventario", () => {
  assert.deepEqual(parseAccountColumns(null), DEFAULT_ACCOUNT_COLUMNS)
  assert.equal(accountColumnsStorageKey("mother"), "keybusy:accounts-columns:v1:mother")
  assert.equal(accountColumnsStorageKey("private"), "keybusy:accounts-columns:v1:private")
})

test("elimina columnas desconocidas y conserva cuenta y acciones", () => {
  assert.deepEqual(sanitizeAccountColumns(["platform", "unknown"]), [
    "account",
    "platform",
    "actions",
  ])
})

test("un JSON inválido vuelve a la configuración predeterminada", () => {
  assert.deepEqual(parseAccountColumns("not-json"), DEFAULT_ACCOUNT_COLUMNS)
})
