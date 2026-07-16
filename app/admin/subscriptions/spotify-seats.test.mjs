import assert from "node:assert/strict"
import test from "node:test"

import {
  SPOTIFY_MEMBER,
  SPOTIFY_OWNER,
  spotifyPlanUnavailable,
} from "./spotify-seats.ts"

const plan = {
  id: "plan-1",
  seatsTotal: 6,
  seatsUsed: 5,
  ownerAssigned: false,
}

test("valida capacidad y titular de un plan Spotify", () => {
  assert.equal(spotifyPlanUnavailable(plan, SPOTIFY_OWNER), false)
  assert.equal(
    spotifyPlanUnavailable({ ...plan, seatsUsed: 6 }, SPOTIFY_MEMBER),
    true
  )
  assert.equal(
    spotifyPlanUnavailable({ ...plan, ownerAssigned: true }, SPOTIFY_OWNER),
    true
  )
  assert.equal(
    spotifyPlanUnavailable(
      { ...plan, seatsUsed: 6, ownerAssigned: true },
      SPOTIFY_OWNER,
      { accountId: plan.id, seatType: SPOTIFY_OWNER }
    ),
    false
  )
})
