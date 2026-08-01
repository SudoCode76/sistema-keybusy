type BinanceAd = {
  adv?: {
    price?: string
    tradeType?: string
    isBestMatch?: boolean
    isPromoted?: boolean
  }
  advertiser?: {
    userType?: string
  }
}

export function highestUnverifiedUnpromotedPrice(ads: BinanceAd[]) {
  const prices = ads
    .filter(
      ({ adv, advertiser }) =>
        !adv?.isPromoted &&
        advertiser?.userType?.toLowerCase() !== "merchant"
    )
    .map((item) => Number(item.adv?.price))
    .filter((price) => Number.isFinite(price) && price > 0)

  if (!prices.length) {
    throw new Error("Binance no devolvio anuncios no verificados sin promocion")
  }

  return Math.max(...prices)
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
  const filteredAds = ads.filter(
    ({ adv, advertiser }) =>
      !adv?.isPromoted &&
      advertiser?.userType?.toLowerCase() !== "merchant"
  )
  const average = highestUnverifiedUnpromotedPrice(ads)

  return {
    average,
    ads: filteredAds,
  }
}
