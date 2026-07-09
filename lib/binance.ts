type BinanceAd = {
  adv?: {
    price?: string
    tradeType?: string
  }
}

export async function fetchBinanceAverage(tradeType = "BUY") {
  const response = await fetch(
    "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        asset: "USDT",
        fiat: "BOB",
        tradeType,
        page: 1,
        rows: 20,
        payTypes: [],
        publisherType: null,
        merchantCheck: false,
      }),
      cache: "no-store",
    }
  )

  if (!response.ok) {
    throw new Error("No se pudo consultar Binance P2P")
  }

  const json = await response.json()
  const ads = (json.data ?? []) as BinanceAd[]
  const prices = ads
    .map((item) => Number(item.adv?.price))
    .filter((price) => Number.isFinite(price) && price > 0)

  if (!prices.length) {
    throw new Error("Binance no devolvio anuncios validos")
  }

  const average = prices.reduce((sum, price) => sum + price, 0) / prices.length

  return {
    average,
    ads,
  }
}
