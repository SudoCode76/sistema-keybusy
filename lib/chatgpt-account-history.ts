export function calendarDaysBetween(from: string, to: string) {
  return Math.max(0, Math.floor((Date.parse(`${to.slice(0, 10)}T00:00:00Z`) - Date.parse(`${from.slice(0, 10)}T00:00:00Z`)) / 86_400_000))
}

export function accountCostTotals(history: Array<{ purchase_cost_bob: number; purchase_cost_usdt: number }>) {
  return history.reduce((total, item) => ({ bob: total.bob + Number(item.purchase_cost_bob), usdt: total.usdt + Number(item.purchase_cost_usdt) }), { bob: 0, usdt: 0 })
}
