import assert from "node:assert/strict"
import test from "node:test"

import { accountDeliveryText } from "./account-delivery.ts"

test("formatea los datos de cuenta para WhatsApp", () => {
  assert.equal(
    accountDeliveryText({
      platform: "Spotify Premium",
      email: "cliente@example.com",
      password: "secreto",
      cutoffDate: "2026-09-30",
    }),
    "*Plataforma:* Spotify Premium\n*Correo:* cliente@example.com\n*Contraseña:* secreto\n*Fecha de corte:* 30/09/2026"
  )
})

test("usa guion cuando faltan credenciales o fecha", () => {
  assert.equal(
    accountDeliveryText({ platform: "Netflix", email: null, password: "", cutoffDate: null }),
    "*Plataforma:* Netflix\n*Correo:* -\n*Contraseña:* -\n*Fecha de corte:* -"
  )
})
