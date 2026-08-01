import assert from "node:assert/strict"
import test from "node:test"

import {
  canOfferAccountReuse,
  isCodexAvailable,
  isAccountAvailable,
  isMotherAccount,
  shouldDeactivateAccountOnCancel,
} from "./account-availability.ts"

test("solo marca disponibles las cuentas activas sin venta activa", () => {
  assert.equal(isAccountAvailable("active", false), true)
  assert.equal(isAccountAvailable("active", true), false)
  assert.equal(isAccountAvailable("inactive", false), false)
})

test("clasifica una plataforma con producto enlazado como privada", () => {
  assert.equal(isMotherAccount(["individual", "linked"]), false)
  assert.equal(isMotherAccount(["inventory"]), true)
  assert.equal(isMotherAccount([], true), true)
  assert.equal(isCodexAvailable("active", false), true)
  assert.equal(isCodexAvailable("active", true), false)
})

test("solo ofrece conservar cuentas individuales configuradas", () => {
  assert.equal(canOfferAccountReuse("individual", true), true)
  assert.equal(canOfferAccountReuse("individual", false), false)
  assert.equal(canOfferAccountReuse("inventory", true), false)
  assert.equal(canOfferAccountReuse("linked", true), false)
})

test("la baja solo desactiva una cuenta individual sin otro cliente activo", () => {
  const individual = {
    purchaseMode: "individual",
    allowAccountReuseOnCancel: true,
    keepAccountAvailable: false,
    hasOtherActiveSubscription: false,
  }

  assert.equal(shouldDeactivateAccountOnCancel(individual), true)
  assert.equal(
    shouldDeactivateAccountOnCancel({ ...individual, keepAccountAvailable: true }),
    false
  )
  assert.equal(
    shouldDeactivateAccountOnCancel({ ...individual, hasOtherActiveSubscription: true }),
    false
  )
  assert.equal(
    shouldDeactivateAccountOnCancel({ ...individual, purchaseMode: "inventory" }),
    false
  )
})
