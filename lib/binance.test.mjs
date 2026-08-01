import assert from "node:assert/strict"
import test from "node:test"

import { highestUnverifiedUnpromotedPrice } from "./binance.ts"

test("elige el mayor anuncio no verificado ni promocionado", () => {
  assert.equal(
    highestUnverifiedUnpromotedPrice([
      { adv: { price: "14", isPromoted: true } },
      { adv: { price: "13" }, advertiser: { userType: "merchant" } },
      { adv: { price: "12" }, advertiser: { userType: "user", userGrade: 2 } },
      { adv: { price: "12.5" }, advertiser: { userType: "user", userGrade: 2 } },
      { adv: { price: "15", isBestMatch: true } },
    ]),
    15
  )
})
