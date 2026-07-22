export const SPOTIFY_MEMBER = "Miembro familiar"
export const SPOTIFY_OWNER = "Titular"

export type SpotifySeatType = typeof SPOTIFY_MEMBER | typeof SPOTIFY_OWNER

export function spotifySeatsAvailable(
  seatsTotal: number | null,
  seatsUsed: number
) {
  return seatsTotal === null ? null : Math.max(0, seatsTotal - seatsUsed)
}

export function spotifyPlanUnavailable(
  account: {
    id: string
    seatsTotal: number | null
    seatsUsed: number
    ownerAssigned: boolean
  },
  seatType: SpotifySeatType,
  current?: { accountId: string | null; seatType: string | null }
) {
  if (account.seatsTotal === null) return true

  const keepsCurrentSeat = current?.accountId === account.id
  if (account.seatsUsed >= account.seatsTotal && !keepsCurrentSeat) return true

  const keepsOwner = keepsCurrentSeat && current?.seatType === SPOTIFY_OWNER
  return seatType === SPOTIFY_OWNER && account.ownerAssigned && !keepsOwner
}
