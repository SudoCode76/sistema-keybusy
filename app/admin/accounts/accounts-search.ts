export type AccountSearchRecord = {
  label: string | null
  login_email: string | null
  username: string | null
}

export type AccountChildSearchRecord = {
  serviceAccountId: string
  searchText: string
}

export type SearchMatchSegment = {
  text: string
  highlight: boolean
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

export function accountRecordMatchesSearch(
  account: AccountSearchRecord,
  query: string
) {
  const normalizedQuery = normalizeAccountSearch(query)
  if (!normalizedQuery) return false
  return accountSearchText(account).includes(normalizedQuery)
}

export function childMatchesSearch(
  child: AccountChildSearchRecord,
  query: string
) {
  const normalizedQuery = normalizeAccountSearch(query)
  if (!normalizedQuery) return false
  return normalizeAccountSearch(child.searchText).includes(normalizedQuery)
}

export function accountMatchesSearch(
  account: AccountSearchRecord,
  children: AccountChildSearchRecord[],
  query: string
) {
  const normalizedQuery = normalizeAccountSearch(query)
  if (!normalizedQuery) return true

  if (accountRecordMatchesSearch(account, query)) return true

  return children.some((child) => childMatchesSearch(child, query))
}

export function findSearchMatches(
  text: string | null | undefined,
  query: string | null | undefined
): Array<[number, number]> {
  if (!text || !query) return []
  const rawTokens = query.trim().split(/\s+/).map(normalizeAccountSearch).filter(Boolean)
  if (!rawTokens.length) return []

  const tokens = Array.from(new Set(rawTokens)).sort((a, b) => b.length - a.length)

  let normText = ""
  const indexMap: number[] = []
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const normChar = char.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    for (let j = 0; j < normChar.length; j++) {
      indexMap.push(i)
      normText += normChar[j]
    }
  }

  const rawMatches: Array<[number, number]> = []
  for (const token of tokens) {
    let startIndex = 0
    while (startIndex < normText.length) {
      const foundIndex = normText.indexOf(token, startIndex)
      if (foundIndex === -1) break

      const origStart = indexMap[foundIndex]
      const origEnd = indexMap[foundIndex + token.length - 1] + 1
      rawMatches.push([origStart, origEnd])
      startIndex = foundIndex + token.length
    }
  }

  if (!rawMatches.length) return []

  rawMatches.sort((a, b) => a[0] - b[0] || b[1] - a[1])
  const merged: Array<[number, number]> = [rawMatches[0]]
  for (let i = 1; i < rawMatches.length; i++) {
    const current = rawMatches[i]
    const prev = merged[merged.length - 1]
    if (current[0] <= prev[1]) {
      prev[1] = Math.max(prev[1], current[1])
    } else {
      merged.push(current)
    }
  }

  return merged
}

export function getSearchMatchSegments(
  text: string | null | undefined,
  query: string | null | undefined
): SearchMatchSegment[] {
  if (!text) return []
  if (!query?.trim()) return [{ text, highlight: false }]

  const matches = findSearchMatches(text, query)
  if (!matches.length) return [{ text, highlight: false }]

  const segments: SearchMatchSegment[] = []
  let lastIndex = 0
  for (const [start, end] of matches) {
    if (start > lastIndex) {
      segments.push({ text: text.slice(lastIndex, start), highlight: false })
    }
    segments.push({ text: text.slice(start, end), highlight: true })
    lastIndex = end
  }
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), highlight: false })
  }
  return segments
}
