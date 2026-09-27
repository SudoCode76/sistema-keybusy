import assert from "node:assert/strict"
import test from "node:test"

import {
  accountMatchesSearch,
  accountRecordMatchesSearch,
  accountSearchText,
  childMatchesSearch,
  findSearchMatches,
  getSearchMatchSegments,
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

test("identifica si la cuenta o el miembro coinciden individualmente", () => {
  assert.equal(accountRecordMatchesSearch(account, "bogota"), true)
  assert.equal(accountRecordMatchesSearch(account, "70123456"), false)
  assert.equal(childMatchesSearch(children[0], "70123456"), true)
  assert.equal(childMatchesSearch(children[0], "bogota"), false)
})

test("calcula segmentos de resaltado respetando caracteres originales", () => {
  assert.deepEqual(findSearchMatches("70001498 (Juan)", "70001498"), [[0, 8]])

  const segments = getSearchMatchSegments("70001498 (Juan)", "70001498")
  assert.deepEqual(segments, [
    { text: "70001498", highlight: true },
    { text: " (Juan)", highlight: false },
  ])

  const segmentsAccent = getSearchMatchSegments("José Pérez", "jose")
  assert.deepEqual(segmentsAccent, [
    { text: "José", highlight: true },
    { text: " Pérez", highlight: false },
  ])
})
