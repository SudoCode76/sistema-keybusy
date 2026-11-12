type AccountCustomerSale = {
  slot_label: string | null
  products: { slug: string | null } | { slug: string | null }[] | null
}

export function findAccountCustomerSale<T extends AccountCustomerSale>(
  isMother: boolean,
  sales: T[]
) {
  if (!isMother) return sales[0] ?? null

  return sales.find((sale) => {
    const product = Array.isArray(sale.products) ? sale.products[0] : sale.products
    return product?.slug === "spotify_family_member" && sale.slot_label === "Titular"
  }) ?? null
}
