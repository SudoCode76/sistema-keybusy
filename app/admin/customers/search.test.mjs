import assert from "node:assert/strict"
import test from "node:test"

import { matchesCustomerContact } from "./search.ts"

const customer = {
  phone: "70712345",
  phone_e164: "+59170712345",
  telegram_username: "cliente_keybusy",
}

test("encuentra al mismo cliente por teléfono o Telegram", () => {
  assert.equal(matchesCustomerContact(customer, "+591 70712345"), true)
  assert.equal(matchesCustomerContact(customer, "@CLIENTE_KEYBUSY"), true)
  assert.equal(matchesCustomerContact(customer, "70712345"), true)
  assert.equal(matchesCustomerContact(customer, "otro_usuario"), false)
  assert.equal(matchesCustomerContact(customer, "abc12345"), false)
})

test("acepta clientes con un solo contacto", () => {
  assert.equal(
    matchesCustomerContact(
      { ...customer, phone: null, phone_e164: null },
      "@cliente_keybusy"
    ),
    true
  )
  assert.equal(
    matchesCustomerContact(
      { ...customer, telegram_username: null },
      "70712345"
    ),
    true
  )
})
