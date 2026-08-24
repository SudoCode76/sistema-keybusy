import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const root = new URL("../../..", import.meta.url)

async function source(path) {
  return readFile(new URL(path, root), "utf8")
}

test("el editor Spotify no conserva el correo de invitación", async () => {
  const file = await source("app/admin/accounts/spotify-member-actions.tsx")

  assert.doesNotMatch(file, /invitationEmail/)
  assert.doesNotMatch(file, /name=\"invitation_email\"/)
  assert.doesNotMatch(file, /Correo de invitación/)
})

test("el inventario Spotify no consulta ni mapea invitation_email", async () => {
  const [inventory, subscriptionsPage, actions] = await Promise.all([
    source("app/admin/accounts/accounts-inventory-page.tsx"),
    source("app/admin/subscriptions/page.tsx"),
    source("app/actions.ts"),
  ])

  assert.doesNotMatch(inventory, /spotify_member_accounts[\s\S]{0,500}invitation_email/)
  assert.doesNotMatch(subscriptionsPage, /spotify_member_accounts[\s\S]{0,500}invitation_email/)
  assert.doesNotMatch(actions.slice(actions.indexOf("export async function updateSpotifyMember")), /invitation_email/)
})

test("la migración elimina solo la columna específica de miembros Spotify", async () => {
  const migration = await source(
    "supabase/migrations/202608150003_remove_spotify_invitation_email.sql"
  )

  assert.match(migration, /update public\.subscription_access_details[\s\S]*set invitation_email = null/)
  assert.match(migration, /alter table public\.spotify_member_accounts[\s\S]*drop column if exists invitation_email/)
  assert.match(migration, /after insert or update of login_email, login_password, email_password/)
  assert.doesNotMatch(migration, /alter table public\.subscription_access_details[\s\S]*drop column/)
  assert.doesNotMatch(migration, /spotify_member_accounts\([^)]*invitation_email/)
})
