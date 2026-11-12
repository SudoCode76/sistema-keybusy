import assert from "node:assert/strict"
import test from "node:test"
import { findAccountCustomerSale } from "./account-customer-sale.ts"

const memberSale = {
  slot_label: "Miembro familiar",
  products: { slug: "spotify_family_member" },
}

test("muestra solo una venta Spotify marcada explícitamente como Titular", () => {
  const titularSale = {
    slot_label: "Titular",
    products: { slug: "spotify_family_member" },
  }

  assert.equal(findAccountCustomerSale(true, [memberSale, titularSale]), titularSale)
})

test("no muestra clientes de miembros como titulares de la cuenta madre", () => {
  assert.equal(findAccountCustomerSale(true, [memberSale]), null)
})

test("deja vacía la fila de cuenta madre sin ventas asignadas", () => {
  assert.equal(findAccountCustomerSale(true, []), null)
})
