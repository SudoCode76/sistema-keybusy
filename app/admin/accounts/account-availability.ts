export function isAccountAvailable(
  status: string,
  hasActiveSubscription: boolean
) {
  return status === "active" && !hasActiveSubscription
}

export function isMotherAccount(
  purchaseModes: Array<string | null | undefined>,
  fallback = false
) {
  return purchaseModes.length
    ? purchaseModes.some((mode) => mode === "inventory")
    : fallback
}

export function isCodexAvailable(status: string, hasActiveCodexSale: boolean) {
  return status === "active" && !hasActiveCodexSale
}

export function canOfferAccountReuse(
  purchaseMode: string | null | undefined,
  allowAccountReuseOnCancel: boolean
) {
  return purchaseMode === "individual" && allowAccountReuseOnCancel
}

export function shouldDeactivateAccountOnCancel({
  purchaseMode,
  allowAccountReuseOnCancel,
  keepAccountAvailable,
  hasOtherActiveSubscription,
}: {
  purchaseMode: string | null | undefined
  allowAccountReuseOnCancel: boolean
  keepAccountAvailable: boolean
  hasOtherActiveSubscription: boolean
}) {
  return (
    purchaseMode === "individual" &&
    !(allowAccountReuseOnCancel && keepAccountAvailable) &&
    !hasOtherActiveSubscription
  )
}
