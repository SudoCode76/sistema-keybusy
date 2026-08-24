import assert from "node:assert/strict"
import test from "node:test"

import {
  accountMatchesSearch,
  accountSearchText,
  normalizeAccountSearch,
} from "./accounts-search.ts"

const account = {
  label: "Plan Familiar Bogotá",
  login_email: "familia@example.com",
  username: "spotify-bogota",
}

const children = [
  {
    serviceAccountId: "plan-1",
    searchText: "María 70123456 maria@example.com",
  },
]

test("normaliza acentos y mayúsculas para buscar cuentas", () => {
  assert.equal(normalizeAccountSearch("  Bogotá  "), "bogota")
  assert.ok(accountSearchText(account).includes("familia@example.com"))
})

test("encuentra el plan por datos de la cuenta o del miembro", () => {
  assert.equal(accountMatchesSearch(account, children, "familia@EXAMPLE.com"), true)
  assert.equal(accountMatchesSearch(account, children, "70123456"), true)
  assert.equal(accountMatchesSearch(account, children, "Maria"), true)
  assert.equal(accountMatchesSearch(account, children, "plan inexistente"), false)
})

test("una consulta vacía conserva todas las cuentas", () => {
  assert.equal(accountMatchesSearch(account, children, "   "), true)
})
