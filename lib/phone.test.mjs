import assert from "node:assert/strict"
import test from "node:test"

import {
  isValidTelegramUsername,
  normalizeTelegramUsername,
  telegramUrl,
  whatsappUrl,
} from "./phone.ts"

test("normaliza y valida usuarios de Telegram", () => {
  assert.equal(normalizeTelegramUsername("  @Mi_Usuario "), "mi_usuario")
  assert.equal(isValidTelegramUsername("@user_1"), true)
  assert.equal(isValidTelegramUsername("bad-user"), false)
  assert.equal(isValidTelegramUsername("abc"), false)
})

test("crea enlaces de contacto con mensaje", () => {
  const message = "Hola, ¿desea renovar?"

  assert.equal(
    telegramUrl("@Mi_Usuario", message),
    `https://t.me/mi_usuario?text=${encodeURIComponent(message)}`
  )
  assert.equal(
    whatsappUrl("+591 76543210", message),
    `https://wa.me/59176543210?text=${encodeURIComponent(message)}`
  )
})
