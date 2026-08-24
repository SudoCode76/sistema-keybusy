export type AccountSearchRecord = {
  label: string | null
  login_email: string | null
  username: string | null
}

export type AccountChildSearchRecord = {
  serviceAccountId: string
  searchText: string
}

export function normalizeAccountSearch(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .trim()
}

export function accountSearchText(account: AccountSearchRecord) {
  return normalizeAccountSearch(
    [account.label, account.login_email, account.username].filter(Boolean).join(" ")
  )
}

export function accountMatchesSearch(
  account: AccountSearchRecord,
  children: AccountChildSearchRecord[],
  query: string
) {
  const normalizedQuery = normalizeAccountSearch(query)
  if (!normalizedQuery) return true

  if (accountSearchText(account).includes(normalizedQuery)) return true

  return children.some(
    (child) =>
      normalizeAccountSearch(child.searchText).includes(normalizedQuery)
  )
}
